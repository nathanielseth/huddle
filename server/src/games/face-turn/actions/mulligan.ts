import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { mulliganPlayer, startTurn } from "../game";
import { makeResult, afterAction } from "../action-results";

export const mulliganAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	void playerId;
	const noOp = () => noOpResult(state, ctx);

	if (action.type !== "mulligan") return noOp();
	if (player.mulliganDecided) return noOp();
	mulliganPlayer(player, action.redraw, state.rng);
	player.mulliganDecided = true;

	const allDecided = [...state.players.values()].every(
		(p) => p.mulliganDecided,
	);

	if (allDecided) {
		state.phase = "active_turn";
		startTurn(state, state.turnOrder[0]!);
		// startTurn() can open a pendingInteraction (e.g. void_legs_choice), routed through afterAction()
		// so that case gets its own INTERACTION_WINDOW_MS instead of the generic active-turn duration
		return afterAction(state);
	}

	return makeResult(state, ctx.room.timer?.duration ?? null);
};