import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../types";
import { getLegalActions, type EngineHelpers } from "./legal-actions";

export type RolloutChoice =
	| { kind: "action"; action: FaceturnsAction }
	| { kind: "decline_via_timeout" }
	| { kind: "none" };

export function sampleRolloutAction(
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
	rng: () => number,
): RolloutChoice {
	const legal = getLegalActions(state, seat, helpers);

	// block_window only ever offers "block"; give the rollout a real chance
	// to see the unblocked outcome too, same as the search tree does
	if (state.phase === "block_window") {
		const blockAction = legal.find((a) => a.type === "block");
		if (!blockAction) return { kind: "none" };
		return rng() < 0.5
			? { kind: "action", action: blockAction }
			: { kind: "decline_via_timeout" };
	}

	if (legal.length === 0) return { kind: "none" };
	return { kind: "action", action: legal[Math.floor(rng() * legal.length)]! };
}
