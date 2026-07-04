import type {
	FaceturnServerState,
	FaceturnServerPlayer,
	GameConfig,
} from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import type {
	RpsChoice,
	ResolutionResult,
	WinCondition,
	MoveChainEntry,
} from "../../../../shared/games/face-turn/types";
import {
	BOSS_MAP,
	CREW_MAP,
	MOVE_MAP,
	CARD_IDS,
	getMove,
	getBoss,
	BOSSES,
	CREW,
	MOVES,
	isDraftable,
	unwrapEffect,
} from "./cards";
import {
	resolveEffects,
	triggerRoundEndPassives,
	recomputePassives,
	getLivingPlayers,
	getEnemies,
	drawCards,
	firstTurnedSlot,
	playerHasClass,
	isConditionalEffect,
	resolveStrikeOrExecute,
	performStrike,
	resolveReflectedSlowMoveDamage,
	checkVanessaDrawTrigger,
	maybeOpenBearBonesOffer,
	applySupplyDropOnCollect,
	applyTrickleDownOnCollect,
	executedPlayerIdFrom,
} from "./effects";
import type { StrikeOrExecuteOutcome } from "./effects";
import { shuffle } from "../lib/random";

export function markDirty(state: FaceturnServerState): void {
	state._publicStateCacheValid = false;
}

export function makeServerPlayer(
	playerId: string,
	teamIndex: number,
): FaceturnServerPlayer {
	return {
		playerId,
		teamIndex,
		bossId: "",
		bossHp: 0,
		bossMaxHp: 0,
		bossShield: 0,
		bossImmunityTurns: 0,
		bossCommandUsed: false,
		crewIds: [null, null],
		crewTurned: [false, false],
		crewClassOverrides: new Map(),
		reserveCrewId: null,
		hand: [],
		deck: [],
		discardPile: [],
		activeMoves: [null, null, null],
		cash: 1,
		hasBluffedSuccessfully: false,
		hasCalledBluffSuccessfully: false,
		totalCardsDiscarded: 0,
		totalMovesPlayed: 0,
		hasShieldedBossThisGame: false,
		hasTurnedAllyCrewThisGame: false,
		incomingPoison: new Map(),
		cashGainPerTurn: 0,
		drawPerTurn: 0,
		cashOnEnemyMoveOrStrike: 0,
		healOnMovePlayed: 0,
		crewSkillsDisabled: false,
		damageMultiplier: 1,
		damageReductionPercent: 0,
		blockCostReduction: 0,
		shieldPerTurn: 0,
		moveBaseCostReduction: 0,
		hasVoidArms: false,
		hasVoidLegsChoice: false,
		voidLegsDiscardCost: 0,
		voidLegsDamage: 0,
		hasBackgroundCheck: false,
		hasWatcherPassive: false,
		hasLifeInsurance: false,
		lifeInsuranceTargets: new Map(),
		trickleDownTargets: new Map(),
		hasFalseFlag: false,
		hasSupplyDrop: false,
		supplyDropCashAmount: 0,
		hasPrankCall: false,
		prankCallBonusAmount: 0,
		doctorNormanTriggered: false,
		vanessaDrawUsedThisTurn: false,
		tooBigUnturnUsed: false,
		disabledPassiveSlots: new Set(),
		prankCallBonusUsedThisRound: false,
		playedMoveThisTurn: false,
		classActionUsedThisTurn: false,
		costOverrides: new Map(),
		draftSelections: { bossId: null, crewIds: [], moveIds: [] },
		isDraftLocked: false,
		mulliganDecided: false,
		hasTerminalStrikeBlock: false,
	};
}

