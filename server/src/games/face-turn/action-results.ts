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

// builds the public ResolutionResult AND logs the outcome — every one of
// this function's ~11 call sites across actions/interactions already has
// attackerId/targetPlayerId/via on hand (they're the ones initiating the
// strike/execute), so funneling the log push through here means those
// call sites don't each need their own pushLog, and outcome.outcome can't
// drift from what gets logged.
export function buildStrikeResolution(
	state: FaceturnServerState,
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

	pushLog(state, {
		kind: "strike_resolved",
		attackerId,
		targetPlayerId,
		via,
		outcome: outcome.outcome,
		negatedBy: outcome.outcome === "negated" ? outcome.negatedBy : null,
	});

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

	// privatePayloads defaults to a fresh resync for every player and can
	// only be widened/replaced by extras, never silently dropped — extras
	// would need to explicitly pass `privatePayloads: undefined` to unset
	// it, which TypeScript's Partial<EngineResult> permits but no call site
	// in this codebase does. This is the single choke point every action
	// handler's result passes through (directly, or via afterAction), so
	// it's the right place to guarantee every player's hand/cash/crew/etc.
	// gets resynced on every action — instead of trusting ~30 scattered call
	// sites, several levels of indirection deep through resolveChallenge/
	// executePendingAction/resolveMoveChainFull/resolveEffects/boss
	// commandEffects, to each correctly notice when they touch
	// secret-visible state and opt in. That trust-every-call-site model is
	// what caused the original bug (Sucker Punch staying visible in hand
	// after being played) and, on audit, several more instances of the same
	// pattern elsewhere in this file (declare_class_action's challenge
	// window, the card-strike defend window, move-chain windows,
	// swap_in_reserve_crew).
	// buildPrivatePayloads is cheap (small array/object copies over a
	// handful of players), and GameRunner only emits player_secret to
	// sockets that are already connected, so a redundant identical payload
	// costs nothing observable.
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

// For move-chain actions that shouldn't disturb the clock at all: opening a
// chain on your own turn, and pushing burst (turn player, doesn't touch
// priority) are all still just "your turn," not a new window waiting on
// anyone. This carries the room's current timer forward exactly as-is
// (same startsAt, same duration) instead of stamping a fresh
// MOVE_CHAIN_WINDOW_MS countdown, so the active-turn clock just keeps
// ticking through them uninterrupted. Only an action that actually hands
// priority to the other participant (a slow push, the first chain_pass of a
// pair) should open a real response window — see moveChainWindowAction.
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
	// makeResult() always attaches a fresh privatePayloads resync by
	// default (see its comment), so every return below gets one for free —
	// this function no longer needs to think about it at all. That's
	// deliberate: there used to be an opt-in `includePrivatePayloads` flag
	// here, and forgetting to pass it on one call site (a plain played
	// burst move) was exactly the Sucker Punch bug — the card was removed
	// from the server's hand, but the client's hand array was never told,
	// so the card stayed rendered until the next full resync.
	if (state.phase === "finished") {
		return makeResult(state, null, { roomPhase: "ended" });
	}

	const win = checkWinConditions(state);
	if (win) {
		applyWin(state, win.winnerId, win.winCondition);
		return makeResult(state, null, { roomPhase: "ended" });
	}

	// A pendingInteraction opened by whatever ran before afterAction() (a
	// challenge-loss picker, a move effect like choose_from_discard, a
	// turn-start offer like void_legs_choice, a deferred class action
	// re-running into a fresh interaction, ...) needs its own window, not
	// whatever generic duration this function would otherwise fall back
	// to. tryOpenQueuedDefendableStrike() below already refuses to touch
	// state while pendingInteraction is set, which used to mean nothing
	// downstream of it ever assigned a real duration and callers silently
	// inherited ACTIVE_TURN_DURATION_MS (or, in a couple of spots, an
	// explicitly hardcoded active-turn duration passed in via `fallback`).
	// Checking this first, centrally, fixes every such call site at once
	// instead of requiring each one to remember to special-case it.
	if (state.pendingInteraction !== null) {
		return makeResult(state, C.INTERACTION_WINDOW_MS);
	}

	if (tryOpenQueuedDefendableStrike(state)) {
		return makeResult(state, C.DEFEND_WINDOW_MS);
	}

	return makeResult(state, fallback.duration ?? C.ACTIVE_TURN_DURATION_MS);
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

// both picks are in and the winner is known, but clients haven't had a
// chance to render the reveal yet — hold here briefly before moving on to
// the order choice. Advancing out of this phase is handled by onTimerExpired
// (see index.ts, case "rps_reveal").
export function beginRpsReveal(state: FaceturnServerState): EngineResult {
	state.phase = "rps_reveal";
	return makeResult(state, C.RPS_REVEAL_DURATION_MS);
}

// rps has a winner but turn order isn't decided yet — stop here and let the
// winner choose to go first or second. setTurnOrderAfterRps/hand-dealing
// happens once resolveRpsOrderChoice runs (winner's explicit pick, or the
// timeout default in onTimerExpired).
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