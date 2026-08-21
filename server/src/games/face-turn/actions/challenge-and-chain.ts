import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import { getMove, getMoveTargetScope } from "../cards";
import {
	effectiveCost,
	executeMove,
	pushToMoveChain,
	recordChainPass,
	resolveMoveChainFull,
	resolveChallenge,
	executePendingAction,
	recordBluffIfUnchallenged,
	computeActorWasBluffing,
	getClassActionCost,
} from "../game";
import {
	getEnemies,
	getTeammates,
	isPlayerOrTeammate,
	firstUnturnedSlot,
	resolveStrikeOrExecute,
} from "../effects";
import { makeResult, afterAction, buildStrikeResolution } from "../action-results";
import { buildPrivatePayloads } from "../state-builders";

export const moveChainWindowAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	const noOp = () => noOpResult(state, ctx);

	const chain = state.moveChain;
	if (!chain) return noOp();

	const [p1, p2] = chain.participants;
	if (playerId !== p1 && playerId !== p2) return noOp();

	if (action.type === "chain_play_burst") {
		const { moveId } = action;
		if (!player.hand.includes(moveId)) return noOp();

		const move = getMove(moveId);
		if (move.moveType !== "burst") return noOp();

		const cost = effectiveCost(state, player, moveId);
		if (player.cash < cost) return noOp();

		if (action.targetPlayerId) {
			const scope = getMoveTargetScope(move);
			if (scope === "enemy") {
				const targetIsEnemy = getEnemies(state, playerId).some(
					(e) => e.playerId === action.targetPlayerId,
				);
				if (!targetIsEnemy) return noOp();
			} else if (scope === "ally") {
				const isValidAlly =
					action.targetPlayerId === playerId ||
					getTeammates(state, playerId).some(
						(t) => t.playerId === action.targetPlayerId,
					);
				if (!isValidAlly) return noOp();
			} else {
				return noOp();
			}
		}

		player.hand.splice(player.hand.indexOf(moveId), 1);
		player.cash -= cost;

		executeMove(state, player, moveId, {
			targetCrewSlot: action.targetCrewSlot,
			targetAllySlot: action.targetAllySlot,
			targetPlayerId: action.targetPlayerId,
			targetActiveMoveSlot: action.targetActiveMoveSlot,
		});

		return afterAction(state, {
			duration: C.MOVE_CHAIN_WINDOW_MS,
			includePrivatePayloads: true,
		});
	}

	if (action.type === "chain_play_slow") {
		const { moveId } = action;
		if (!player.hand.includes(moveId)) return noOp();

		const move = getMove(moveId);
		if (move.moveType !== "slow") return noOp();

		const cost = effectiveCost(state, player, moveId);
		if (player.cash < cost) return noOp();

		if (action.targetPlayerId) {
			const scope = getMoveTargetScope(move);
			if (scope === "enemy") {
				const targetIsEnemy = getEnemies(state, playerId).some(
					(e) => e.playerId === action.targetPlayerId,
				);
				if (!targetIsEnemy) return noOp();
			} else if (scope === "ally") {
				const isValidAlly =
					action.targetPlayerId === playerId ||
					getTeammates(state, playerId).some(
						(t) => t.playerId === action.targetPlayerId,
					);
				if (!isValidAlly) return noOp();
			} else {
				return noOp();
			}
		}

		player.hand.splice(player.hand.indexOf(moveId), 1);
		player.cash -= cost;

		pushToMoveChain(state, {
			moveId,
			actorId: playerId,
			targetCrewSlot: action.targetCrewSlot ?? null,
			targetAllySlot: action.targetAllySlot ?? null,
			targetPlayerId: action.targetPlayerId ?? null,
		});

		return makeResult(state, C.MOVE_CHAIN_WINDOW_MS, {
			privatePayloads: buildPrivatePayloads(state),
		});
	}

	if (action.type === "chain_pass") {
		if (playerId !== chain.responderId) return noOp();

		const shouldResolve = recordChainPass(state, playerId);
		if (shouldResolve) {
			resolveMoveChainFull(state);
			state.moveChain = null;
			state.phase = "active_turn";
			return afterAction(state);
		}
		return makeResult(state, C.MOVE_CHAIN_WINDOW_MS);
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
				return makeResult(state, ctx.room.timer?.duration ?? null, {
					privatePayloads: buildPrivatePayloads(state),
				});
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
			return afterAction(state);
		}

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
						false,
					);
					if (outcome.outcome !== "pending") {
						state.lastResolution = buildStrikeResolution(
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