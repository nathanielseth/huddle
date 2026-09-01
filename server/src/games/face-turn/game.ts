import type {
	FaceturnServerState,
	FaceturnServerPlayer,
	GameConfig,
	DraftSelections,
} from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import type {
	RpsChoice,
	ResolutionResult,
	WinCondition,
	MoveChainEntry,
	MoveChainResolutionStep,
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
	VOID_PIECE_IDS,
	isDraftable,
	unwrapEffect,
} from "./cards";
import {
	resolveEffects,
	triggerRoundEndPassives,
	recomputePassives,
	getLivingPlayers,
	getEnemies,
	getTeammates,
	drawCards,
	firstTurnedSlot,
	playerHasClass,
	isConditionalEffect,
	resolveStrikeOrExecute,
	performStrike,
	resolveReflectedSlowMoveDamage,
	checkRatQueenDrawTrigger,
	maybeOpenBearBonesOffer,
	applySupplyDropOnCollect,
	applyTrickleDownOnCollect,
	applyCoolGuyDamageOnMovePlayed,
	executedPlayerIdFrom,
	hideCrewAtSlot,
	processWarrantOfArrestTicks,
} from "./effects";
import type { StrikeOrExecuteOutcome } from "./effects";
import { shuffle } from "../lib/random";
import { makeEmptyDerivedStats } from "./derived";
import { pushLog } from "./log";

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
		bossArmor: 0,
		bossImmunityTurns: 0,
		bossCommandUsed: false,
		lastHpZeroCause: null,
		crewIds: [null, null],
		crewTurned: [false, false],
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
		hasArmoredBossThisGame: false,
		hasTurnedAllyCrewThisGame: false,
		incomingPoison: new Map(),
		lifeInsuranceTargets: new Map(),
		trickleDownTargets: new Map(),
		ratQueenDrawUsedThisTurn: false,
		disabledPassiveSlots: new Set(),
		playedMoveThisTurn: false,
		classActionUsedThisTurn: false,
		costOverrides: new Map(),
		draftSelections: { bossId: null, crewIds: [], moveIds: [] },
		isDraftLocked: false,
		mulliganDecided: false,
		warrantMarks: new Map(),
		redHerringMark: null,
		derived: makeEmptyDerivedStats(),
	};
}

