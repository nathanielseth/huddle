import type { EngineResult } from "../../engine/GameEngine";
import type { FaceturnServerState } from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import {
	setTurnOrderAfterRps,
	dealOpeningHand,
	checkWinConditions,
	applyWin,
	executePendingAction,
	markDirty,
} from "./game";
import type { StrikeOrExecuteOutcome } from "./effects";
import type { ResolutionResult } from "../../../../shared/games/face-turn/types";
import {
	getCachedPublicState,
	buildPrivatePayloads,
} from "./state-builders";

export function buildStrikeResolution(
	outcome: StrikeOrExecuteOutcome,
	attackerId: string,
	targetPlayerId: string,
	via: "strike" | "face_turn" | "challenge_loss",
): ResolutionResult {
	if (outcome.outcome === "pending") {
		throw new Error(
			'buildStrikeResolution called with a pending outcome — check outcome.outcome !== "pending" before calling',
		);
	}

	if (outcome.outcome === "crew_turned") {
		return {
			type: "strike_or_execute_resolved",
			attackerId,
			targetPlayerId,
			via,
			outcome: "crew_turned",
			crewTurnedSlot: outcome.slot,
			crewKilledSlot: null,
			crewRefilledFromReserve: false,
			negatedBy: null,
			survivedViaLifeInsurance: false,
		};
	}

	if (outcome.outcome === "crew_killed") {
		return {
			type: "strike_or_execute_resolved",
			attackerId,
			targetPlayerId,
			via,
			outcome: "crew_killed",
			crewTurnedSlot: null,
			crewKilledSlot: outcome.slot,
			crewRefilledFromReserve: outcome.refilledFromReserve,
			negatedBy: null,
			survivedViaLifeInsurance: false,
		};
	}

	if (outcome.outcome === "executed") {
		return {
			type: "strike_or_execute_resolved",
			attackerId,
			targetPlayerId,
			via,
			outcome: "executed",
			crewTurnedSlot: null,
			crewKilledSlot: null,
			crewRefilledFromReserve: false,
			negatedBy: null,
			survivedViaLifeInsurance: outcome.survivedViaLifeInsurance,
		};
	}

	// negated
	return {
		type: "strike_or_execute_resolved",
		attackerId,
		targetPlayerId,
		via,
		outcome: "negated",
		crewTurnedSlot: null,
		crewKilledSlot: null,
		crewRefilledFromReserve: false,
		negatedBy: outcome.negatedBy,
		survivedViaLifeInsurance: false,
	};
}

// executes the original class action after a deferred penalty interaction
// does not overwrite lastResolution; the caller already set the correct
// resolution for the interaction that triggered this deferred action
export function runDeferredPendingAction(state: FaceturnServerState): void {
	const outcome = executePendingAction(state);
	if (outcome && outcome.outcome === "pending") {
		return;
	}
	state.pendingAction = null;
	state.phase = "active_turn";
}

export function makeResult(
	state: FaceturnServerState,
	timerDurationMs: number | null,
	extras: Partial<EngineResult> = {},
): EngineResult {
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getCachedPublicState(state),
		timer:
			timerDurationMs !== null
				? { startsAt: Date.now(), duration: timerDurationMs }
				: null,
		...extras,
	};
}

export function afterAction(
	state: FaceturnServerState,
	fallback: { duration?: number; includePrivatePayloads?: boolean } = {},
): EngineResult {
	if (state.phase === "finished") {
		return makeResult(state, null, { roomPhase: "ended" });
	}

	const win = checkWinConditions(state);
	if (win) {
		applyWin(state, win.winnerId, win.winCondition);
		return makeResult(state, null, { roomPhase: "ended" });
	}

	if (tryOpenQueuedDefendableStrike(state)) {
		return makeResult(state, C.DEFEND_WINDOW_MS);
	}

	return makeResult(
		state,
		fallback.duration ?? C.ACTIVE_TURN_DURATION_MS,
		fallback.includePrivatePayloads
			? { privatePayloads: buildPrivatePayloads(state) }
			: {},
	);
}

// opens a defend window for the next queued turned‑effect strike (e.g. Shrike)
function tryOpenQueuedDefendableStrike(state: FaceturnServerState): boolean {
	if (state.pendingAction !== null) return false;
	if (state.pendingInteraction !== null) return false;

	let next = state.pendingDefendableStrikes.shift();
	while (next) {
		const actor = state.players.get(next.actorId);
		const target = state.players.get(next.targetPlayerId);
		const actorValid = actor && !state.eliminatedPlayers.has(next.actorId);
		const targetValid =
			target && !state.eliminatedPlayers.has(next.targetPlayerId);

		if (actorValid && targetValid) {
			state.pendingAction = {
				type: "card_strike",
				actorId: next.actorId,
				targetCrewSlot: next.targetCrewSlot,
				targetAllySlot: null,
				moveId: null,
				cashCost: 0,
				declaredClass: null,
				actorWasBluffing: false,
				targetPlayerId: next.targetPlayerId,
				originalActionType: null,
			};
			state.phase = "defend_window";
			return true;
		}

		// actor or target no longer valid (e.g. eliminated meanwhile); drop and try the next queued strike
		next = state.pendingDefendableStrikes.shift();
	}

	return false;
}

export function finalizeResolvedChallenge(
	state: FaceturnServerState,
	actorId: string | null,
): EngineResult {
	// fallback in case the original resolveChallenge call didn't set one
	state.lastResolution = state.lastResolution ?? {
		type: "challenge_success",
		challengerId: null,
		actorId: actorId ?? "",
		crewTurnedPlayerId: actorId,
		crewTurnedSlot: null,
		executedPlayerId: null,
	};
	state.pendingAction = null;
	state.phase = "active_turn";
	return afterAction(state);
}

export function applyRpsWinner(state: FaceturnServerState): EngineResult {
	const winnerId =
		state.rpsResult === "player1" ? state.playerOrder[0] : state.playerOrder[1];

	if (state.mode === "teams") {
		// winner always goes first per standard rules
		setTurnOrderAfterRps(state, winnerId, true);
	} else {
		const loserId = state.playerOrder.find((id) => id !== winnerId)!;
		state.turnOrder = [winnerId, loserId];
	}

	for (const p of state.players.values()) dealOpeningHand(p);
	state.phase = "mulligan";
	return makeResult(state, C.MULLIGAN_DURATION_MS, {
		privatePayloads: buildPrivatePayloads(state),
	});
}