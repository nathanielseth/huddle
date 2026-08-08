import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { CrewClass } from "../../../../../shared/games/face-turn/types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { FaceturnServerPlayer, FaceturnServerState } from "../types";
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
	isStrikeBlockedByTerminal,
	getLivingPlayers,
} from "../effects";

const CREW_CLASSES: readonly CrewClass[] = [
	"striker",
	"blocker",
	"collector",
	"turner",
];

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
	const base = getMoveCost(state, player, moveId);
	if (
		moveId === CARD_IDS.MOVE.CLAIM_THE_BOUNTY &&
		player.hasCalledBluffSuccessfully
	) {
		return 0;
	}
	return base;
}

export interface EngineHelpers {
	readonly getMoveCost: (
		state: FaceturnServerState,
		player: FaceturnServerPlayer,
		moveId: string,
	) => number;
	readonly getClassActionCost: (
		player: FaceturnServerPlayer,
		action: "strike" | "block" | "collect" | "unturn",
	) => number;
	readonly computeActorWasBluffing: (
		actor: FaceturnServerPlayer,
		action: "strike" | "collect" | "unturn" | "block",
	) => boolean;
}

// must mirror engine.ts validation so the search tree never proposes an illegal move that would be silently no-oped
export function getLegalActions(
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	const player = state.players.get(seat);
	if (!player) return [];
	if (state.eliminatedPlayers.has(seat)) return [];

	if (state.pendingInteraction !== null) {
		return legalInteractionActions(state, seat);
	}

	switch (state.phase) {
		case "active_turn":
			return state.activePlayerId === seat
				? legalActiveTurnActions(state, player, helpers)
				: [];
		case "move_chain_window":
			return legalMoveChainActions(state, seat, player, helpers);
		case "challenge_window":
			return legalChallengeWindowActions(state, seat, helpers);
		case "block_window":
			return legalBlockWindowActions(state, seat, helpers);
		case "block_declared":
			return legalBlockDeclaredActions(state, seat);
		default:
			return [];
	}
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

	for (let i = 0; i < player.activeMoves.length; i++) {
		if (player.activeMoves[i] !== null) {
			actions.push({ type: "discard_active_move", slotIndex: i });
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

	for (const moveId of player.hand) {
		// duplicate move ids in hand have identical legal targets, so expand only once per distinct id
		if (seenMoveIds.has(moveId)) continue;
		seenMoveIds.add(moveId);

		const move = getMove(moveId);
		const cost = effectiveCost(state, player, moveId, helpers.getMoveCost);
		if (player.cash < cost) continue;

		if (
			move.moveType === "active" &&
			player.activeMoves.findIndex((s) => s === null) === -1
		) {
			continue;
		}

		const isBlockableStrike = move.effects.some((e) => {
			const eff = unwrapEffect(e);
			return eff.type === "strike_enemy_crew_blockable";
		});

		if (isBlockableStrike) {
			for (const enemy of getEnemies(state, player.playerId)) {
				const faceDownSlots = eligibleFaceDownSlots(enemy);
				if (faceDownSlots.length === 0) {
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
			}
			continue;
		}

		const scope = getMoveTargetScope(move);
		if (scope === "none") {
			actions.push({ type: "play_move", moveId });
			continue;
		}

		const targets =
			scope === "enemy"
				? getEnemies(state, player.playerId)
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
		action: "strike" | "collect" | "unturn",
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
			if (isStrikeBlockedByTerminal(enemy)) continue;
			out.push({
				type: "declare_class_action",
				action: "strike",
				targetPlayerId: enemy.playerId,
			});
		}
		return out;
	});

	tryDeclare("collect", () => [
		{ type: "declare_class_action", action: "collect" },
	]);

	tryDeclare("unturn", () => {
		if (firstTurnedSlot(player) === null) return [];
		const out: FaceturnsAction[] = [];
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (player.crewIds[slot] && player.crewTurned[slot]) {
				out.push({
					type: "declare_class_action",
					action: "unturn",
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
		if (faceDownSlots.length === 0) {
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

function legalMoveChainActions(
	state: FaceturnServerState,
	seat: string,
	player: FaceturnServerPlayer,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	const chain = state.moveChain;
	if (!chain) return [];
	const [p1, p2] = chain.participants;
	if (seat !== p1 && seat !== p2) return [];

	const actions: FaceturnsAction[] = [{ type: "chain_pass" }];
	const seenMoveIds = new Set<string>();

	for (const moveId of player.hand) {
		if (seenMoveIds.has(moveId)) continue;
		seenMoveIds.add(moveId);

		const move = getMove(moveId);
		if (move.moveType !== "burst" && move.moveType !== "slow") continue;

		const cost = effectiveCost(state, player, moveId, helpers.getMoveCost);
		if (player.cash < cost) continue;

		const scope = getMoveTargetScope(move);
		const kind =
			move.moveType === "burst" ? "chain_play_burst" : "chain_play_slow";

		if (scope === "none") {
			actions.push({ type: kind, moveId });
			continue;
		}

		const targets =
			scope === "enemy"
				? getEnemies(state, seat)
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
		const blocker = state.players.get(seat);
		if (blocker) {
			const wouldBeBluffing = helpers.computeActorWasBluffing(blocker, "block");
			const canPayBluff =
				!wouldBeBluffing || firstUnturnedSlot(blocker) !== null;
			const cost = helpers.getClassActionCost(blocker, "block");
			if (canPayBluff && blocker.cash >= cost) {
				actions.push({ type: "block" });
			}
		}
	}

	return actions;
}

function legalBlockWindowActions(
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
): FaceturnsAction[] {
	const pending = state.pendingAction;
	if (!pending?.targetPlayerId) return [];
	if (!isEligibleBlocker(state, seat, pending.targetPlayerId)) return [];

	const blocker = state.players.get(seat);
	if (!blocker) return [];

	const wouldBeBluffing = helpers.computeActorWasBluffing(blocker, "block");
	if (wouldBeBluffing && firstUnturnedSlot(blocker) === null) return [];
	const cost = helpers.getClassActionCost(blocker, "block");
	if (blocker.cash < cost) return [];

	return [{ type: "block" }];
}

function isEligibleBlocker(
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

function legalBlockDeclaredActions(
	state: FaceturnServerState,
	seat: string,
): FaceturnsAction[] {
	const pending = state.pendingAction;
	if (!pending || pending.targetPlayerId !== seat) return [];

	const actions: FaceturnsAction[] = [{ type: "accept_block" }];
	if (pending.originalActionType !== "card_strike") {
		actions.push({ type: "challenge_block" });
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
			// we're operating on the full server state, so revealedCards is directly accessible without a cast
			// determinize.ts pins these revealed cards so the action stays consistent across tree descents
			if (interaction.revealedCards.length === 0) return [];
			const maxPicks = interaction.maxPicks ?? 1;
			const distinctIds = [...new Set(interaction.revealedCards)];
			// full combinatorial enumeration not worth it for small lookCount; only single picks and the "all" combo are generated
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
			for (const unturnSlot of interaction.faceUpSlots) {
				for (const turnSlot of interaction.faceDownSlots) {
					actions.push({
						type: "resolve_switch_up_pick",
						unturnSlot: unturnSlot,
						turnSlot: turnSlot,
					});
				}
			}
			return actions;
		}

		case "tactical_support_unturn_offer": {
			const actions: FaceturnsAction[] = [
				{ type: "resolve_tactical_support_unturn_offer" },
			];
			for (const slot of interaction.eligibleSlots) {
				actions.push({
					type: "resolve_tactical_support_unturn_offer",
					slot: slot,
				});
			}
			return actions;
		}

		case "bear_bones_bonus_strike": {
			const actions: FaceturnsAction[] = [
				{ type: "resolve_bear_bones_bonus_strike", confirmed: false },
			];
			for (const targetPlayerId of interaction.eligibleTargetIds) {
				const target = state.players.get(targetPlayerId);
				if (!target) continue;
				const faceDownSlots = eligibleFaceDownSlots(target);
				if (faceDownSlots.length === 0) {
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
			}
			return actions;
		}

		case "too_big_unturn_offer":
			return [
				{ type: "resolve_too_big_unturn_offer", confirmed: false },
				{ type: "resolve_too_big_unturn_offer", confirmed: true },
			];

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

		case "watcher_unturn_offer": {
			const actions: FaceturnsAction[] = [
				{ type: "resolve_watcher_unturn_offer" },
			];
			for (const t of interaction.eligibleTargets) {
				actions.push({
					type: "resolve_watcher_unturn_offer",
					slot: t.slot,
					targetPlayerId: t.playerId,
				});
			}
			return actions;
		}

		case "lighthouse_disable_pick": {
			const maxPicks = interaction.maxPicks ?? 1;
			if (interaction.eligibleTargets.length === 0) return [];
			// full combinatorial enumeration would bloat the branching factor; enumerate all 1..maxPicks combos instead as targets are small
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

		default:
			return [];
	}
}

// re-exported so simulate.ts and cpu-player.ts can import all living-player helpers from one place
export { getLivingPlayers };