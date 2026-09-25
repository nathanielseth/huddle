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
import { pushLog } from "./log";

// builds the public result and logs the outcome in one place so the two can't drift
export function buildStrikeResolution(
	state: FaceturnServerState,
	outcome: StrikeOrExecuteOutcome,
	attackerId: string,
	targetPlayerId: string,
	via: "strike" | "face_turn" | "challenge_loss",
): ResolutionResult {
	if (outcome.outcome === "pending") {
		throw new Error(
			'buildStrikeResolution called with a pending outcome, check outcome.outcome !== "pending" before calling',
		);
	}

	pushLog(state, {
		kind: "strike_resolved",
		attackerId,
		targetPlayerId,
		via,
		outcome: outcome.outcome,
		negatedBy: outcome.outcome === "negated" ? outcome.negatedBy : null,
	});

	const base = {
		type: "strike_or_execute_resolved" as const,
		attackerId,
		targetPlayerId,
		via,
		crewTurnedSlot: null,
		crewKilledSlot: null,
		crewRefilledFromReserve: false,
		negatedBy: null,
		survivedViaLifeInsurance: false,
	};

	switch (outcome.outcome) {
		case "crew_turned":
			return { ...base, outcome: "crew_turned", crewTurnedSlot: outcome.slot };
		case "crew_killed":
			return {
				...base,
				outcome: "crew_killed",
				crewKilledSlot: outcome.slot,
				crewRefilledFromReserve: outcome.refilledFromReserve,
			};
		case "executed":
			return {
				...base,
				outcome: "executed",
				survivedViaLifeInsurance: outcome.survivedViaLifeInsurance,
			};
		case "negated":
			return { ...base, outcome: "negated", negatedBy: outcome.negatedBy };
	}
}

// does not overwrite lastResolution, the caller already set the correct one for the triggering interaction
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

	// always resync, this is the one choke point every result passes through
	// instead of trusting ~30 call sites to opt in (caused the sucker punch hand-visibility bug)
	const privatePayloads = extras.privatePayloads ?? buildPrivatePayloads(state);

	return {
		serverPayload: state,
		publicPayload: getCachedPublicState(state),
		timer:
			timerDurationMs !== null
				? { startsAt: Date.now(), duration: timerDurationMs }
				: null,
		...extras,
		privatePayloads,
	};
}

// actions that don't hand priority away (opening own chain, pushing burst) keep the
// current timer as-is instead of restarting it, so the clock doesn't reset on your own turn
export function makeResultKeepingTimer(
	state: FaceturnServerState,
	currentTimer: { startsAt: number; duration: number } | null,
	extras: Partial<EngineResult> = {},
): EngineResult {
	markDirty(state);
	const privatePayloads = extras.privatePayloads ?? buildPrivatePayloads(state);

	return {
		serverPayload: state,
		publicPayload: getCachedPublicState(state),
		timer: currentTimer,
		...extras,
		privatePayloads,
	};
}

export function afterAction(
	state: FaceturnServerState,
	fallback: { duration?: number } = {},
): EngineResult {
	if (state.phase === "finished") {
		return makeResult(state, null, { roomPhase: "ended" });
	}

	const win = checkWinConditions(state);
	if (win) {
		applyWin(state, win.winnerId, win.winCondition);
		return makeResult(state, null, { roomPhase: "ended" });
	}

	// a pendingInteraction opened upstream needs its own window duration, not this fallback,
	// check it first so no caller has to remember to special-case it
	if (state.pendingInteraction !== null) {
		return makeResult(state, C.INTERACTION_WINDOW_MS);
	}

	if (tryOpenQueuedDefendableStrike(state)) {
		return makeResult(state, C.DEFEND_WINDOW_MS);
	}

	return makeResult(state, fallback.duration ?? C.ACTIVE_TURN_DURATION_MS);
}

// opens a defend window for the next queued turned-effect strike (e.g. Shrike)
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

		// actor or target no longer valid (e.g. eliminated meanwhile), drop and try the next queued strike
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

// hold here so clients render the reveal before advancing, onTimerExpired moves on (see index.ts, "rps_reveal")
export function beginRpsReveal(state: FaceturnServerState): EngineResult {
	state.phase = "rps_reveal";
	return makeResult(state, C.RPS_REVEAL_DURATION_MS);
}

// rps winner still needs to pick turn order, resolveRpsOrderChoice deals hands once they do (or on timeout)
export function beginRpsOrderChoice(state: FaceturnServerState): EngineResult {
	const winnerId =
		state.rpsResult === "player1" ? state.playerOrder[0] : state.playerOrder[1];
	state.rpsOrderChoiceWinnerId = winnerId;
	state.phase = "rps_order_choice";
	return makeResult(state, C.RPS_ORDER_CHOICE_DURATION_MS);
}

// goFirst: true means the rps winner's team/seat takes the first turn,
// false means they deliberately cede it to the opponent.
export function resolveRpsOrderChoice(
	state: FaceturnServerState,
	goFirst: boolean,
): EngineResult {
	const winnerId = state.rpsOrderChoiceWinnerId!;

	if (state.mode === "teams") {
		setTurnOrderAfterRps(state, winnerId, goFirst);
	} else {
		const loserId = state.playerOrder.find((id) => id !== winnerId)!;
		state.turnOrder = goFirst ? [winnerId, loserId] : [loserId, winnerId];
	}

	state.rpsOrderChoiceWinnerId = null;
	for (const p of state.players.values()) dealOpeningHand(p);
	state.phase = "mulligan";
	return makeResult(state, C.MULLIGAN_DURATION_MS);
}