export function buildTeamsAndTurnOrder(
	config: GameConfig,
	playerIds: string[],
): {
	teams: string[][];
	turnOrder: string[];
	playerOrder: [string, string];
	teamIndexByPlayerId: Map<string, number>;
} {
	const teamIndexByPlayerId = new Map<string, number>();

	if (config.mode === "teams") {
		const configTeams = config.teams!;
		const teams: string[][] = [configTeams[0], configTeams[1]];
		for (let ti = 0; ti < teams.length; ti++) {
			for (const pid of teams[ti]!) {
				teamIndexByPlayerId.set(pid, ti);
			}
		}
		const repA = teams[0]![Math.floor(Math.random() * teams[0]!.length)]!;
		const repB = teams[1]![Math.floor(Math.random() * teams[1]!.length)]!;
		const playerOrder: [string, string] = [repA, repB];

		const rotateFromRep = (team: string[], rep: string): string[] => {
			const repIdx = team.indexOf(rep);
			return [...team.slice(repIdx), ...team.slice(0, repIdx)];
		};
		const rotatedA = rotateFromRep(teams[0]!, repA);
		const rotatedB = rotateFromRep(teams[1]!, repB);
		const maxLen = Math.max(rotatedA.length, rotatedB.length);
		const turnOrder: string[] = [];
		for (let i = 0; i < maxLen; i++) {
			if (rotatedA[i]) turnOrder.push(rotatedA[i]!);
			if (rotatedB[i]) turnOrder.push(rotatedB[i]!);
		}
		return { teams, turnOrder, playerOrder, teamIndexByPlayerId };
	}

	if (config.mode === "ffa") {
		const teams: string[][] = playerIds.map((pid) => [pid]);
		playerIds.forEach((pid, i) => teamIndexByPlayerId.set(pid, i));
		const playerOrder: [string, string] = [playerIds[0]!, playerIds[1]!];
		const turnOrder = shuffle([...playerIds]);
		return { teams, turnOrder, playerOrder, teamIndexByPlayerId };
	}

	// duel: two solo teams, fixed order
	const teams: string[][] = [[playerIds[0]!], [playerIds[1]!]];
	teamIndexByPlayerId.set(playerIds[0]!, 0);
	teamIndexByPlayerId.set(playerIds[1]!, 1);
	const playerOrder: [string, string] = [playerIds[0]!, playerIds[1]!];
	const turnOrder = [...playerIds];
	return { teams, turnOrder, playerOrder, teamIndexByPlayerId };
}

export function setTurnOrderAfterRps(
	state: FaceturnServerState,
	rpsWinnerId: string,
	goFirst: boolean,
): void {
	if (state.mode !== "teams") return;

	const repA = state.playerOrder[0];
	const repB = state.playerOrder[1];

	const teamOfRepA = state.teams[state.players.get(repA)!.teamIndex]!;
	const teamOfRepB = state.teams[state.players.get(repB)!.teamIndex]!;

	// which rep's team goes first is decided by rps; goFirst=false flips it
	const repAGoesFirst = goFirst === (rpsWinnerId === repA);
	const [firstTeam, firstRep, secondTeam, secondRep] = repAGoesFirst
		? [teamOfRepA, repA, teamOfRepB, repB]
		: [teamOfRepB, repB, teamOfRepA, repA];

	const rotateFromRep = (team: string[], rep: string): string[] => {
		const repIdx = team.indexOf(rep);
		return [...team.slice(repIdx), ...team.slice(0, repIdx)];
	};
	const rotatedFirst = rotateFromRep(firstTeam, firstRep);
	const rotatedSecond = rotateFromRep(secondTeam, secondRep);

	const maxLen = Math.max(rotatedFirst.length, rotatedSecond.length);
	const turnOrder: string[] = [];
	for (let i = 0; i < maxLen; i++) {
		if (rotatedFirst[i]) turnOrder.push(rotatedFirst[i]!);
		if (rotatedSecond[i]) turnOrder.push(rotatedSecond[i]!);
	}

	state.turnOrder = turnOrder;
}

