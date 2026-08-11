import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { MoIsmctsResult } from "./ismcts";

// temperature-weighted sampling of mcts visit distribution: low temperature picks most-visited (exploit), high temperature picks uniformly (explore)
export function selectFinalAction(
	result: MoIsmctsResult,
	temperature: number,
	rng: () => number = Math.random,
): FaceturnsAction {
	if (result.rootVisits.length === 0 || temperature <= 0) {
		return result.action;
	}

	const maxVisits = Math.max(...result.rootVisits.map((r) => r.visits));
	if (maxVisits <= 0) return result.action;

	const weights = result.rootVisits.map((r) =>
		Math.exp(r.visits / maxVisits / Math.max(temperature, 1e-6)),
	);
	const total = weights.reduce((a, b) => a + b, 0);
	if (!Number.isFinite(total) || total <= 0) return result.action;

	let roll = rng() * total;
	for (let i = 0; i < result.rootVisits.length; i++) {
		roll -= weights[i]!;
		if (roll <= 0) return result.rootVisits[i]!.action;
	}
	return result.action;
}