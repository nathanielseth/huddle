import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import { getMove } from "../cards";
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
		if (!player.hand.includes(moveId))
			return rejectPlay("That card isn't in your hand.");

		const move = getMove(moveId);
		if (move.moveType !== "burst")
			return rejectPlay("That's not a burst move.");

		const cost = effectiveCost(state, player, moveId);
		if (player.cash < cost)
			return rejectPlay(
				`Not enough cash — this move costs ₱${cost}, you have ₱${player.cash}.`,
			);

		if (!moveHasLegalTarget(state, playerId, move))
			return rejectPlay("No legal target for this move right now.");

		const burstScopeCheck = validateMoveTargetScope(
			state,
			playerId,
			move,
			action.targetPlayerId,
		);
		if (!burstScopeCheck.ok) return rejectPlay(burstScopeCheck.reason!);

		player.hand.splice(player.hand.indexOf(moveId), 1);
		player.cash -= cost;

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
		if (!player.hand.includes(moveId))
			return rejectPlay("That card isn't in your hand.");

		const move = getMove(moveId);
		if (move.moveType !== "slow") return rejectPlay("That's not a slow move.");

		const cost = effectiveCost(state, player, moveId);
		if (player.cash < cost)
			return rejectPlay(
				`Not enough cash — this move costs ₱${cost}, you have ₱${player.cash}.`,
			);

		if (!moveHasLegalTarget(state, playerId, move))
			return rejectPlay("No legal target for this move right now.");

		const slowScopeCheck = validateMoveTargetScope(
			state,
			playerId,
			move,
			action.targetPlayerId,
		);
		if (!slowScopeCheck.ok) return rejectPlay(slowScopeCheck.reason!);

		player.hand.splice(player.hand.indexOf(moveId), 1);
		player.cash -= cost;

		pushToMoveChain(state, {
			moveId,
			actorId: playerId,
			targetCrewSlot: action.targetCrewSlot ?? null,
			targetAllySlot: action.targetAllySlot ?? null,
			targetPlayerId: action.targetPlayerId ?? null,
			cashCost: cost,
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
		const defenderWouldBeBluffing = computeActorWasBluffing(defender, "defend");
		if (defenderWouldBeBluffing && firstUnturnedSlot(defender) === null) {
			return noOp();
		}
		const defendCost = getClassActionCost(defender, "defend");
		if (defender.cash < defendCost) return noOp();

		defender.cash -= defendCost;
		state.challengeEligiblePlayerIds = [];
		state.pendingAction = {
			type: "class_action_defend",
			actorId: defender.playerId,
			targetCrewSlot: pending.targetCrewSlot,
			targetAllySlot: pending.targetAllySlot,
			moveId: null,
			cashCost: defendCost,
			declaredClass: "defend",
			actorWasBluffing: defenderWouldBeBluffing,
			targetPlayerId: pending.actorId,
			originalActionType: pending.type,
		};
		state.phase = "defend_declared";
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
		const defenderWouldBeBluffing = computeActorWasBluffing(defender, "defend");
		if (defenderWouldBeBluffing && firstUnturnedSlot(defender) === null) {
			return noOp();
		}
		const defendCost = getClassActionCost(defender, "defend");
		if (defender.cash < defendCost) return noOp();

		defender.cash -= defendCost;
		state.pendingAction = {
			...pending,
			type: "class_action_defend",
			actorId: defender.playerId,
			cashCost: defendCost,
			declaredClass: "defend",
			actorWasBluffing: defenderWouldBeBluffing,
			targetPlayerId: pending.actorId,
			originalActionType: pending.type,
		};
		state.phase = "defend_declared";
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