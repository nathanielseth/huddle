import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import { getMove } from "../cards";
import type { MoveCard } from "../cards";
import type { PendingAction } from "../../../../../shared/games/face-turn/types";
import {
	effectiveCost,
	executeMove,
	pushToMoveChain,
	resolveMoveChainFull,
	resolveChallenge,
	executePendingAction,
	recordBluffIfUnchallenged,
	computeActorWasBluffing,
	getClassActionCost,
} from "../game";
import {
	isPlayerOrTeammate,
	firstUnturnedSlot,
	resolveStrikeOrExecute,
	performStrike,
	moveHasLegalTarget,
	validateMoveTargetScope,
} from "../effects";
import {
	makeResult,
	makeResultKeepingTimer,
	afterAction,
	buildStrikeResolution,
} from "../action-results";
import { pushLog } from "../log";

// shared by challenge_window's defend/block_steal and defend_window's defend: declares a class action in
// response to a pending one, paying its cost. returns false if the caller should no-op (bluffing with no
// crew left, or can't afford it)
function tryDeclareResponseClassAction(
	state: FaceturnServerState,
	responder: FaceturnServerPlayer,
	pending: PendingAction,
	declaredType: "class_action_defend" | "class_action_block_steal",
	declaredClass: "defend" | "steal",
): boolean {
	const wouldBeBluffing = computeActorWasBluffing(responder, declaredClass);
	if (wouldBeBluffing && firstUnturnedSlot(responder) === null) return false;

	const cost = getClassActionCost(responder, declaredClass);
	if (responder.cash < cost) return false;

	responder.cash -= cost;
	state.pendingAction = {
		type: declaredType,
		actorId: responder.playerId,
		targetCrewSlot: pending.targetCrewSlot,
		targetAllySlot: pending.targetAllySlot,
		moveId: null,
		cashCost: cost,
		declaredClass,
		actorWasBluffing: wouldBeBluffing,
		targetPlayerId: pending.actorId,
		originalActionType: pending.type,
	};
	state.phase = "defend_declared";
	return true;
}

// shared validation for playing a card into the chain: hand membership, move type, cost, legal target
// returns a rejection reason, or the validated move/cost (burst executes immediately, slow pushes onto the chain)
function validateChainPlay(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	playerId: string,
	moveId: string,
	moveType: "burst" | "slow",
	targetPlayerId: string | undefined,
): { ok: true; move: MoveCard; cost: number } | { ok: false; reason: string } {
	if (!player.hand.includes(moveId)) {
		return { ok: false, reason: "That card isn't in your hand." };
	}

	const move = getMove(moveId);
	if (move.moveType !== moveType) {
		return {
			ok: false,
			reason:
				moveType === "burst"
					? "That's not a burst move."
					: "That's not a slow move.",
		};
	}

	const cost = effectiveCost(state, player, moveId);
	if (player.cash < cost) {
		return {
			ok: false,
			reason: `Not enough cash. This move costs ₱${cost}, you have ₱${player.cash}.`,
		};
	}

	if (!moveHasLegalTarget(state, playerId, move)) {
		return { ok: false, reason: "No legal target for this move right now." };
	}

	const scopeCheck = validateMoveTargetScope(state, playerId, move, targetPlayerId);
	if (!scopeCheck.ok) return { ok: false, reason: scopeCheck.reason! };

	return { ok: true, move, cost };
}

