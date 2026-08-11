import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../types";
import { determinize } from "./determinize";
import { getLegalActions, type EngineHelpers } from "./legal-actions";
import { applyAction, applyTimerExpired, isTerminal } from "./simulate";
import { evaluate } from "./evaluate";
import { markDeterminized, type DeterminizedState } from "./types";
import { sampleRolloutAction } from "./rollout";

const TIMEOUT_DECLINE_KEY = "__timeout_decline__";

function moveKey(action: FaceturnsAction): string {
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

interface Edge {
	readonly key: string;
	readonly action: FaceturnsAction | null;
	readonly isTimeoutDecline: boolean;
	visits: number;
	totalValue: number;
	availability: number;
	child: Node;
}

// node identity encodes the information set implicitly via tree position: each seat's tree descends along the single determinized line chosen each iteration
class Node {
	readonly edges = new Map<string, Edge>();

	edge(
		key: string,
		action: FaceturnsAction | null,
		isTimeoutDecline: boolean,
	): Edge {
		let edge = this.edges.get(key);
		if (!edge) {
			edge = {
				key,
				action,
				isTimeoutDecline,
				visits: 0,
				totalValue: 0,
				availability: 0,
				child: new Node(),
			};
			this.edges.set(key, edge);
		}
		return edge;
	}
}

const EXPLORATION_CONSTANT = Math.SQRT2;

// ucb1 with availability counts (so-ismcts with partially observable moves): the log term uses how often this edge could have been chosen, not parent visits
function ucbScore(edge: Edge): number {
	if (edge.visits === 0) return Infinity;
	const exploitation = edge.totalValue / edge.visits;
	const exploration =
		EXPLORATION_CONSTANT *
		Math.sqrt(Math.log(Math.max(edge.availability, 1)) / edge.visits);
	return exploitation + exploration;
}

export interface MoIsmctsConfig {
	readonly iterations: number;
	readonly rolloutDepth: number;
	readonly rng: () => number;
}

export interface MoIsmctsResult {
	readonly action: FaceturnsAction;
	// visit-count distribution over the root seat's own edges, for temperature sampling at the call site
	readonly rootVisits: readonly {
		action: FaceturnsAction;
		visits: number;
		value: number;
	}[];
}

export function search(
	rootState: FaceturnServerState,
	rootSeat: string,
	helpers: EngineHelpers,
	config: MoIsmctsConfig,
): MoIsmctsResult | null {
	const rootLegal = getLegalActions(rootState, rootSeat, helpers);
	if (rootLegal.length === 0) return null;
	if (rootLegal.length === 1) {
		return {
			action: rootLegal[0]!,
			rootVisits: [{ action: rootLegal[0]!, visits: 1, value: 0 }],
		};
	}

	// one tree per seat; created lazily so eliminated or irrelevant seats never pay for a tree
	const trees = new Map<string, Node>();
	const treeFor = (seat: string): Node => {
		let tree = trees.get(seat);
		if (!tree) {
			tree = new Node();
			trees.set(seat, tree);
		}
		return tree;
	};

	for (let i = 0; i < config.iterations; i++) {
		runIteration(treeFor, rootState, rootSeat, helpers, config);
	}

	const rootTree = treeFor(rootSeat);
	const rootVisits = [...rootTree.edges.values()]
		.filter((edge) => !edge.isTimeoutDecline)
		.map((edge) => ({
			action: edge.action!,
			visits: edge.visits,
			value: edge.visits > 0 ? edge.totalValue / edge.visits : 0,
		}));

	if (rootVisits.length === 0) {
		return { action: rootLegal[0]!, rootVisits: [] };
	}

	const best = rootVisits.reduce((a, b) => (b.visits > a.visits ? b : a));
	return { action: best.action, rootVisits };
}

function runIteration(
	treeFor: (seat: string) => Node,
	rootState: FaceturnServerState,
	rootSeat: string,
	helpers: EngineHelpers,
	config: MoIsmctsConfig,
): void {
	// fresh determinization per iteration. reusing one across iterations would overfit the search to a single guessed hidden state
	let state: DeterminizedState = determinize(rootState, rootSeat);

	// current position within each seat's tree, advanced in lockstep as we descend the sampled determinized line
	const current = new Map<string, Node>();
	// path of (seat, edge) pairs visited this iteration, for backprop
	const path: { seat: string; edge: Edge }[] = [];

	for (;;) {
		if (isTerminal(state)) break;

		const seat = actingSeatFor(state, helpers);
		if (!seat) break;

		const legal = getLegalActions(state, seat, helpers);
		if (legal.length === 0) break;

		const offersTimeoutDecline = state.phase === "block_window";

		// selection/expansion happens in every seat's tree, keyed by that seat's view of the move (the "descend all trees in parallel" step). seats other than the actor also advance so their trees learn the game shape even where they don't act.
		let actorEdge: Edge | null = null;

		for (const observerSeat of allSeats(state)) {
			const tree = current.get(observerSeat) ?? treeFor(observerSeat);
			const node = tree;

			const keys = legal.map(moveKey);
			for (let idx = 0; idx < legal.length; idx++) {
				const edge = node.edge(keys[idx]!, legal[idx]!, false);
				edge.availability += 1;
			}
			let timeoutEdge: Edge | null = null;
			if (offersTimeoutDecline) {
				timeoutEdge = node.edge(TIMEOUT_DECLINE_KEY, null, true);
				timeoutEdge.availability += 1;
			}

			const candidates = keys
				.map((key) => node.edges.get(key)!)
				.concat(timeoutEdge ? [timeoutEdge] : []);

			const chosen = selectEdge(candidates);
			current.set(observerSeat, chosen.child);
			path.push({ seat: observerSeat, edge: chosen });

			if (observerSeat === seat) actorEdge = chosen;
		}

		if (!actorEdge) break;

		state = markDeterminized(
			actorEdge.isTimeoutDecline
				? applyTimerExpired(state)
				: applyAction(state, seat, actorEdge.action!),
		);

		// one new node expanded across all trees per iteration; once we hit an unvisited edge, stop descending and rollout from here
		if (actorEdge.visits === 0) break;
	}

	const value = isTerminal(state)
		? evaluate(state, rootSeat)
		: rollout(state, rootSeat, config.rolloutDepth, helpers, config.rng);

	for (const { edge } of path) {
		edge.visits += 1;
		edge.totalValue += value;
	}
}

// ucb1 selection with availability counts. ties break via first-infinite-score found (map iteration order), which is fine because determinization randomizes which unvisited edge appears first across iterations
function selectEdge(candidates: readonly Edge[]): Edge {
	let best = candidates[0]!;
	let bestScore = ucbScore(best);
	for (let i = 1; i < candidates.length; i++) {
		const score = ucbScore(candidates[i]!);
		if (score > bestScore) {
			best = candidates[i]!;
			bestScore = score;
		}
	}
	return best;
}

function allSeats(state: FaceturnServerState): readonly string[] {
	return [...state.players.keys()].filter(
		(seatId) => !state.eliminatedPlayers.has(seatId),
	);
}

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

function rollout(
	state: DeterminizedState,
	rootSeat: string,
	maxDepth: number,
	helpers: EngineHelpers,
	rng: () => number,
): number {
	let current: FaceturnServerState = state;

	for (let ply = 0; ply < maxDepth; ply++) {
		if (isTerminal(current)) break;

		const seat = actingSeatFor(current, helpers);
		if (!seat) break;

		const choice = sampleRolloutAction(current, seat, helpers, rng);
		if (choice.kind === "none") break;

		current =
			choice.kind === "decline_via_timeout"
				? applyTimerExpired(current)
				: applyAction(current, seat, choice.action);
	}

	return evaluate(current, rootSeat);
}