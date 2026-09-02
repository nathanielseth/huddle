import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { CrewClass } from "../../../../../shared/games/face-turn/types";
import { FACETURN_CONSTANTS as C } from "../types";
import type {
	FaceturnServerPlayer,
	FaceturnServerState,
	DraftSelections,
} from "../types";
import {
	getMove,
	getBoss,
	getMoveTargetScope,
	unwrapEffect,
	CARD_IDS,
} from "../cards";
import {
	getEnemies,
	getTeammates,
	firstTurnedSlot,
	firstUnturnedSlot,
	isStrikeDefendedByTerminal,
	moveHasLegalTarget,
	requiresStrictAllyTarget,
} from "../effects";
import {
	isDraftValid,
	effectiveCost as sharedEffectiveCost,
	randomizeDraftSelections,
} from "../game";
import { computeChainPlayableMoveIds } from "../state-builders";

const CREW_CLASSES: readonly CrewClass[] = [
	"striker",
	"defender",
	"collector",
	"hider",
];

// delegates to shared effectiveCost; getMoveCost is unused here but kept for interface compatibility
function effectiveCost(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	moveId: string,
	getMoveCost: (
		state: FaceturnServerState,
		player: FaceturnServerPlayer,
		moveId: string,
	) => number,
): number {
	void getMoveCost;
	return sharedEffectiveCost(state, player, moveId);
}

export interface EngineHelpers {
	readonly getMoveCost: (
		state: FaceturnServerState,
		player: FaceturnServerPlayer,
		moveId: string,
	) => number;
	readonly getClassActionCost: (
		player: FaceturnServerPlayer,
		action: "strike" | "defend" | "collect" | "hide",
	) => number;
	readonly computeActorWasBluffing: (
		actor: FaceturnServerPlayer,
		action: "strike" | "collect" | "hide" | "defend",
	) => boolean;
}

// must mirror engine.ts validation so the search tree never proposes an illegal move that would silently no-op
export function getLegalActions(
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
	rng: () => number = Math.random,
): FaceturnsAction[] {
	const player = state.players.get(seat);
	if (!player) return [];
	if (state.eliminatedPlayers.has(seat)) return [];

	if (state.pendingInteraction !== null) {
		return legalInteractionActions(state, seat);
	}

	switch (state.phase) {
		case "drafting":
			return legalDraftingActions(player, rng);
		case "rps":
			return legalRpsActions(state, seat, rng);
		case "rps_order_choice":
			return legalRpsOrderChoiceActions(state, seat, rng);
		case "mulligan":
			return legalMulliganActions(player);
		case "active_turn":
			return state.activePlayerId === seat
				? legalActiveTurnActions(state, player, helpers)
				: [];
		case "move_chain_window":
			return legalMoveChainActions(state, seat, player);
		case "challenge_window":
			return legalChallengeWindowActions(state, seat, helpers);
		case "defend_window":
			return legalDefendWindowActions(state, seat, helpers);
		case "defend_declared":
			return legalDefendDeclaredActions(state, seat);
		default:
			return [];
	}
}

function legalDraftingActions(
	player: FaceturnServerPlayer,
	rng: () => number,
): FaceturnsAction[] {
	if (player.isDraftLocked) return [];
	if (isDraftValid(player)) return [{ type: "lock_draft" }];

	const draft: DraftSelections = { bossId: null, crewIds: [], moveIds: [] };
	randomizeDraftSelections(draft, rng);
	return [
		{
			type: "load_draft",
			bossId: draft.bossId!,
			crewIds: [...draft.crewIds],
			moveIds: [...draft.moveIds],
		},
	];
}

// only the two seat representatives (duel/teams captains) ever choose in rps; ffa skips the phase entirely
function legalRpsActions(
	state: FaceturnServerState,
	seat: string,
	rng: () => number,
): FaceturnsAction[] {
	if (state.mode === "ffa") return [];
	const [rep1, rep2] = state.playerOrder;
	if (seat !== rep1 && seat !== rep2) return [];
	if (state.rpsChoices.has(seat)) return [];

	const choices = ["rock", "paper", "scissors"] as const;
	const choice = choices[Math.floor(rng() * choices.length)]!;
	return [{ type: "rps_choice", choice }];
}