export const moveChainWindowAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	const noOp = () => noOpResult(state, ctx);
	// surfaces validation reasons to the acting player, unlike bare noOp
	const rejectPlay = (reason: string) =>
		noOpResult(state, ctx, { rejectedFor: playerId, reason });
	const keepTimer = (extras?: Parameters<typeof makeResultKeepingTimer>[2]) =>
		makeResultKeepingTimer(state, ctx.room.timer, extras);

	const chain = state.moveChain;
	if (!chain) return noOp();

	const [p1, p2] = chain.participants;
	if (playerId !== p1 && playerId !== p2) return noOp();

	if (action.type === "chain_play_burst") {
		// burst requires priority, same as slow moves, but reserved for the turn player
		if (playerId !== chain.responderId) return noOp();
		if (playerId !== state.activePlayerId) return noOp();

		const { moveId } = action;
		const validated = validateChainPlay(
			state,
			player,
			playerId,
			moveId,
			"burst",
			action.targetPlayerId,
		);
		if (!validated.ok) return rejectPlay(validated.reason);

		player.hand.splice(player.hand.indexOf(moveId), 1);
		player.cash -= validated.cost;

		executeMove(state, player, moveId, {
			targetCrewSlot: action.targetCrewSlot,
			targetAllySlot: action.targetAllySlot,
			targetPlayerId: action.targetPlayerId,
			targetActiveMoveSlot: action.targetActiveMoveSlot,
		});

		// burst doesn't change priority, clock continues
		return keepTimer();
	}

	if (action.type === "chain_play_slow") {
		if (playerId !== chain.responderId) return noOp();

		const { moveId } = action;
		const validated = validateChainPlay(
			state,
			player,
			playerId,
			moveId,
			"slow",
			action.targetPlayerId,
		);
		if (!validated.ok) return rejectPlay(validated.reason);

		player.hand.splice(player.hand.indexOf(moveId), 1);
		player.cash -= validated.cost;

		pushToMoveChain(state, {
			moveId,
			actorId: playerId,
			targetCrewSlot: action.targetCrewSlot ?? null,
			targetAllySlot: action.targetAllySlot ?? null,
			targetPlayerId: action.targetPlayerId ?? null,
			cashCost: validated.cost,
		});

		// pushing a slow move alternates priority and opens response window
		return makeResult(state, C.MOVE_CHAIN_WINDOW_MS);
	}

	if (action.type === "chain_pass") {
		// pass from priority holder resolves chain immediately
		if (playerId !== chain.responderId) return noOp();

		resolveMoveChainFull(state);
		state.moveChain = null;
		state.phase = "active_turn";
		return afterAction(state);
	}

	return noOp();
};

export const challengeWindowAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	void player;
	const noOp = () => noOpResult(state, ctx);
	const pending = state.pendingAction!;

	if (!state.challengeEligiblePlayerIds.includes(playerId)) return noOp();

	if (action.type === "challenge") {
		const actor = state.players.get(pending.actorId)!;
		const challenger = state.players.get(playerId);

		pushLog(state, {
			kind: "challenge_declared",
			challengerId: playerId,
			actorId: pending.actorId,
		});

		if (challenger && challenger.derived.cashOnChallengeAmount > 0) {
			challenger.cash += challenger.derived.cashOnChallengeAmount;
		}

		if (actor.derived.hasBackgroundCheck) {
			const eligibleSlots = ([0, 1] as const).filter(
				(i) => actor.crewIds[i] !== null && !actor.crewTurned[i],
			);
			if (eligibleSlots.length > 0) {
				state.challengeEligiblePlayerIds = [];
				state.pendingInteraction = {
					type: "background_check_guess",
					actorId: playerId,
					targetPlayerId: pending.actorId,
					eligibleSlots,
				};
				return makeResult(state, ctx.room.timer?.duration ?? null);
			}
		}

		state.challengeEligiblePlayerIds = [];
		const { actionProceeds, resolution, strikeOutcome } = resolveChallenge(
			state,
			playerId,
		);
		state.lastResolution = resolution;

		if (
			strikeOutcome &&
			strikeOutcome.outcome !== "pending" &&
			strikeOutcome.outcome !== "executed"
		) {
			const challengeTargetId = actionProceeds ? playerId : pending.actorId;
			const challengeAttackerId = actionProceeds ? pending.actorId : playerId;
			state.lastResolution = buildStrikeResolution(
				state,
				strikeOutcome,
				challengeAttackerId,
				challengeTargetId,
				"challenge_loss",
			);
		}

		if (actionProceeds && state.pendingInteraction === null) {
			const outcome = executePendingAction(state);
			if (outcome && outcome.outcome !== "pending") {
				state.lastResolution = buildStrikeResolution(
					state,
					outcome,
					pending.actorId,
					pending.targetPlayerId ?? "",
					"strike",
				);
			}
			state.pendingAction = null;
			state.phase = "active_turn";
			return afterAction(state);
		}

		if (actionProceeds && state.pendingInteraction !== null) {
			// actor wasn't bluffing, interaction runs deferred pending action itself
			return afterAction(state);
		}

		// challenge succeeded, reset now
		state.pendingAction = null;
		state.phase = "active_turn";
		return afterAction(state);
	}

	if (action.type === "defend" && pending.type === "class_action_strike") {
		if (!isPlayerOrTeammate(state, playerId, pending.targetPlayerId!))
			return noOp();
		const defender = state.players.get(playerId)!;
		const declared = tryDeclareResponseClassAction(
			state,
			defender,
			pending,
			"class_action_defend",
			"defend",
		);
		if (!declared) return noOp();

		state.challengeEligiblePlayerIds = [];
		return makeResult(state, C.DEFEND_DECLARED_MS);
	}

	if (action.type === "block_steal" && pending.type === "class_action_steal") {
		if (!isPlayerOrTeammate(state, playerId, pending.targetPlayerId!))
			return noOp();
		const blocker = state.players.get(playerId)!;
		const declared = tryDeclareResponseClassAction(
			state,
			blocker,
			pending,
			"class_action_block_steal",
			"steal",
		);
		if (!declared) return noOp();

		state.challengeEligiblePlayerIds = [];
		return makeResult(state, C.DEFEND_DECLARED_MS);
	}

	if (action.type === "pass_challenge") {
		state.challengeEligiblePlayerIds = state.challengeEligiblePlayerIds.filter(
			(id) => id !== playerId,
		);

		if (state.challengeEligiblePlayerIds.length === 0) {
			recordBluffIfUnchallenged(state);
			const outcome = executePendingAction(state);
			if (outcome && outcome.outcome !== "pending") {
				state.lastResolution = buildStrikeResolution(
					state,
					outcome,
					pending.actorId,
					pending.targetPlayerId ?? "",
					"strike",
				);
			} else {
				state.lastResolution = {
					type: "action_resolved",
					challengerId: null,
					actorId: pending.actorId,
					crewTurnedPlayerId: null,
					crewTurnedSlot: null,
					executedPlayerId: null,
				};
			}
			state.pendingAction = null;
			state.phase = "active_turn";
			return afterAction(state);
		}

		return makeResult(state, ctx.room.timer?.duration ?? null);
	}

	return noOp();
};

