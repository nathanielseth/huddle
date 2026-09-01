import type { GameContext, EngineResult } from "../../../engine/GameEngine";
import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type { FaceturnsAction } from "../schemas";
import { noOpResult } from "./types";
import { getInteractionSpec } from "../interactions/registry";
import { makeResult, afterAction } from "../action-results";
import { draftingAction } from "./drafting";
import { rpsAction } from "./rps";
import { rpsOrderChoiceAction } from "./rps-order-choice";
import { mulliganAction } from "./mulligan";
import { activeTurnAction } from "./active-turn";
import {
	moveChainWindowAction,
	challengeWindowAction,
	defendWindowAction,
	defendDeclaredAction,
} from "./challenge-and-chain";

// thin phase router:
// onAction handles player lookup, pending‑interaction short‑circuit (via registry), and dispatch to phase handler
// phase handlers hold the actual game logic
export function dispatchAction(
	ctx: GameContext,
	playerId: string,
	raw: unknown,
): EngineResult {
	const state = ctx.room.gamePayload as FaceturnServerState;
	const action = raw as FaceturnsAction;

	const player = state.players.get(playerId);
	if (!player) return makeResult(state, ctx.room.timer?.duration ?? null);

	if (
		state.eliminatedPlayers.has(playerId) &&
		state.phase !== "drafting" &&
		state.phase !== "mulligan" &&
		state.phase !== "rps" &&
		state.phase !== "rps_order_choice"
	) {
		return makeResult(state, ctx.room.timer?.duration ?? null);
	}

	if (state.phase === "drafting") {
		return draftingAction(state, player, playerId, action, ctx);
	}

	if (state.phase === "rps") {
		return rpsAction(state, player, playerId, action, ctx);
	}

	if (state.phase === "rps_order_choice") {
		return rpsOrderChoiceAction(state, player, playerId, action, ctx);
	}

	if (state.phase === "mulligan") {
		return mulliganAction(state, player, playerId, action, ctx);
	}

	if (state.pendingInteraction !== null) {
		return dispatchPendingInteraction(state, player, playerId, action, ctx);
	}

	if (state.phase === "active_turn") {
		return activeTurnAction(state, player, playerId, action, ctx);
	}

	if (state.phase === "move_chain_window") {
		return moveChainWindowAction(state, player, playerId, action, ctx);
	}

	if (state.phase === "challenge_window") {
		return challengeWindowAction(state, player, playerId, action, ctx);
	}

	if (state.phase === "defend_window") {
		return defendWindowAction(state, player, playerId, action, ctx);
	}

	if (state.phase === "defend_declared") {
		return defendDeclaredAction(state, player, playerId, action, ctx);
	}

	return noOpResult(state, ctx);
}

function dispatchPendingInteraction(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	playerId: string,
	action: FaceturnsAction,
	ctx: GameContext,
): EngineResult {
	const noOp = () => noOpResult(state, ctx);
	const interaction = state.pendingInteraction!;
	const spec = getInteractionSpec(interaction);

	if (playerId !== spec.getResponderId(interaction)) return noOp();
	if (action.type !== spec.actionType) return noOp();

	// each spec’s resolve() clears state.pendingInteraction at the same point as its original branch
	// usually before return, but bonus_strike and background_check_guess clear up front to avoid wiping a new interaction
	const outcome = spec.resolve(state, interaction, action, player);
	if (!outcome) return noOp();

	switch (outcome.kind) {
		case "after_action":
			return afterAction(state);
		case "raw_result":
			return makeResult(state, ctx.room.timer?.duration ?? null);
		case "custom":
			return outcome.result;
	}
}