export function isDraftValid(player: FaceturnServerPlayer): boolean {
	const draft = player.draftSelections;
	if (!draft?.bossId) return false;

	const boss = BOSS_MAP.get(draft.bossId);
	if (!boss) return false;

	const requiredCrewCount =
		draft.bossId === CARD_IDS.BOSS.THE_DEALER ? C.CREW_SLOTS + 1 : C.CREW_SLOTS;
	if (draft.crewIds.length !== requiredCrewCount) return false;
	if (draft.moveIds.length !== C.MOVES_PER_DECK) return false;

	const allIds = [draft.bossId, ...draft.crewIds, ...draft.moveIds];
	return new Set(allIds).size === allIds.length;
}

export function finalizeDraft(player: FaceturnServerPlayer): void {
	const draft = player.draftSelections!;
	const boss = getBoss(draft.bossId!);

	player.bossId = boss.id;
	player.bossHp = boss.maxHp;
	player.bossMaxHp = boss.maxHp;

	// the dealer drafts 3 crew: 2 go into the normal face-up-eligible slots, the 3rd goes into reserve
	for (let i = 0; i < Math.min(draft.crewIds.length, C.CREW_SLOTS); i++) {
		player.crewIds[i as 0 | 1] = draft.crewIds[i]!;
	}
	if (boss.id === CARD_IDS.BOSS.THE_DEALER) {
		player.reserveCrewId = draft.crewIds[C.CREW_SLOTS] ?? null;
	}

	player.deck = shuffle(draft.moveIds);
	player.draftSelections = null;
}

export function autoFillAndFinalizeDraft(player: FaceturnServerPlayer): void {
	if (!player.draftSelections?.bossId) {
		player.draftSelections!.bossId =
			BOSSES[Math.floor(Math.random() * BOSSES.length)]!.id;
	}

	const maxCrewes =
		player.draftSelections!.bossId === CARD_IDS.BOSS.THE_DEALER
			? C.CREW_SLOTS + 1
			: C.CREW_SLOTS;
	const maxMoves = C.MOVES_PER_DECK;

	const availableCrewes = CREW.filter(
		(h) => isDraftable(h) && !player.draftSelections!.crewIds.includes(h.id),
	);
	while (
		player.draftSelections!.crewIds.length < maxCrewes &&
		availableCrewes.length
	) {
		player.draftSelections!.crewIds.push(
			availableCrewes.splice(
				Math.floor(Math.random() * availableCrewes.length),
				1,
			)[0]!.id,
		);
	}

	const availableMoves = MOVES.filter(
		(s) => !player.draftSelections!.moveIds.includes(s.id),
	);
	while (
		player.draftSelections!.moveIds.length < maxMoves &&
		availableMoves.length
	) {
		player.draftSelections!.moveIds.push(
			availableMoves.splice(
				Math.floor(Math.random() * availableMoves.length),
				1,
			)[0]!.id,
		);
	}

	finalizeDraft(player);
	player.isDraftLocked = true;
}

export function dealOpeningHand(player: FaceturnServerPlayer): void {
	drawCards(player, C.OPENING_HAND_SIZE);
}

export function mulliganPlayer(
	player: FaceturnServerPlayer,
	redraw: boolean,
): void {
	if (!redraw) return;
	player.deck.push(...player.hand.splice(0));
	player.deck = shuffle(player.deck);
	drawCards(player, C.OPENING_HAND_SIZE);
}

export type RpsOutcome = "player1" | "player2";

export function resolveRps(
	p1: string,
	p2: string,
	choices: Map<string, RpsChoice>,
): RpsOutcome {
	const c1 = choices.get(p1)!;
	const c2 = choices.get(p2)!;

	if (!c1 || !c2 || c1 === c2) {
		return Math.random() < 0.5 ? "player1" : "player2";
	}
	if (
		(c1 === "rock" && c2 === "scissors") ||
		(c1 === "scissors" && c2 === "paper") ||
		(c1 === "paper" && c2 === "rock")
	)
		return "player1";
	return "player2";
}