// only the rps winner acts here; the timeout defaults to going first, so bias the cpu's pick the same way to avoid determinism
function legalRpsOrderChoiceActions(
	state: FaceturnServerState,
	seat: string,
	rng: () => number,
): FaceturnsAction[] {
	if (seat !== state.rpsOrderChoiceWinnerId) return [];
	const goFirst = rng() < 0.85;
	return [{ type: "rps_order_choice", goFirst }];
}

function legalMulliganActions(player: FaceturnServerPlayer): FaceturnsAction[] {
	if (player.mulliganDecided) return [];
	return [{ type: "mulligan", redraw: false }];
}

function activeMoveSlotsAreFullAndDefendingAnAffordableHandMove(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	getMoveCost: EngineHelpers["getMoveCost"],
): boolean {
	const slotsFull =
		player.activeMoves.filter((m) => m !== null).length >=
		C.MAX_ACTIVE_MOVE_SLOTS;
	if (!slotsFull) return false;

	const seenMoveIds = new Set<string>();
	for (const moveId of player.hand) {
		if (seenMoveIds.has(moveId)) continue;
		seenMoveIds.add(moveId);

		const move = getMove(moveId);
		if (move.moveType !== "active") continue;

		const cost = effectiveCost(state, player, moveId, getMoveCost);
		if (player.cash >= cost) return true;
	}

	return false;
}

function legalActiveTurnActions(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	const actions: FaceturnsAction[] = [];
	const seat = player.playerId;

	actions.push(...legalPlayMoveActions(state, player, helpers));
	actions.push(...legalClassActionDeclares(state, player, helpers));
	actions.push(...legalBossCommandActions(state, player));
	actions.push(...legalFaceTurnActions(state, player));
	actions.push({ type: "end_turn" });

	// only offer discard when active slots are full and a playable active move is in hand to swap in
	if (
		activeMoveSlotsAreFullAndDefendingAnAffordableHandMove(
			state,
			player,
			helpers.getMoveCost,
		)
	) {
		for (let i = 0; i < player.activeMoves.length; i++) {
			if (player.activeMoves[i] !== null) {
				actions.push({ type: "discard_active_move", slotIndex: i });
			}
		}
	}

	if (player.derived.hasSellCards) {
		const seenSellIds = new Set<string>();
		for (const moveId of player.hand) {
			if (seenSellIds.has(moveId)) continue;
			seenSellIds.add(moveId);
			actions.push({ type: "sell_move", moveId });
		}
	}

	void seat;
	return actions;
}

