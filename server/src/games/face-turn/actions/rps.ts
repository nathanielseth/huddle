import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import { resolveRps } from "../game";
import { makeResult, beginRpsReveal } from "../action-results";

export const rpsAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	const noOp = () => noOpResult(state, ctx);

	if (state.mode === "ffa") return noOp();
	const [rep1, rep2] = state.playerOrder;
	if (playerId !== rep1 && playerId !== rep2) return noOp();

	if (action.type === "rps_choice") {
		state.rpsChoices.set(playerId, action.choice);

		if (state.rpsChoices.size === 2) {
			const [p1Id, p2Id] = state.playerOrder;
			state.rpsResult = resolveRps(p1Id, p2Id, state.rpsChoices, state.rng);
			return beginRpsReveal(state);
		}

		return makeResult(state, C.RPS_DURATION_MS);
	}

	return noOp();
};