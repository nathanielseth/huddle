import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../types";

export interface CpuTuning {
	readonly iterations: number;
	readonly rolloutDepth: number;
	readonly actionTemperature: number;
	readonly thinkMs: readonly [min: number, max: number];
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