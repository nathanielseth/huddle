import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../types";
import { determinize } from "./determinize";
import { getLegalActions, type EngineHelpers } from "./legal-actions";
import { applyAction, applyTimerExpired, isTerminal } from "./simulate";
import { rollout } from "./policy";
import { evaluate } from "./evaluate";
import { markDeterminized, type DeterminizedState } from "./types";

interface TreeNode {
	readonly seat: string;
	readonly actionKey: string;
	readonly action: FaceturnsAction | null;
	// block_window only offers "block" but the tree also needs a "let it time out" child to represent the unblocked outcome
	// otherwise the search would overvalue blocking
	readonly isTimeoutDecline: boolean;
	visits: number;
	totalValue: number; // from root seats perspective
	children: Map<string, TreeNode>;
	// tracks which action keys have been expanded under any determinization so far,
	// separate from children.keys() because legal sets can differ across determinizations
	expandedKeys: Set<string>;
}

const TIMEOUT_DECLINE_KEY = "__timeout_decline__";

function actionKey(action: FaceturnsAction): string {
	return JSON.stringify(sortedEntries(action));
}

function sortedEntries(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortedEntries);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, v]) => v !== undefined)
				.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
				.map(([k, v]) => [k, sortedEntries(v)]),
		);
	}
	return value;
}

function createNode(
	seat: string,
	action: FaceturnsAction | null,
	isTimeoutDecline = false,
): TreeNode {
	return {
		seat,
		actionKey: isTimeoutDecline
			? TIMEOUT_DECLINE_KEY
			: action
				? actionKey(action)
				: "",
		action,
		isTimeoutDecline,
		visits: 0,
		totalValue: 0,
		children: new Map(),
		expandedKeys: new Set(),
	};
}

const EXPLORATION_CONSTANT = Math.SQRT2;

function ucb1(child: TreeNode, parentVisits: number): number {
	if (child.visits === 0) return Infinity;
	const exploitation = child.totalValue / child.visits;
	const exploration =
		EXPLORATION_CONSTANT * Math.sqrt(Math.log(parentVisits) / child.visits);
	return exploitation + exploration;
}

export interface IsmctsConfig {
	readonly iterations: number;
	readonly rolloutDepth: number;
	readonly rng: () => number;
}

export interface IsmctsResult {
	readonly action: FaceturnsAction;
	// visit-count distribution over root-level actions, for temperature sampling in personality.ts
	readonly rootVisits: readonly {
		action: FaceturnsAction;
		visits: number;
		value: number;
	}[];
}

// returns recommended action and root visit counts; null if no legal actions exist
export function search(
	rootState: FaceturnServerState,
	rootSeat: string,
	helpers: EngineHelpers,
	config: IsmctsConfig,
): IsmctsResult | null {
	const rootLegal = getLegalActions(rootState, rootSeat, helpers);
	if (rootLegal.length === 0) return null;
	if (rootLegal.length === 1) {
		return {
			action: rootLegal[0]!,
			rootVisits: [{ action: rootLegal[0]!, visits: 1, value: 0 }],
		};
	}

	const root = createNode(rootSeat, null);

	for (let i = 0; i < config.iterations; i++) {
		runIteration(root, rootState, rootSeat, helpers, config);
	}

	// root children are never timeout-decline here because block_window is handled by the fast path,
	// but filter defensively in case routing changes
	const rootVisits = [...root.children.values()]
		.filter((child) => !child.isTimeoutDecline)
		.map((child) => ({
			action: child.action!,
			visits: child.visits,
			value: child.visits > 0 ? child.totalValue / child.visits : 0,
		}));

	if (rootVisits.length === 0) {
		return { action: rootLegal[0]!, rootVisits: [] };
	}

	const best = rootVisits.reduce((a, b) => (b.visits > a.visits ? b : a));
	return { action: best.action, rootVisits };
}

function runIteration(
	root: TreeNode,
	rootState: FaceturnServerState,
	rootSeat: string,
	helpers: EngineHelpers,
	config: IsmctsConfig,
): void {
	// fresh determinization per iteration prevents overfitting to a single guessed hand
	let state: DeterminizedState = determinize(rootState, rootSeat);

	const path: TreeNode[] = [root];
	let node = root;

	for (;;) {
		if (isTerminal(state)) break;

		const seat = actingSeatFor(state, helpers);
		if (!seat) break;

		const legal = getLegalActions(state, seat, helpers);
		if (legal.length === 0) break;

		const offersTimeoutDecline = state.phase === "block_window";
		const candidateKeys = legal.map(actionKey);
		if (offersTimeoutDecline) candidateKeys.push(TIMEOUT_DECLINE_KEY);

		for (const action of legal) {
			const key = actionKey(action);
			if (!node.expandedKeys.has(key)) {
				node.expandedKeys.add(key);
				node.children.set(key, createNode(seat, action));
			}
		}
		if (offersTimeoutDecline && !node.expandedKeys.has(TIMEOUT_DECLINE_KEY)) {
			node.expandedKeys.add(TIMEOUT_DECLINE_KEY);
			node.children.set(TIMEOUT_DECLINE_KEY, createNode(seat, null, true));
		}

		const candidates = candidateKeys.map((key) => node.children.get(key)!);
		const unvisited = candidates.filter((c) => c.visits === 0);

		if (unvisited.length > 0) {
			const chosen = unvisited[Math.floor(config.rng() * unvisited.length)]!;
			// the determinized brand is not automatically preserved by simulate.ts, so re-mark after applying the action
			state = markDeterminized(
				chosen.isTimeoutDecline
					? applyTimerExpired(state)
					: applyAction(state, seat, chosen.action!),
			);
			path.push(chosen);
			node = chosen;
			break;
		}

		const nextNode = candidates.reduce((best, c) =>
			ucb1(c, node.visits) > ucb1(best, node.visits) ? c : best,
		);

		state = markDeterminized(
			nextNode.isTimeoutDecline
				? applyTimerExpired(state)
				: applyAction(state, seat, nextNode.action!),
		);
		path.push(nextNode);
		node = nextNode;
	}

	const value = isTerminal(state)
		? evaluate(state, rootSeat)
		: rollout(state, rootSeat, config.rolloutDepth, helpers, config.rng);

	// value is already rootSeat-relative from evaluate()/rollout(); no per‑player flip needed
	// because evaluate() already accounts for team membership
	for (const visitedNode of path) {
		visitedNode.visits += 1;
		visitedNode.totalValue += value;
	}
}

// find the seat that can act, accounting for windows that shift authority away from activePlayerId
function actingSeatFor(
	state: FaceturnServerState,
	helpers: EngineHelpers,
): string | null {
	for (const seatId of state.players.keys()) {
		if (state.eliminatedPlayers.has(seatId)) continue;
		if (getLegalActions(state, seatId, helpers).length > 0) return seatId;
	}
	return null;
}