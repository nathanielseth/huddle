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
	precomputedLegal?: readonly FaceturnsAction[],
): RolloutChoice {
	const legal = precomputedLegal ?? getLegalActions(state, seat, helpers, rng);

	if (state.phase === "defend_window") {
		const defendAction = legal.find((a) => a.type === "defend");
		if (!defendAction) return { kind: "none" };

		const defender = state.players.get(seat);
		const isBluffing =
			defender !== undefined &&
			helpers.computeActorWasBluffing(defender, "defend");

		if (!isBluffing) return { kind: "action", action: defendAction };

		const roll = Math.floor(rng() * 2);
		return roll === 0
			? { kind: "action", action: defendAction }
			: { kind: "decline_via_timeout" };
	}

	if (legal.length === 0) return { kind: "none" };
	return { kind: "action", action: legal[Math.floor(rng() * legal.length)]! };
}