export function startTurn(state: FaceturnServerState, playerId: string): void {
	state.activePlayerId = playerId;
	state.pendingAction = null;

	const player = state.players.get(playerId)!;
	player.classActionUsedThisTurn = false;
	player.vanessaDrawUsedThisTurn = false;

	drawCards(player, 1);
	player.cash += 1;

	if (player.cashGainPerTurn > 0) {
		player.cash += player.cashGainPerTurn;
	}
	if (player.drawPerTurn > 0) {
		drawCards(player, player.drawPerTurn);
	}
	if (player.shieldPerTurn > 0) {
		player.bossShield += player.shieldPerTurn;
		player.hasShieldedBossThisGame = true;
	}

	checkVanessaDrawTrigger(player, state);

	// void legs: offer only opens if there's a real choice to make (a card
	// to discard). crewSkillsDisabled / disabledPassiveSlots are already
	// folded into hasVoidLegsChoice via recomputePassives, since that flag
	// is only set while the granting source (crew or active move) is live
	if (player.hasVoidLegsChoice && player.hand.length > 0) {
		state.pendingInteraction = {
			type: "void_legs_choice",
			actorId: playerId,
			hasCardsToDiscard: true,
		};
	}
}

export function swapTurn(state: FaceturnServerState): void {
	const activeTurnOrder = state.turnOrder.filter(
		(id) => !state.eliminatedPlayers.has(id),
	);

	if (activeTurnOrder.length === 0) return;

	const currentIndex = activeTurnOrder.indexOf(state.activePlayerId!);
	const nextIndex = (currentIndex + 1) % activeTurnOrder.length;
	const nextPlayerId = activeTurnOrder[nextIndex]!;

	state.turnNumber++;

	const livingCount = activeTurnOrder.length;
	if (state.turnNumber % livingCount === 0) {
		state.roundNumber++;
		triggerRoundEndPassives(state);
	}

	startTurn(state, nextPlayerId);
}

export function eliminatePlayer(
	state: FaceturnServerState,
	playerId: string,
): void {
	if (state.eliminatedPlayers.has(playerId)) return;

	state.eliminatedPlayers.add(playerId);

	const player = state.players.get(playerId);
	if (player) {
		for (let i = 0; i < player.activeMoves.length; i++) {
			if (player.activeMoves[i] !== null) {
				player.discardPile.push(player.activeMoves[i]!);
				player.activeMoves[i] = null;
			}
		}
		for (const p of getLivingPlayers(state)) {
			recomputePassives(p, state);
		}
	}

	if (
		state.pendingInteraction !== null &&
		state.pendingInteraction.actorId === playerId
	) {
		state.pendingInteraction = null;
	}

	if (
		state.pendingAction !== null &&
		state.pendingAction.actorId === playerId
	) {
		if (player) {
			player.cash += state.pendingAction.cashCost;
		}
		state.pendingAction = null;
		state.challengeEligiblePlayerIds = [];
		if (
			state.phase === "challenge_window" ||
			state.phase === "move_chain_window" ||
			state.phase === "block_declared"
		) {
			state.phase = "active_turn";
		}
	}

	if (state.moveChain !== null) {
		const [p1, p2] = state.moveChain.participants;
		if (p1 === playerId || p2 === playerId) {
			resolveMoveChainFull(state);
			state.moveChain = null;
			state.phase = "active_turn";
		}
	}

	if (state.activePlayerId === playerId && state.phase === "active_turn") {
		swapTurn(state);
	}
}

function resolveRoundLimitTiebreaker(
	state: FaceturnServerState,
	living: FaceturnServerPlayer[],
): { winnerId: string | null; winCondition: WinCondition } {
	const teamStats = new Map<
		number,
		{ totalHp: number; turnedCrew: number; rep: string }
	>();

	for (const player of living) {
		const existing = teamStats.get(player.teamIndex);
		const turnedCount = player.crewIds.filter(
			(id, i) => id !== null && player.crewTurned[i as 0 | 1],
		).length;
		if (existing) {
			existing.totalHp += player.bossHp;
			existing.turnedCrew += turnedCount;
		} else {
			teamStats.set(player.teamIndex, {
				totalHp: player.bossHp,
				turnedCrew: turnedCount,
				rep: player.playerId,
			});
		}
	}

	const teams = [...teamStats.values()];

	teams.sort((a, b) => {
		if (b.totalHp !== a.totalHp) return b.totalHp - a.totalHp;
		return a.turnedCrew - b.turnedCrew;
	});

	const best = teams[0]!;
	const second = teams[1];

	const hpTied = second && second.totalHp === best.totalHp;
	const crewTied = second && second.turnedCrew === best.turnedCrew;

	if (hpTied && crewTied) {
		return { winnerId: null, winCondition: "draw" };
	}

	return { winnerId: best.rep, winCondition: "round_limit" };
}

