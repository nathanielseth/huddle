import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { resolveRpsOrderChoice } from "../action-results";

// only the rps winner acts here; everyone else (including the rps loser)
// is a spectator, same shape as rpsAction's rep-only gating.
export const rpsOrderChoiceAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	void player;
	const noOp = () => noOpResult(state, ctx);

	if (action.type !== "rps_order_choice") return noOp();
	if (playerId !== state.rpsOrderChoiceWinnerId) return noOp();

	return resolveRpsOrderChoice(state, action.goFirst);
};
