import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../types";
import {
	getMoveCost,
	getClassActionCost,
	computeActorWasBluffing,
} from "../game";
import type { EngineHelpers } from "./legal-actions";
import { getLegalActions } from "./legal-actions";
import { search } from "./ismcts";
import { selectFinalAction } from "./select-action";
import type { CpuTuning, StrategyOverride } from "./types";

export const TUNING: CpuTuning = {
	iterations: 800,
	rolloutDepth: 6,
	actionTemperature: 0.12,
	thinkMs: [300, 800],
};

export function getTuning(): CpuTuning {
	return TUNING;
}

export function decideAction(
	state: FaceturnServerState,
	seat: string,
	rng: () => number = Math.random,
	tuningOverride?: Partial<CpuTuning>,
	strategyOverride?: StrategyOverride,
): FaceturnsAction | null {
	const helpers: EngineHelpers = {
		getMoveCost,
		getClassActionCost,
		computeActorWasBluffing,
	};

	const legal = getLegalActions(state, seat, helpers, rng);
	if (legal.length === 0) return null;
	if (legal.length === 1) return legal[0]!;

	const tuning: CpuTuning = tuningOverride
		? { ...getTuning(), ...tuningOverride }
		: getTuning();

	const result = search(state, seat, helpers, {
		iterations: tuning.iterations,
		rolloutDepth: tuning.rolloutDepth,
		rng,
		...(strategyOverride ? { strategyOverride } : {}),
	});
	if (!result) return legal[0]!; // defensive fallback, shouldnt hit

	return selectFinalAction(result, tuning.actionTemperature, rng);
}