export function checkWinConditions(
	state: FaceturnServerState,
): { winnerId: string | null; winCondition: WinCondition } | null {
	const living = getLivingPlayers(state);

	const roundLimit =
		state.mode === "duel"
			? C.ROUND_LIMIT_DUEL
			: state.mode === "teams"
				? C.ROUND_LIMIT_TEAMS
				: C.ROUND_LIMIT_FFA;
	if (state.roundNumber >= roundLimit) {
		return resolveRoundLimitTiebreaker(state, living);
	}

	const toEliminate: { playerId: string; winCondition: WinCondition }[] = [];
	for (const player of living) {
		if (player.bossHp <= 0) {
			toEliminate.push({
				playerId: player.playerId,
				winCondition: "boss_hp_zero",
			});
		}
	}

	for (const { playerId } of toEliminate) {
		eliminatePlayer(state, playerId);
	}

	if (toEliminate.length > 0) {
		const stillLiving = getLivingPlayers(state);

		if (stillLiving.length === 0) {
			return { winnerId: null, winCondition: "draw" };
		}

		const livingTeams = new Set(stillLiving.map((p) => p.teamIndex));
		if (livingTeams.size === 1) {
			const winningTeamIndex = [...livingTeams][0]!;
			const winnerId = stillLiving.find(
				(p) => p.teamIndex === winningTeamIndex,
			)!.playerId;
			const lastCause = toEliminate[toEliminate.length - 1]!;
			return { winnerId, winCondition: lastCause.winCondition };
		}
	}

	return null;
}

export function applyWin(
	state: FaceturnServerState,
	winnerId: string | null,
	winCondition: WinCondition,
): void {
	state.winnerId = winnerId;
	state.winCondition = winCondition;
	state.phase = "finished";
}

export function computeChallengeEligible(
	state: FaceturnServerState,
	actorId: string,
	targetPlayerId: string | null,
): string[] {
	const enemies = getEnemies(state, actorId);
	if (enemies.length === 0) return [];

	if (state.mode === "duel") {
		return [enemies[0]!.playerId];
	}

	if (state.mode === "ffa") {
		if (targetPlayerId) {
			const target = state.players.get(targetPlayerId);
			if (target && !state.eliminatedPlayers.has(targetPlayerId)) {
				return [targetPlayerId];
			}
		}
		return enemies.map((e) => e.playerId);
	}

	return enemies.map((e) => e.playerId);
}