function legalPlayMoveActions(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	const actions: FaceturnsAction[] = [];
	const seenMoveIds = new Set<string>();
	const hasOpenActiveSlot = player.activeMoves.some((s) => s === null);

	for (const moveId of player.hand) {
		// duplicate move ids in hand have identical legal targets, so expand only once
		if (seenMoveIds.has(moveId)) continue;
		seenMoveIds.add(moveId);

		const move = getMove(moveId);
		const cost = effectiveCost(state, player, moveId, helpers.getMoveCost);
		if (player.cash < cost) continue;

		if (move.moveType === "active" && !hasOpenActiveSlot) {
			continue;
		}

		// mirror play_move gate: never offer moves without a legal target
		if (!moveHasLegalTarget(state, player.playerId, move)) continue;

		const isDefendableStrike = move.effects.some((e) => {
			const eff = unwrapEffect(e);
			return eff.type === "strike_enemy_crew_defendable";
		});

		if (isDefendableStrike) {
			for (const enemy of getEnemies(state, player.playerId)) {
				const faceDownSlots = eligibleFaceDownSlots(enemy);
				const faceUpSlots = eligibleFaceUpSlots(enemy);

				if (faceDownSlots.length === 0 && faceUpSlots.length === 0) {
					actions.push({
						type: "play_move",
						moveId,
						targetPlayerId: enemy.playerId,
					});
					continue;
				}

				for (const slot of faceDownSlots) {
					actions.push({
						type: "play_move",
						moveId,
						targetPlayerId: enemy.playerId,
						targetCrewSlot: slot,
					});
				}
				// a face-up crew can also be targeted directly to kill it
				for (const slot of faceUpSlots) {
					actions.push({
						type: "play_move",
						moveId,
						targetPlayerId: enemy.playerId,
						targetCrewSlot: slot,
					});
				}
			}
			continue;
		}

		// warrant of arrest: requires explicit enemy face-down slot; no fallback, so enumerate real candidates
		const needsEnemyFaceDownCrewSlot = move.effects.some(
			(e) => unwrapEffect(e).type === "mark_enemy_crew_for_delayed_turn",
		);
		if (needsEnemyFaceDownCrewSlot) {
			for (const enemy of getEnemies(state, player.playerId)) {
				for (const slot of eligibleFaceDownSlots(enemy)) {
					actions.push({
						type: "play_move",
						moveId,
						targetPlayerId: enemy.playerId,
						targetCrewSlot: slot,
					});
				}
			}
			continue;
		}

		// sabotage: discard_targeted_enemy_active_move also has no fallback; fizzles without targetActiveMoveSlot
		const needsEnemyActiveMoveSlot = move.effects.some(
			(e) => unwrapEffect(e).type === "discard_targeted_enemy_active_move",
		);
		if (needsEnemyActiveMoveSlot) {
			// moveHasLegalTarget above guarantees at least one enemy has a filled active-move slot
			for (const enemy of getEnemies(state, player.playerId)) {
				for (const slot of eligibleActiveMoveSlots(enemy)) {
					actions.push({
						type: "play_move",
						moveId,
						targetPlayerId: enemy.playerId,
						targetActiveMoveSlot: slot,
					});
				}
			}
			continue;
		}

		const scope = getMoveTargetScope(move);
		if (scope === "none") {
			actions.push({ type: "play_move", moveId });
			continue;
		}

		// strict ally targets exclude self entirely
		const targets =
			scope === "enemy"
				? getEnemies(state, player.playerId)
				: requiresStrictAllyTarget(move)
					? getTeammates(state, player.playerId)
					: [player, ...getTeammates(state, player.playerId)];

		if (targets.length === 0) continue;

		for (const target of targets) {
			actions.push({
				type: "play_move",
				moveId,
				targetPlayerId: target.playerId,
			});
		}
	}

	return actions;
}

function legalClassActionDeclares(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	if (player.classActionUsedThisTurn) return [];
	const actions: FaceturnsAction[] = [];

	const tryDeclare = (
		action: "strike" | "collect" | "hide",
		build: () => FaceturnsAction[],
	) => {
		const wouldBeBluffing = helpers.computeActorWasBluffing(player, action);
		if (wouldBeBluffing && firstUnturnedSlot(player) === null) return;
		const cost = helpers.getClassActionCost(player, action);
		if (player.cash < cost) return;
		actions.push(...build());
	};

	tryDeclare("strike", () => {
		const out: FaceturnsAction[] = [];
		for (const enemy of getEnemies(state, player.playerId)) {
			if (isStrikeDefendedByTerminal(enemy)) continue;

			out.push({
				type: "declare_class_action",
				action: "strike",
				targetPlayerId: enemy.playerId,
			});
			// striking an already face-up crew kills it
			for (const slot of eligibleFaceUpSlots(enemy)) {
				out.push({
					type: "declare_class_action",
					action: "strike",
					targetPlayerId: enemy.playerId,
					targetCrewSlot: slot,
				});
			}
		}
		return out;
	});

	tryDeclare("collect", () => [
		{ type: "declare_class_action", action: "collect" },
	]);

	tryDeclare("hide", () => {
		if (firstTurnedSlot(player) === null) return [];
		const out: FaceturnsAction[] = [];
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (player.crewIds[slot] && player.crewTurned[slot]) {
				out.push({
					type: "declare_class_action",
					action: "hide",
					targetAllySlot: slot,
				});
			}
		}
		return out;
	});

	return actions;
}

