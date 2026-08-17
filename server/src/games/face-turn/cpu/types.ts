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

// state-scoring function signature, matching evaluate.ts's `evaluate` export
export type EvaluateFn = (
	state: FaceturnServerState,
	seat: string,
) => StateScore;

// rollout-policy function signature, matching rollout.ts's `sampleRolloutAction` export
export type RolloutPolicyFn = (
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
	rng: () => number,
	// see sampleRolloutAction's precomputedLegal param — callers that already
	// have the legal-action list for this (state, seat) should pass it
	// through rather than let the policy recompute it.
	precomputedLegal?: readonly FaceturnsAction[],
) => RolloutChoice;

// Injection seam for A/B-comparing two search-quality configs of the SAME
// codebase (see server/scripts/faceturn-sim/versus.ts). Left undefined in
// every production call path, so decideAction/search fall back to the real
// evaluate()/sampleRolloutAction() imports and behavior is unchanged.
// This exists so a script can run decideAction twice per decision with two
// different {evaluate, rolloutPolicy} bundles and attribute any win-rate
// skew to search quality rather than RNG — without needing a second
// duplicated `cpu2/` implementation tree.
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