export function resolveChallenge(
	state: FaceturnServerState,
	challengerId: string,
): {
	actionProceeds: boolean;
	resolution: ResolutionResult;
	strikeOutcome: StrikeOrExecuteOutcome | null;
} {
	const pending = state.pendingAction!;
	const actor = state.players.get(pending.actorId)!;
	const challenger = state.players.get(challengerId)!;

	if (!pending.actorWasBluffing) {
		const outcome = resolveStrikeOrExecute(state, challenger, null, false);

		// the challenger is being punished for a bad challenge. if they have
		// 2+ face-down crew, resolveStrikeOrExecute just opened its own
		// choose_crew_to_turn interaction (the "penalty" interaction) — tag
		// it so the caller knows the original pendingAction (the class action
		// that was challenged) is still awaiting execution once this closes.
		// callers must not run executePendingAction while this is open: doing
		// so would let a second choose_crew_to_turn (opened against the
		// original target) silently overwrite this one.
		if (
			outcome.outcome === "pending" &&
			state.pendingInteraction?.type === "choose_crew_to_turn"
		) {
			state.pendingInteraction = {
				...state.pendingInteraction,
				deferredActionPending: true,
			};
		}

		// the watcher: offer only makes sense if the challenger still has a
		// face-up crew to unturn AND the pendingInteraction slot wasn't
		// already claimed by resolveStrikeOrExecute's own "2 face-down
		// slots" branch
		if (state.pendingInteraction === null) {
			const actor = state.players.get(pending.actorId)!;
			if (actor.hasWatcherPassive) {
				const eligibleSlots = ([0, 1] as const).filter(
					(i) => actor.crewIds[i] !== null && actor.crewTurned[i],
				);
				if (eligibleSlots.length > 0) {
					state.pendingInteraction = {
						type: "watcher_unturn_offer",
						actorId: pending.actorId,
						eligibleSlots,
					};
				}
			}
		}

		return {
			actionProceeds: true,
			resolution: {
				type: "challenge_fail",
				challengerId,
				actorId: pending.actorId,
				crewTurnedPlayerId: challengerId,
				crewTurnedSlot: outcome.outcome === "crew_turned" ? outcome.slot : null,
				executedPlayerId: executedPlayerIdFrom(outcome, challengerId),
			},
			strikeOutcome: outcome,
		};
	}

	challenger.hasCalledBluffSuccessfully = true;

	let turned: 0 | 1 | null = null;
	let strikeOutcome: StrikeOrExecuteOutcome | null = null;

	// false flag: prevents the crew-turning consequence; the challenger
	// still gets credit
	if (actor.hasFalseFlag) {
		const ffSlot = actor.activeMoves.findIndex(
			(id) => id === CARD_IDS.MOVE.FALSE_FLAG_OPERATION,
		);
		if (ffSlot !== -1) {
			actor.activeMoves[ffSlot] = null;
			actor.discardPile.push(CARD_IDS.MOVE.FALSE_FLAG_OPERATION);
			actor.totalCardsDiscarded++;
			recomputePassives(actor, state);
		}
	} else {
		strikeOutcome = resolveStrikeOrExecute(state, actor, challengerId, false);
		turned =
			strikeOutcome.outcome === "crew_turned" ? strikeOutcome.slot : null;
	}

	// too big once-per-game optional self-unturn
	if (state.pendingInteraction === null) {
		if (challenger.tooBigUnturnUsed === false) {
			const hasTooBig = challenger.crewIds.some(
				(id) => id === CARD_IDS.CREW.TOO_BIG,
			);
			if (hasTooBig && !challenger.crewSkillsDisabled) {
				const slot = challenger.crewIds.findIndex(
					(id) => id === CARD_IDS.CREW.TOO_BIG,
				);
				if (
					slot !== -1 &&
					challenger.crewTurned[slot as 0 | 1] &&
					!challenger.disabledPassiveSlots.has(slot as 0 | 1)
				) {
					state.pendingInteraction = {
						type: "too_big_unturn_offer",
						actorId: challenger.playerId,
					};
				}
			}
		}
		// the watcher: this IS a "you win a challenge" event too
		// the challenger just won by correctly calling a bluff
		if (state.pendingInteraction === null && challenger.hasWatcherPassive) {
			const watcherEligibleSlots = ([0, 1] as const).filter(
				(i) => challenger.crewIds[i] !== null && challenger.crewTurned[i],
			);
			if (watcherEligibleSlots.length > 0) {
				state.pendingInteraction = {
					type: "watcher_unturn_offer",
					actorId: challenger.playerId,
					eligibleSlots: watcherEligibleSlots,
				};
			}
		}
		if (state.pendingInteraction === null) {
			maybeOpenBearBonesOffer(state, challenger, pending.actorId);
		}
	}

	return {
		actionProceeds: false,
		resolution: {
			type: "challenge_success",
			challengerId,
			actorId: pending.actorId,
			crewTurnedPlayerId: pending.actorId,
			crewTurnedSlot: turned,
			executedPlayerId: executedPlayerIdFrom(strikeOutcome, pending.actorId),
		},
		strikeOutcome,
	};
}