function legalBossCommandActions(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): FaceturnsAction[] {
	if (player.bossCommandUsed || !player.bossId) return [];
	const boss = getBoss(player.bossId);
	const actions: FaceturnsAction[] = [];

	if (boss.id === CARD_IDS.BOSS.THE_RAZOR) {
		for (const enemy of getEnemies(state, player.playerId)) {
			for (let i = 0; i < 2; i++) {
				const slot = i as 0 | 1;
				if (!enemy.crewIds[slot] || enemy.crewTurned[slot]) continue;
				for (const guessClass of CREW_CLASSES) {
					actions.push({
						type: "use_boss_command",
						guessClass,
						targetCrewSlot: slot,
						targetPlayerId: enemy.playerId,
					});
				}
			}
		}
		return actions;
	}

	if (boss.id === CARD_IDS.BOSS.THE_DEALER) {
		if (player.reserveCrewId === null) return [];
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (player.crewIds[slot] && player.crewTurned[slot]) {
				actions.push({ type: "use_boss_command", targetAllySlot: slot });
			}
		}
		return actions;
	}

	actions.push({ type: "use_boss_command" });
	for (const enemy of getEnemies(state, player.playerId)) {
		actions.push({ type: "use_boss_command", targetPlayerId: enemy.playerId });
	}
	return actions;
}

function legalFaceTurnActions(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): FaceturnsAction[] {
	if (player.cash < C.BOSS_FACE_TURN_COST) return [];
	const actions: FaceturnsAction[] = [];

	for (const enemy of getEnemies(state, player.playerId)) {
		const faceDownSlots = eligibleFaceDownSlots(enemy);
		const faceUpSlots = eligibleFaceUpSlots(enemy);

		if (faceDownSlots.length === 0 && faceUpSlots.length === 0) {
			// no crew left on this enemy: untargeted use_face_turn resolves straight to execute
			actions.push({ type: "use_face_turn", targetPlayerId: enemy.playerId });
			continue;
		}

		for (const slot of faceDownSlots) {
			actions.push({
				type: "use_face_turn",
				targetPlayerId: enemy.playerId,
				targetCrewSlot: slot,
			});
		}
		for (const slot of faceUpSlots) {
			actions.push({
				type: "use_face_turn",
				targetPlayerId: enemy.playerId,
				targetCrewSlot: slot,
			});
		}
	}

	return actions;
}

function eligibleFaceDownSlots(player: FaceturnServerPlayer): (0 | 1)[] {
	const slots: (0 | 1)[] = [];
	for (let i = 0; i < 2; i++) {
		const slot = i as 0 | 1;
		if (player.crewIds[slot] && !player.crewTurned[slot]) slots.push(slot);
	}
	return slots;
}

function eligibleFaceUpSlots(player: FaceturnServerPlayer): (0 | 1)[] {
	const slots: (0 | 1)[] = [];
	for (let i = 0; i < 2; i++) {
		const slot = i as 0 | 1;
		if (player.crewIds[slot] && player.crewTurned[slot]) slots.push(slot);
	}
	return slots;
}

function eligibleActiveMoveSlots(player: FaceturnServerPlayer): (0 | 1 | 2)[] {
	const slots: (0 | 1 | 2)[] = [];
	for (let i = 0; i < player.activeMoves.length; i++) {
		if (player.activeMoves[i] !== null) slots.push(i as 0 | 1 | 2);
	}
	return slots;
}