export function buildTeamsAndTurnOrder(
	config: GameConfig,
	playerIds: string[],
	rng: () => number = Math.random,
): {
	teams: string[][];
	turnOrder: string[];
	playerOrder: [string, string];
	teamIndexByPlayerId: Map<string, number>;
} {
	const teamIndexByPlayerId = new Map<string, number>();

	if (config.mode === "teams") {
		const configTeams = config.teams;
		if (
			!configTeams ||
			configTeams[0].length === 0 ||
			configTeams[1].length === 0
		) {
			throw new Error(
				"[face-turn] teams mode requires both teams to have at least one player.",
			);
		}
		const teams: string[][] = [configTeams[0], configTeams[1]];
		for (let ti = 0; ti < teams.length; ti++) {
			for (const pid of teams[ti]!) {
				teamIndexByPlayerId.set(pid, ti);
			}
		}
		const repA = teams[0]![Math.floor(rng() * teams[0]!.length)]!;
		const repB = teams[1]![Math.floor(rng() * teams[1]!.length)]!;
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
		const turnOrder = shuffle([...playerIds], rng);
		return { teams, turnOrder, playerOrder, teamIndexByPlayerId };
	}

	// duel
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

	// goFirst=false means the rps winner's team actually goes second
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

export function loadDraftSelections(
	player: FaceturnServerPlayer,
	proposed: { bossId: string | null; crewIds: string[]; moveIds: string[] },
): void {
	const bossId =
		proposed.bossId && BOSS_MAP.has(proposed.bossId) ? proposed.bossId : null;

	const crewCap =
		bossId === CARD_IDS.BOSS.THE_DEALER ? C.CREW_SLOTS + 1 : C.CREW_SLOTS;
	const crewIds: string[] = [];
	const seenCrewIds = new Set<string>();
	for (const id of proposed.crewIds) {
		if (crewIds.length >= crewCap) break;
		const crewDef = CREW_MAP.get(id);
		if (!crewDef || !isDraftable(crewDef) || seenCrewIds.has(id)) continue;
		crewIds.push(id);
		seenCrewIds.add(id);
	}

	const moveIds: string[] = [];
	const seenMoveIds = new Set<string>();
	for (const id of proposed.moveIds) {
		if (moveIds.length >= C.MOVES_PER_DECK) break;
		if (!MOVE_MAP.has(id) || seenMoveIds.has(id)) continue;
		moveIds.push(id);
		seenMoveIds.add(id);
	}

	player.draftSelections = { bossId, crewIds, moveIds };
}

export function finalizeDraft(
	player: FaceturnServerPlayer,
	rng: () => number = Math.random,
): void {
	const draft = player.draftSelections!;
	const boss = getBoss(draft.bossId!);

	player.bossId = boss.id;
	player.bossHp = boss.maxHp;
	player.bossMaxHp = boss.maxHp;
	player.bossArmor = boss.startingArmor ?? 0;

	// dealer drafts 3 crew: 2 in normal slots, 1 in reserve
	for (let i = 0; i < Math.min(draft.crewIds.length, C.CREW_SLOTS); i++) {
		player.crewIds[i as 0 | 1] = draft.crewIds[i]!;
	}
	if (boss.id === CARD_IDS.BOSS.THE_DEALER) {
		player.reserveCrewId = draft.crewIds[C.CREW_SLOTS] ?? null;
	}

	player.deck = shuffle(draft.moveIds, rng);
	player.draftSelections = null;
}

// hardcoded pairs where a card is a total fizzle unless the required cards are also in the same draft
const DEAD_WITHOUT: readonly {
	readonly cardId: string;
	readonly pool: "crew" | "move";
	readonly requires: readonly { id: string; pool: "crew" | "move" }[];
}[] = [
	// full-moon needs andrew
	{
		cardId: CARD_IDS.MOVE.FULL_MOON,
		pool: "move",
		requires: [{ id: CARD_IDS.CREW.ANDREW, pool: "crew" }],
	},
	// retro searches deck for chronotrix; fizzles if absent
	{
		cardId: CARD_IDS.CREW.RETRO,
		pool: "crew",
		requires: [{ id: CARD_IDS.MOVE.CHRONOTRIX, pool: "move" }],
	},
	// deleb-i only wins if all three void pieces are active
	{
		cardId: CARD_IDS.MOVE.DELEB_I,
		pool: "move",
		requires: VOID_PIECE_IDS.map((id) => ({ id, pool: "move" as const })),
	},
];

// checks whether prerequisite cards are absent from the final draft sets;
// safe regardless of draw order because we only check presence
function isDeadPick(
	id: string,
	pool: "crew" | "move",
	crewIds: readonly string[],
	moveIds: readonly string[],
): boolean {
	const rule = DEAD_WITHOUT.find((r) => r.cardId === id && r.pool === pool);
	if (!rule) return false;
	return rule.requires.some((req) =>
		req.pool === "crew" ? !crewIds.includes(req.id) : !moveIds.includes(req.id),
	);
}

export function randomizeDraftSelections(
	draft: DraftSelections,
	rng: () => number = Math.random,
): void {
	if (!draft.bossId) {
		draft.bossId = BOSSES[Math.floor(rng() * BOSSES.length)]!.id;
	}

	const maxCrewes =
		draft.bossId === CARD_IDS.BOSS.THE_DEALER ? C.CREW_SLOTS + 1 : C.CREW_SLOTS;
	const maxMoves = C.MOVES_PER_DECK;

	// check existing manual picks before filling, so prerequisite cards can still be added later
	const availableCrewes = CREW.filter(
		(h) => isDraftable(h) && !draft.crewIds.includes(h.id),
	);
	while (draft.crewIds.length < maxCrewes && availableCrewes.length) {
		const idx = Math.floor(rng() * availableCrewes.length);
		const pick = availableCrewes.splice(idx, 1)[0]!;
		if (isDeadPick(pick.id, "crew", draft.crewIds, draft.moveIds)) continue;
		draft.crewIds.push(pick.id);
	}

	const availableMoves = MOVES.filter((s) => !draft.moveIds.includes(s.id));
	while (draft.moveIds.length < maxMoves && availableMoves.length) {
		const idx = Math.floor(rng() * availableMoves.length);
		const pick = availableMoves.splice(idx, 1)[0]!;
		if (isDeadPick(pick.id, "move", draft.crewIds, draft.moveIds)) continue;
		draft.moveIds.push(pick.id);
	}

	// second pass: picks that were dead earlier might be alive now, fill remaining slots
	if (draft.crewIds.length < maxCrewes || draft.moveIds.length < maxMoves) {
		fillRemainingIgnoringDeadPicks(draft, maxCrewes, maxMoves, rng);
	}
}

export function randomizeEmptyDraftSlots(
	player: FaceturnServerPlayer,
	rng: () => number = Math.random,
): void {
	randomizeDraftSelections(player.draftSelections!, rng);
}

// fallback when every candidate was dead on first draw; re-scans once, admits anything not permanently dead
function fillRemainingIgnoringDeadPicks(
	draft: { crewIds: string[]; moveIds: string[] },
	maxCrewes: number,
	maxMoves: number,
	rng: () => number,
): void {
	if (draft.crewIds.length < maxCrewes) {
		const rest = shuffle(
			CREW.flatMap((h) =>
				isDraftable(h) && !draft.crewIds.includes(h.id) ? [h.id] : [],
			),
			rng,
		);
		for (const id of rest) {
			if (draft.crewIds.length >= maxCrewes) break;
			if (isDeadPick(id, "crew", draft.crewIds, draft.moveIds)) continue;
			draft.crewIds.push(id);
		}
	}
	if (draft.moveIds.length < maxMoves) {
		const rest = shuffle(
			MOVES.flatMap((s) => (!draft.moveIds.includes(s.id) ? [s.id] : [])),
			rng,
		);
		for (const id of rest) {
			if (draft.moveIds.length >= maxMoves) break;
			if (isDeadPick(id, "move", draft.crewIds, draft.moveIds)) continue;
			draft.moveIds.push(id);
		}
	}
}

export function autoFillAndFinalizeDraft(
	player: FaceturnServerPlayer,
	rng: () => number = Math.random,
): void {
	randomizeEmptyDraftSlots(player, rng);
	finalizeDraft(player, rng);
	player.isDraftLocked = true;
}

export function dealOpeningHand(player: FaceturnServerPlayer): void {
	drawCards(player, C.OPENING_HAND_SIZE);
}

export function mulliganPlayer(
	player: FaceturnServerPlayer,
	redraw: boolean,
	rng: () => number = Math.random,
): void {
	if (!redraw) return;
	player.deck.push(...player.hand.splice(0));
	player.deck = shuffle(player.deck, rng);
	drawCards(player, C.OPENING_HAND_SIZE);
}

export type RpsOutcome = "player1" | "player2";

export function resolveRps(
	p1: string,
	p2: string,
	choices: Map<string, RpsChoice>,
	rng: () => number = Math.random,
): RpsOutcome {
	const c1 = choices.get(p1)!;
	const c2 = choices.get(p2)!;

	if (!c1 || !c2 || c1 === c2) {
		return rng() < 0.5 ? "player1" : "player2";
	}
	if (
		(c1 === "rock" && c2 === "scissors") ||
		(c1 === "scissors" && c2 === "paper") ||
		(c1 === "paper" && c2 === "rock")
	)
		return "player1";
	return "player2";
}

function addPassiveCash(player: FaceturnServerPlayer, gain: number): void {
	player.cash = Math.max(
		player.cash,
		Math.min(player.cash + gain, C.PASSIVE_CASH_CAP),
	);
}

export function startTurn(state: FaceturnServerState, playerId: string): void {
	state.activePlayerId = playerId;
	state.pendingAction = null;

	pushLog(state, {
		kind: "turn_start",
		playerId,
		roundNumber: state.roundNumber,
	});

	const player = state.players.get(playerId)!;
	player.classActionUsedThisTurn = false;
	player.ratQueenDrawUsedThisTurn = false;

	drawCards(player, 1);
	addPassiveCash(player, 1);

	if (player.derived.cashGainPerTurn > 0) {
		addPassiveCash(player, player.derived.cashGainPerTurn);
	}
	if (player.derived.drawPerTurn > 0) {
		drawCards(player, player.derived.drawPerTurn);
	}
	if (player.derived.armorPerTurn > 0) {
		player.bossArmor += player.derived.armorPerTurn;
		player.hasArmoredBossThisGame = true;
	}
	if (
		player.derived.selfDamagePerTurn > 0 ||
		player.derived.selfDamageCashGainAmount > 0
	) {
		resolveEffects(
			[
				{
					type: "deal_damage_self_boss",
					amount: player.derived.selfDamagePerTurn,
				},
				{ type: "gain_cash", amount: player.derived.selfDamageCashGainAmount },
			],
			{ state, actor: player },
		);
	}

	processWarrantOfArrestTicks(state, player);

	checkRatQueenDrawTrigger(player, state);

	// void legs offer: only opens if there is a card to discard
	if (player.derived.hasVoidLegsChoice && player.hand.length > 0) {
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

function eliminatePlayer(
	state: FaceturnServerState,
	playerId: string,
	cause: "boss_hp_zero_execution" | "boss_hp_zero_damage",
): void {
	if (state.eliminatedPlayers.has(playerId)) return;

	state.eliminatedPlayers.add(playerId);
	pushLog(state, { kind: "player_eliminated", playerId, cause });

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
			state.phase === "defend_declared"
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

// tiebreaker: highest total hp, then fewest turned crew; draw if still tied
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

	const toEliminate: {
		playerId: string;
		winCondition: "boss_hp_zero_execution" | "boss_hp_zero_damage";
	}[] = [];
	for (const player of living) {
		if (player.bossHp <= 0) {
			toEliminate.push({
				playerId: player.playerId,
				winCondition:
					player.lastHpZeroCause === "execution"
						? "boss_hp_zero_execution"
						: "boss_hp_zero_damage",
			});
		}
	}

	for (const { playerId, winCondition } of toEliminate) {
		eliminatePlayer(state, playerId, winCondition);
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
	pushLog(state, { kind: "game_won", winnerId, winCondition });
}

// list actor's own slots first so ui defaults to hiding own crew
function watcherEligibleTargets(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
): { playerId: string; slot: 0 | 1 }[] {
	const targets: { playerId: string; slot: 0 | 1 }[] = [];
	for (const i of [0, 1] as const) {
		if (actor.crewIds[i] !== null && actor.crewTurned[i]) {
			targets.push({ playerId: actor.playerId, slot: i });
		}
	}
	for (const mate of getTeammates(state, actor.playerId)) {
		for (const i of [0, 1] as const) {
			if (mate.crewIds[i] !== null && mate.crewTurned[i]) {
				targets.push({ playerId: mate.playerId, slot: i });
			}
		}
	}
	return targets;
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
		const outcome = resolveStrikeOrExecute(
			state,
			challenger,
			pending.actorId,
			false,
		);

		// challenger gets a face‑up penalty; if 2+ face‑down crew exist, resolveStrikeOrExecute opens a choose_crew_to_turn interaction
		// tag it as pending, and dont run executePendingAction until it closes to avoid overwriting
		if (
			outcome.outcome === "pending" &&
			state.pendingInteraction?.type === "choose_crew_to_turn"
		) {
			state.pendingInteraction = {
				...state.pendingInteraction,
				deferredActionPending: true,
			};
		}

		// the watcher: won the challenge by successfully defending against it (actor wasn't bluffing)
		if (state.pendingInteraction === null) {
			if (actor.derived.hasWatcherPassive) {
				drawCards(actor, 2);
				const eligibleTargets = watcherEligibleTargets(state, actor);
				if (eligibleTargets.length > 0) {
					state.pendingInteraction = {
						type: "watcher_hide_offer",
						actorId: pending.actorId,
						eligibleTargets,
					};
				}
			}
		}

		if (actor.derived.cashOnChallengeWinAmount > 0) {
			actor.cash += actor.derived.cashOnChallengeWinAmount;
		}

		pushLog(state, {
			kind: "challenge_resolved",
			challengerId,
			actorId: pending.actorId,
			success: false,
		});

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

	// false flag: prevents the crew-turning consequence; the challenger still gets credit
	if (actor.derived.hasFalseFlag) {
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

	// the watcher: the challenger also gets this if they just won the challenge
	if (
		state.pendingInteraction === null &&
		challenger.derived.hasWatcherPassive
	) {
		drawCards(challenger, 2);
		const eligibleTargets = watcherEligibleTargets(state, challenger);
		if (eligibleTargets.length > 0) {
			state.pendingInteraction = {
				type: "watcher_hide_offer",
				actorId: challenger.playerId,
				eligibleTargets,
			};
		}
	}
	if (state.pendingInteraction === null) {
		maybeOpenBearBonesOffer(state, challenger, pending.actorId);
	}

	// extortion: same unconditional-grant reasoning as the actor's branch above
	if (challenger.derived.cashOnChallengeWinAmount > 0) {
		challenger.cash += challenger.derived.cashOnChallengeWinAmount;
	}

	pushLog(state, {
		kind: "challenge_resolved",
		challengerId,
		actorId: pending.actorId,
		success: true,
	});

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
			addPassiveCash(actor, C.COLLECT_CASH_GAIN);
			applySupplyDropOnCollect(state, actor);
			applyTrickleDownOnCollect(state, actor, C.COLLECT_CASH_GAIN);
			return null;
		}
		case "class_action_hide": {
			const hideTarget = pending.targetPlayerId
				? (state.players.get(pending.targetPlayerId) ?? actor)
				: actor;
			const slot =
				(pending.targetAllySlot as 0 | 1 | null) ?? firstTurnedSlot(hideTarget);
			if (slot !== null && hideTarget.crewIds[slot]) {
				hideCrewAtSlot(state, hideTarget, slot);
				recomputePassives(hideTarget, state);
			}
			return null;
		}
		case "class_action_defend": {
			return null;
		}
	}
	return null;
}

interface MoveTarget {
	targetCrewSlot?: number | undefined;
	targetAllySlot?: number | undefined;
	targetPlayerId?: string | undefined;
	targetActiveMoveSlot?: number | undefined;
	placeInActiveSlot?: number | undefined;
}

export function executeMove(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	moveId: string,
	targets: MoveTarget = {},
	damageAccumulator?: { value: number },
): void {
	const move = getMove(moveId);

	pushLog(state, {
		kind: "move_played",
		actorId: actor.playerId,
		moveId,
		targetPlayerId: targets.targetPlayerId ?? null,
	});

	actor.costOverrides.delete(moveId);

	let claimedSlot = -1;
	if (move.moveType === "active") {
		const requestedSlot = targets.placeInActiveSlot;
		claimedSlot =
			requestedSlot !== undefined &&
			requestedSlot >= 0 &&
			requestedSlot < actor.activeMoves.length &&
			actor.activeMoves[requestedSlot] === null
				? requestedSlot
				: actor.activeMoves.findIndex((s) => s === null);
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
		targetActiveMoveSlot: targets.targetActiveMoveSlot,
		moveId,
		damageAccumulator,
	});

	actor.totalMovesPlayed++;

	if (actor.derived.healOnMovePlayed > 0) {
		actor.bossHp = Math.min(
			actor.bossHp + actor.derived.healOnMovePlayed,
			actor.bossMaxHp,
		);
	}

	applyCoolGuyDamageOnMovePlayed(state, actor);

	const enemies = getEnemies(state, actor.playerId);
	for (const enemy of enemies) {
		if (enemy.derived.cashOnEnemyMoveOrStrike > 0) {
			enemy.cash += enemy.derived.cashOnEnemyMoveOrStrike;
		}
	}

	if (move.moveType === "active") {
		if (claimedSlot !== -1) {
			recomputePassives(actor, state);
			// global disable effects like blackmail need all players recomputed immediately
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

// playing a slow move opens the chain and immediately hands priority to
// the target — it's still the caster's turn, but the target now has the
// only window to act (respond with their own slow move, or pass).
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
	};
	state.phase = "move_chain_window";
}

// pushing a slow move always hands priority to the other participant —
// you can't stack a second slow move on your own without them getting a
// chance to respond first.
export function pushToMoveChain(
	state: FaceturnServerState,
	entry: MoveChainEntry,
): void {
	if (!state.moveChain) return;
	const chain = state.moveChain;
	chain.stack.push(entry);
	const [p1, p2] = chain.participants;
	chain.responderId = entry.actorId === p1 ? p2 : p1;
}

export function resolveMoveChainFull(state: FaceturnServerState): void {
	if (!state.moveChain) return;
	const { stack, participants } = state.moveChain;

	const steps: MoveChainResolutionStep[] = [];

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

			let negatedMoveId: string | null = null;
			let negatedActorId: string | null = null;
			let reflectedDamage: number | null = null;

			if (stack.length > 0) {
				const targeted = stack.pop()!;
				const targetedActor = state.players.get(targeted.actorId);
				if (targetedActor) {
					negatedMoveId = targeted.moveId;
					negatedActorId = targeted.actorId;
					if (isReflect) {
						reflectedDamage = resolveReflectedSlowMoveDamage(
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

			steps.push(
				isReflect
					? {
							kind: "reflected",
							negatorMoveId: entry.moveId,
							negatorActorId: entry.actorId,
							negatedMoveId,
							negatedActorId,
							reflectedDamage,
						}
					: {
							kind: "negated",
							negatorMoveId: entry.moveId,
							negatorActorId: entry.actorId,
							negatedMoveId,
							negatedActorId,
						},
			);
			continue;
		}

		const damageAccumulator = { value: 0 };
		executeMove(
			state,
			actor,
			entry.moveId,
			{
				targetCrewSlot: entry.targetCrewSlot ?? undefined,
				targetAllySlot: entry.targetAllySlot ?? undefined,
				targetPlayerId: entry.targetPlayerId ?? undefined,
			},
			damageAccumulator,
		);
		steps.push({
			kind: "executed",
			moveId: entry.moveId,
			actorId: entry.actorId,
			damageDealt: damageAccumulator.value > 0 ? damageAccumulator.value : null,
		});
	}

	state.lastChainResolution = { steps };

	if (steps.length > 0) {
		pushLog(state, {
			kind: "move_chain_resolved",
			participants,
			steps,
		});
	}
}

export function getMoveCost(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	moveId: string,
): number {
	const move = getMove(moveId);
	const base = player.costOverrides.get(moveId) ?? move.baseCost;

	let reduction = player.derived.moveBaseCostReduction;
	if (move.moveType === "burst") {
		reduction += player.derived.burstMoveCostReduction;
	}

	const surcharge = getEnemies(state, player.playerId).reduce(
		(sum, enemy) => sum + enemy.derived.enemyMoveCostSurcharge,
		0,
	);

	return Math.max(0, base - reduction + surcharge);
}

export function effectiveCost(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	moveId: string,
): number {
	const base = getMoveCost(state, player, moveId);
	if (
		moveId === CARD_IDS.MOVE.CLAIM_THE_BOUNTY &&
		player.hasCalledBluffSuccessfully
	) {
		return 0;
	}
	return base;
}

export function getClassActionCost(
	player: FaceturnServerPlayer,
	action: "strike" | "defend" | "collect" | "hide",
): number {
	const base = (() => {
		switch (action) {
			case "strike":
				return C.STRIKE_CASH_COST;
			case "defend":
				return C.DEFEND_CASH_COST;
			case "collect":
				return C.COLLECT_CASH_COST;
			case "hide":
				return C.HIDE_CASH_COST;
		}
	})();
	return Math.max(0, base - player.derived.classActionCostReduction);
}

export function computeActorWasBluffing(
	actor: FaceturnServerPlayer,
	action: "strike" | "collect" | "hide" | "defend",
): boolean {
	const requiredClass = {
		strike: "striker",
		collect: "collector",
		hide: "hider",
		defend: "defender",
	} as const;
	return !playerHasClass(actor, requiredClass[action]);
}

export { getBoss };