export function recordBluffIfUnchallenged(state: FaceturnServerState): void {
	const pending = state.pendingAction;
	if (!pending) return;
	if (pending.actorWasBluffing) {
		const actor = state.players.get(pending.actorId);
		if (actor) actor.hasBluffedSuccessfully = true;
	}
}

export function executePendingAction(
	state: FaceturnServerState,
): StrikeOrExecuteOutcome | null {
	const pending = state.pendingAction!;
	const actor = state.players.get(pending.actorId)!;

	const targetPlayer = pending.targetPlayerId
		? state.players.get(pending.targetPlayerId)
		: getEnemies(state, pending.actorId)[0];

	switch (pending.type) {
		case "class_action_strike": {
			if (!targetPlayer) return null;
			return performStrike({
				state,
				actor,
				targetPlayerId: targetPlayer.playerId,
				targetCrewSlot: pending.targetCrewSlot ?? undefined,
			});
		}
		case "class_action_collect": {
			actor.cash += C.COLLECT_CASH_GAIN;
			applySupplyDropOnCollect(state, actor);
			applyTrickleDownOnCollect(state, actor, C.COLLECT_CASH_GAIN);
			return null;
		}
		case "class_action_unturn": {
			const slot =
				(pending.targetAllySlot as 0 | 1 | null) ?? firstTurnedSlot(actor);
			if (slot !== null && actor.crewIds[slot]) {
				actor.crewTurned[slot] = false;
				recomputePassives(actor, state);
			}
			return null;
		}
		case "class_action_block": {
			return null;
		}
	}
	return null;
}

interface MoveTarget {
	targetCrewSlot?: number | undefined;
	targetAllySlot?: number | undefined;
	targetPlayerId?: string | undefined;
}

export function executeMove(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	moveId: string,
	targets: MoveTarget = {},
): void {
	const move = getMove(moveId);

	actor.costOverrides.delete(moveId);

	// active moves are equipped to a slot; burst and slow are resolved and
	// discarded after effect application
	let claimedSlot = -1;
	if (move.moveType === "active") {
		claimedSlot = actor.activeMoves.findIndex((s) => s === null);
		if (claimedSlot !== -1) {
			actor.activeMoves[claimedSlot] = moveId;
		}
	}

	resolveEffects(move.effects, {
		state,
		actor,
		targetCrewSlot: targets.targetCrewSlot,
		targetAllySlot: targets.targetAllySlot,
		targetPlayerId: targets.targetPlayerId,
		moveId,
	});

	actor.totalMovesPlayed++;

	if (actor.healOnMovePlayed > 0) {
		actor.bossHp = Math.min(
			actor.bossHp + actor.healOnMovePlayed,
			actor.bossMaxHp,
		);
	}

	const enemies = getEnemies(state, actor.playerId);
	for (const enemy of enemies) {
		if (enemy.cashOnEnemyMoveOrStrike > 0) {
			enemy.cash += enemy.cashOnEnemyMoveOrStrike;
		}
	}

	if (move.moveType === "active") {
		if (claimedSlot !== -1) {
			recomputePassives(actor, state);
			// blackmail (and any future move with a global side effect on
			// other players) needs everyone's derived stats refreshed
			// immediately, not just the caster's — recomputePassives only
			// self-derives for whoever it's called on.
			const hasGlobalDisable = move.effects.some((e) => {
				const eff = unwrapEffect(e);
				return eff.type === "passive_disable_all_crew_skills";
			});
			if (hasGlobalDisable) {
				for (const p of state.players.values()) {
					if (p.playerId !== actor.playerId) recomputePassives(p, state);
				}
			}
		}
	} else {
		actor.discardPile.push(moveId);
		actor.totalCardsDiscarded++;
	}

	actor.playedMoveThisTurn = true;
}

