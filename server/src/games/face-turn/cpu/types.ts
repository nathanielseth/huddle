import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../types";
import type { EngineHelpers } from "./legal-actions";
import type { RolloutChoice } from "./rollout";

export interface CpuTuning {
	readonly iterations: number;
	readonly rolloutDepth: number;
	readonly actionTemperature: number;
	readonly thinkMs: readonly [min: number, max: number];
}

export type EvaluateFn = (
	state: FaceturnServerState,
	seat: string,
) => StateScore;

export type RolloutPolicyFn = (
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
	rng: () => number,
	precomputedLegal?: readonly FaceturnsAction[],
) => RolloutChoice;

export interface StrategyOverride {
	readonly evaluate?: EvaluateFn;
	readonly rolloutPolicy?: RolloutPolicyFn;
}

// search nodes key off serialized actions, but callers get the structured form back
export interface SeatedAction {
	readonly seat: string;
	readonly action: FaceturnsAction;
}

// state here is always the real server state; determinization only happens inside the search
export interface CpuDecisionContext {
	readonly state: FaceturnServerState;
	readonly seat: string;
}

// kept as a plain number because every evaluation call site already knows the perspective
export type StateScore = number;

// branded so simulate/evaluate/legal-actions can't accidentally operate on the real hidden-info state
export type DeterminizedState = FaceturnServerState & {
	readonly __determinized: true;
};

export function markDeterminized(
	state: FaceturnServerState,
): DeterminizedState {
	return state as DeterminizedState;
}