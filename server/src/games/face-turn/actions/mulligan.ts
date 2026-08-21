import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import { mulliganPlayer, startTurn } from "../game";
import { makeResult } from "../action-results";
import { buildPrivatePayloads } from "../state-builders";

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
		return makeResult(state, C.ACTIVE_TURN_DURATION_MS, {
			privatePayloads: buildPrivatePayloads(state),
		});
	}

	return makeResult(state, ctx.room.timer?.duration ?? null, {
		privatePayloads: buildPrivatePayloads(state),
	});
};