export const defendWindowAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	void player;
	const noOp = () => noOpResult(state, ctx);
	const pending = state.pendingAction!;
	if (!isPlayerOrTeammate(state, playerId, pending.targetPlayerId!))
		return noOp();

	if (action.type === "defend") {
		const defender = state.players.get(playerId)!;
		const declared = tryDeclareResponseClassAction(
			state,
			defender,
			pending,
			"class_action_defend",
			"defend",
		);
		if (!declared) return noOp();

		return makeResult(state, C.DEFEND_DECLARED_MS);
	}

	if (action.type === "pass_challenge") {
		if (pending.type === "card_strike") {
			const outcome = performStrike({
				state,
				actor: state.players.get(pending.actorId)!,
				targetPlayerId: pending.targetPlayerId ?? undefined,
				targetCrewSlot: pending.targetCrewSlot ?? undefined,
			});
			if (outcome && outcome.outcome !== "pending") {
				state.lastResolution = buildStrikeResolution(
					state,
					outcome,
					pending.actorId,
					pending.targetPlayerId ?? "",
					"strike",
				);
			}
		}
		state.pendingAction = null;
		state.phase = "active_turn";
		return afterAction(state);
	}

	return noOp();
};

export const defendDeclaredAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	void player;
	const noOp = () => noOpResult(state, ctx);
	const pending = state.pendingAction!;
	const strikeerId = pending.targetPlayerId!;
	if (playerId !== strikeerId) return noOp();

	if (action.type === "accept_defend") {
		state.lastResolution = {
			type: "action_resolved",
			challengerId: pending.actorId,
			actorId: strikeerId,
			crewTurnedPlayerId: null,
			crewTurnedSlot: null,
			executedPlayerId: null,
		};
		state.pendingAction = null;
		state.phase = "active_turn";
		return afterAction(state);
	}

	if (action.type === "challenge_defend") {
		if (pending.originalActionType === "card_strike") return noOp();

		pushLog(state, {
			kind: "challenge_declared",
			challengerId: strikeerId,
			actorId: pending.actorId,
		});

		const { actionProceeds: defendWasReal, resolution } = resolveChallenge(
			state,
			strikeerId,
		);
		state.lastResolution = resolution;

		if (!defendWasReal) {
			const originalTarget = state.players.get(pending.actorId);
			if (originalTarget) {
				const defender = state.players.get(strikeerId);
				if (defender) {
					const outcome = resolveStrikeOrExecute(
						state,
						defender,
						strikeerId,
						{ reason: "challenge_loss" },
					);
					if (outcome.outcome !== "pending") {
						state.lastResolution = buildStrikeResolution(
							state,
							outcome,
							strikeerId,
							defender.playerId,
							"challenge_loss",
						);
					}
				}
			}
		}

		state.pendingAction = null;
		state.phase = "active_turn";
		return afterAction(state);
	}

	return noOp();
};