function legalMoveChainActions(
	state: FaceturnServerState,
	seat: string,
	player: FaceturnServerPlayer,
): FaceturnsAction[] {
	const chain = state.moveChain;
	if (!chain) return [];
	if (seat !== chain.participants[0] && seat !== chain.participants[1]) {
		return [];
	}

	// only the seat with priority may act: slow always, burst only if also turn player, plus pass
	// delegate to computeChainPlayableMoveIds (server-authoritative) instead of re-deriving rules to avoid drift
	const isResponder = seat === chain.responderId;
	const actions: FaceturnsAction[] = isResponder
		? [{ type: "chain_pass" }]
		: [];

	const playableMoveIds = new Set(computeChainPlayableMoveIds(state, player));
	const seenMoveIds = new Set<string>();

	for (const moveId of player.hand) {
		if (seenMoveIds.has(moveId)) continue;
		seenMoveIds.add(moveId);

		if (!playableMoveIds.has(moveId)) continue;
		const move = getMove(moveId);

		const needsEnemyActiveMoveSlot = move.effects.some(
			(e) => unwrapEffect(e).type === "discard_targeted_enemy_active_move",
		);
		if (needsEnemyActiveMoveSlot && move.moveType === "burst") {
			// same sabotage targeting as in active turn
			for (const enemy of getEnemies(state, seat)) {
				for (const slot of eligibleActiveMoveSlots(enemy)) {
					actions.push({
						type: "chain_play_burst",
						moveId,
						targetPlayerId: enemy.playerId,
						targetActiveMoveSlot: slot,
					});
				}
			}
			continue;
		}

		const kind =
			move.moveType === "burst" ? "chain_play_burst" : "chain_play_slow";

		const scope = getMoveTargetScope(move);
		if (scope === "none") {
			actions.push({ type: kind, moveId });
			continue;
		}

		const targets =
			scope === "enemy"
				? getEnemies(state, seat)
				: requiresStrictAllyTarget(move)
					? getTeammates(state, seat)
					: [player, ...getTeammates(state, seat)];

		for (const target of targets) {
			actions.push({
				type: kind,
				moveId,
				targetPlayerId: target.playerId,
			});
		}
	}

	return actions;
}

function legalChallengeWindowActions(
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	if (!state.challengeEligiblePlayerIds.includes(seat)) return [];
	const pending = state.pendingAction;
	const actions: FaceturnsAction[] = [
		{ type: "challenge" },
		{ type: "pass_challenge" },
	];

	if (pending && pending.type === "class_action_strike") {
		const defender = state.players.get(seat);
		if (defender) {
			const wouldBeBluffing = helpers.computeActorWasBluffing(
				defender,
				"defend",
			);
			const canPayBluff =
				!wouldBeBluffing || firstUnturnedSlot(defender) !== null;
			const cost = helpers.getClassActionCost(defender, "defend");
			if (canPayBluff && defender.cash >= cost) {
				actions.push({ type: "defend" });
			}
		}
	}

	return actions;
}

function legalDefendWindowActions(
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	const pending = state.pendingAction;
	if (!pending?.targetPlayerId) return [];
	if (!isEligibleDefender(state, seat, pending.targetPlayerId)) return [];

	const defender = state.players.get(seat);
	if (!defender) return [];

	const wouldBeBluffing = helpers.computeActorWasBluffing(defender, "defend");
	if (wouldBeBluffing && firstUnturnedSlot(defender) === null) return [];
	const cost = helpers.getClassActionCost(defender, "defend");
	if (defender.cash < cost) return [];

	return [{ type: "defend" }];
}

function isEligibleDefender(
	state: FaceturnServerState,
	candidateSeat: string,
	targetPlayerId: string,
): boolean {
	if (state.eliminatedPlayers.has(targetPlayerId)) return false;
	if (!state.players.has(targetPlayerId)) return false;
	if (candidateSeat === targetPlayerId) return true;
	if (state.eliminatedPlayers.has(candidateSeat)) return false;
	return getTeammates(state, targetPlayerId).some(
		(t) => t.playerId === candidateSeat,
	);
}