export function openMoveChain(
	state: FaceturnServerState,
	casterId: string,
	targetId: string,
	entry: MoveChainEntry,
): void {
	state.moveChain = {
		participants: [casterId, targetId],
		stack: [entry],
		responderId: targetId,
		stackDepthAtLastSlow: 1,
	};
	state.phase = "move_chain_window";
}

export function pushToMoveChain(
	state: FaceturnServerState,
	entry: MoveChainEntry,
): void {
	if (!state.moveChain) return;
	const chain = state.moveChain;
	chain.stack.push(entry);
	const [p1, p2] = chain.participants;
	chain.responderId = chain.responderId === p1 ? p2 : p1;
	chain.stackDepthAtLastSlow = chain.stack.length;
}

export function recordChainPass(
	state: FaceturnServerState,
	passerId: string,
): boolean {
	if (!state.moveChain) return false;
	const chain = state.moveChain;

	if (passerId !== chain.responderId) return false;

	if (chain.stack.length === chain.stackDepthAtLastSlow) {
		return true;
	}

	const [p1, p2] = chain.participants;
	chain.responderId = chain.responderId === p1 ? p2 : p1;
	chain.stackDepthAtLastSlow = chain.stack.length;
	return false;
}

export function resolveMoveChainFull(state: FaceturnServerState): void {
	if (!state.moveChain) return;
	const { stack } = state.moveChain;

	while (stack.length > 0) {
		const entry = stack.pop()!;
		const actor = state.players.get(entry.actorId);
		if (!actor || state.eliminatedPlayers.has(entry.actorId)) continue;

		const move = getMove(entry.moveId);
		const isNegate = move.effects.some((e) => {
			const eff = isConditionalEffect(e) ? e.effect : e;
			return eff.type === "negate_enemy_slow_move";
		});
		const isReflect = move.effects.some((e) => {
			const eff = isConditionalEffect(e) ? e.effect : e;
			return eff.type === "reflect_slow_move_base_damage";
		});

		// resolve negate or reflect before anything else
		if (isNegate || isReflect) {
			actor.discardPile.push(entry.moveId);
			actor.totalCardsDiscarded++;
			actor.totalMovesPlayed++;

			if (stack.length > 0) {
				const targeted = stack.pop()!;
				const targetedActor = state.players.get(targeted.actorId);
				if (targetedActor) {
					if (isReflect) {
						resolveReflectedSlowMoveDamage(
							state,
							targeted.moveId,
							targeted.actorId,
						);
					}
					targetedActor.discardPile.push(targeted.moveId);
					targetedActor.totalCardsDiscarded++;
					targetedActor.totalMovesPlayed++;
				}
			}
			continue;
		}

		executeMove(state, actor, entry.moveId, {
			targetCrewSlot: entry.targetCrewSlot ?? undefined,
			targetAllySlot: entry.targetAllySlot ?? undefined,
			targetPlayerId: entry.targetPlayerId ?? undefined,
		});
	}
}

export function getMoveCost(
	player: FaceturnServerPlayer,
	moveId: string,
): number {
	const base = player.costOverrides.get(moveId) ?? getMove(moveId).baseCost;
	return Math.max(0, base - player.moveBaseCostReduction);
}

export function getClassActionCost(
	player: FaceturnServerPlayer,
	action: "strike" | "block" | "collect" | "unturn",
): number {
	switch (action) {
		case "strike":
			return C.STRIKE_CASH_COST;
		case "block":
			return Math.max(0, C.BLOCK_CASH_COST - player.blockCostReduction);
		case "collect":
			return C.COLLECT_CASH_COST;
		case "unturn":
			return C.UNTURN_CASH_COST;
	}
}

export function computeActorWasBluffing(
	actor: FaceturnServerPlayer,
	action: "strike" | "collect" | "unturn" | "block",
): boolean {
	const requiredClass = {
		strike: "striker",
		collect: "collector",
		unturn: "turner",
		block: "blocker",
	} as const;
	return !playerHasClass(actor, requiredClass[action]);
}

export { BOSS_MAP, CREW_MAP, MOVE_MAP, getBoss };