function legalDefendDeclaredActions(
	state: FaceturnServerState,
	seat: string,
): FaceturnsAction[] {
	const pending = state.pendingAction;
	if (!pending || pending.targetPlayerId !== seat) return [];

	const actions: FaceturnsAction[] = [{ type: "accept_defend" }];
	if (pending.originalActionType !== "card_strike") {
		actions.push({ type: "challenge_defend" });
	}
	return actions;
}

function legalInteractionActions(
	state: FaceturnServerState,
	seat: string,
): FaceturnsAction[] {
	const interaction = state.pendingInteraction;
	if (!interaction) return [];

	const responder =
		interaction.type === "choose_crew_to_turn"
			? interaction.chooserPlayerId
			: interaction.type === "truth_serum_reveal"
				? interaction.targetPlayerId
				: interaction.actorId;
	if (seat !== responder) return [];

	switch (interaction.type) {
		case "peek_discard": {
			const enemies = getEnemies(state, seat);
			const seen = new Set<string>();
			const actions: FaceturnsAction[] = [];
			for (const enemy of enemies) {
				for (const cardId of enemy.hand) {
					if (seen.has(cardId)) continue;
					seen.add(cardId);
					actions.push({ type: "resolve_peek_discard", discardMoveId: cardId });
				}
			}
			return actions;
		}

		case "crew_reactivate":
			return interaction.eligibleSlots.map((slot) => ({
				type: "resolve_crew_reactivate" as const,
				crewSlot: slot as 0 | 1 | 2,
			}));

		case "poison_target_pick":
			return interaction.eligibleTargetIds.map((targetPlayerId) => ({
				type: "resolve_poison_target" as const,
				targetPlayerId,
			}));

		case "choose_crew_to_turn":
			return interaction.eligibleSlots.map((slot) => ({
				type: "resolve_choose_crew_to_turn" as const,
				crewSlot: slot as 0 | 1,
			}));

		case "choose_discard_count": {
			const actions: FaceturnsAction[] = [];
			for (let count = 0; count <= interaction.maxCount; count++) {
				actions.push({ type: "resolve_choose_discard_count", count });
			}
			return actions;
		}

		case "choose_from_discard":
			return [...new Set(interaction.discardPileSnapshot)].map((cardId) => ({
				type: "resolve_choose_from_discard" as const,
				cardId,
			}));

		case "dig_deep_pick": {
			// revealedCards are pinned by determinize.ts, so we can safely access them
			if (interaction.revealedCards.length === 0) return [];
			const maxPicks = interaction.maxPicks ?? 1;
			const distinctIds = [...new Set(interaction.revealedCards)];
			// combinatorial enumeration not worth it for small lookCount; only single picks and the "all" combo are generated
			const actions: FaceturnsAction[] = distinctIds.map((cardId) => ({
				type: "resolve_dig_deep_pick",
				cardIds: [cardId],
			}));
			if (maxPicks > 1 && distinctIds.length > 1) {
				actions.push({
					type: "resolve_dig_deep_pick",
					cardIds: distinctIds.slice(0, maxPicks),
				});
			}
			return actions;
		}

		case "switch_up_pick": {
			const actions: FaceturnsAction[] = [];
			for (const hideSlot of interaction.faceUpSlots) {
				for (const turnSlot of interaction.faceDownSlots) {
					actions.push({
						type: "resolve_switch_up_pick",
						hideSlot: hideSlot,
						turnSlot: turnSlot,
					});
				}
			}
			return actions;
		}

		case "tactical_support_hide_offer": {
			const actions: FaceturnsAction[] = [
				{ type: "resolve_tactical_support_hide_offer" },
			];
			for (const slot of interaction.eligibleSlots) {
				actions.push({
					type: "resolve_tactical_support_hide_offer",
					slot: slot,
				});
			}
			return actions;
		}

		case "bear_bones_steal_pick":
			return interaction.eligibleTargetIds.map((targetPlayerId) => ({
				type: "resolve_bear_bones_steal_pick" as const,
				targetPlayerId,
			}));

		case "bear_bones_bonus_strike": {
			const actions: FaceturnsAction[] = [
				{ type: "resolve_bear_bones_bonus_strike", confirmed: false },
			];
			for (const targetPlayerId of interaction.eligibleTargetIds) {
				const target = state.players.get(targetPlayerId);
				if (!target) continue;
				const faceDownSlots = eligibleFaceDownSlots(target);
				const faceUpSlots = eligibleFaceUpSlots(target);
				if (faceDownSlots.length === 0 && faceUpSlots.length === 0) {
					actions.push({
						type: "resolve_bear_bones_bonus_strike",
						confirmed: true,
						targetPlayerId,
					});
					continue;
				}
				for (const slot of faceDownSlots) {
					actions.push({
						type: "resolve_bear_bones_bonus_strike",
						confirmed: true,
						targetPlayerId,
						targetCrewSlot: slot,
					});
				}
				for (const slot of faceUpSlots) {
					actions.push({
						type: "resolve_bear_bones_bonus_strike",
						confirmed: true,
						targetPlayerId,
						targetCrewSlot: slot,
					});
				}
			}
			return actions;
		}

		case "void_legs_choice":
			return [
				{ type: "resolve_void_legs_choice", confirmed: false },
				{ type: "resolve_void_legs_choice", confirmed: true },
			];

		case "background_check_guess": {
			const actions: FaceturnsAction[] = [];
			for (const slot of interaction.eligibleSlots) {
				for (const guessClass of CREW_CLASSES) {
					actions.push({
						type: "resolve_background_check_guess",
						targetCrewSlot: slot,
						guessClass,
					});
				}
			}
			return actions;
		}

		case "lighthouse_disable_pick": {
			const maxPicks = interaction.maxPicks ?? 1;
			if (interaction.eligibleTargets.length === 0) return [];
			// full enumeration would bloat the branching factor; enumerate up to maxPicks combos instead
			const combos: { targetPlayerId: string; crewSlot: 0 | 1 }[][] = [];
			const targets = interaction.eligibleTargets;
			for (let i = 0; i < targets.length; i++) {
				const single = [
					{ targetPlayerId: targets[i]!.playerId, crewSlot: targets[i]!.slot },
				];
				combos.push(single);
				if (maxPicks >= 2) {
					for (let j = i + 1; j < targets.length; j++) {
						combos.push([
							single[0]!,
							{
								targetPlayerId: targets[j]!.playerId,
								crewSlot: targets[j]!.slot,
							},
						]);
					}
				}
			}
			return combos.map((picks) => ({
				type: "resolve_lighthouse_disable_pick" as const,
				picks,
			}));
		}

		case "tag_out_pick": {
			const actions: FaceturnsAction[] = [];
			for (const ownSlot of interaction.ownEligibleSlots) {
				for (const teammateSlot of interaction.teammateEligibleSlots) {
					actions.push({
						type: "resolve_tag_out_pick",
						ownSlot: ownSlot,
						teammateSlot: teammateSlot,
					});
				}
			}
			return actions;
		}

		case "truth_serum_reveal":
			return interaction.eligibleSlots.map((slot) => ({
				type: "resolve_truth_serum_reveal" as const,
				crewSlot: slot as 0 | 1,
			}));

		case "too_big_swap_pick":
			return interaction.eligibleTargets.map((t) => ({
				type: "resolve_too_big_swap_pick" as const,
				targetPlayerId: t.playerId,
				crewSlot: t.slot,
			}));

		case "belladonna_copy_pick": {
			const actions: FaceturnsAction[] = [
				{ type: "resolve_belladonna_copy_pick", confirmed: false },
			];
			for (const t of interaction.eligibleTargets) {
				actions.push({
					type: "resolve_belladonna_copy_pick",
					confirmed: true,
					targetPlayerId: t.playerId,
					targetActiveMoveSlot: t.slot,
				});
			}
			return actions;
		}

		default:
			return [];
	}
}