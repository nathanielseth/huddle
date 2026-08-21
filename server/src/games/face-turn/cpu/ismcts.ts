import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerState } from "../types";
import { determinize } from "./determinize";
import { getLegalActions, type EngineHelpers } from "./legal-actions";
import { applyAction, applyTimerExpired, isTerminal } from "./simulate";
import { evaluate as defaultEvaluate } from "./evaluate";
import {
	markDeterminized,
	type DeterminizedState,
	type StrategyOverride,
	type EvaluateFn,
	type RolloutPolicyFn,
} from "./types";
import { sampleRolloutAction as defaultRolloutPolicy } from "./rollout";

const TIMEOUT_DECLINE_KEY = "__timeout_decline__";

function moveKey(action: FaceturnsAction): string {
	return JSON.stringify(action);
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
	readonly strategyOverride?: StrategyOverride;
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
	const rootLegal = getLegalActions(rootState, rootSeat, helpers, config.rng);
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

	const evaluateFn = config.strategyOverride?.evaluate ?? defaultEvaluate;
	const rolloutPolicyFn =
		config.strategyOverride?.rolloutPolicy ?? defaultRolloutPolicy;

	for (let i = 0; i < config.iterations; i++) {
		runIteration(
			treeFor,
			rootState,
			rootSeat,
			helpers,
			config,
			evaluateFn,
			rolloutPolicyFn,
		);
	}

	const rootTree = treeFor(rootSeat);
	const rootVisits = [...rootTree.edges.values()].flatMap((edge) =>
		edge.isTimeoutDecline
			? []
			: [
					{
						action: edge.action!,
						visits: edge.visits,
						value: edge.visits > 0 ? edge.totalValue / edge.visits : 0,
					},
				],
	);

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
	evaluateFn: EvaluateFn,
	rolloutPolicyFn: RolloutPolicyFn,
): void {
	// fresh determinization per iteration. reusing one across iterations would overfit the search to a single guessed hidden state
	let state: DeterminizedState = determinize(rootState, rootSeat, config.rng);

	// current position within each seat's tree, advanced in lockstep as we descend the sampled determinized line
	const current = new Map<string, Node>();
	// path of (seat, edge) pairs visited this iteration, for backprop
	const path: { seat: string; edge: Edge }[] = [];

	for (;;) {
		if (isTerminal(state)) break;

		const acting = actingSeatFor(state, helpers, config.rng);
		if (!acting) break;
		const { seat, legal } = acting;

		if (legal.length === 0) break;

		const offersTimeoutDecline = state.phase === "defend_window";
		const keys = legal.map(moveKey);

		// selection/expansion happens in every seat's tree, keyed by that seat's view of the move (the "descend all trees in parallel" step). seats other than the actor also advance so their trees learn the game shape even where they don't act.
		let actorEdge: Edge | null = null;

		for (const observerSeat of allSeats(state)) {
			const tree = current.get(observerSeat) ?? treeFor(observerSeat);
			const node = tree;

			for (let idx = 0; idx < legal.length; idx++) {
				const edge = node.edge(keys[idx]!, legal[idx]!, false);
				edge.availability += 1;
			}
			let timeoutEdge: Edge | null = null;
			if (offersTimeoutDecline) {
				timeoutEdge = node.edge(TIMEOUT_DECLINE_KEY, null, true);
				timeoutEdge.availability += 1;
			}

			const candidateCount = keys.length + (timeoutEdge ? 1 : 0);
			const candidates: Edge[] = new Array<Edge>(candidateCount);
			for (let idx = 0; idx < keys.length; idx++) {
				candidates[idx] = node.edges.get(keys[idx]!)!;
			}
			if (timeoutEdge) candidates[keys.length] = timeoutEdge;

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

	const rootValue = isTerminal(state)
		? evaluateFn(state, rootSeat)
		: rollout(
				state,
				rootSeat,
				config.rolloutDepth,
				helpers,
				config.rng,
				evaluateFn,
				rolloutPolicyFn,
			);

	// each seat’s tree backs up with its own reward (ally shares rootValue, opponent gets negation)
	const rootTeam = state.players.get(rootSeat)?.teamIndex;
	const valueFor = (seat: string): number => {
		if (rootTeam === undefined) return rootValue;
		const seatTeam = state.players.get(seat)?.teamIndex;
		return seatTeam === rootTeam ? rootValue : -rootValue;
	};

	for (const { seat, edge } of path) {
		edge.visits += 1;
		edge.totalValue += valueFor(seat);
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
	rng: () => number,
): { seat: string; legal: readonly FaceturnsAction[] } | null {
	for (const seatId of state.players.keys()) {
		if (state.eliminatedPlayers.has(seatId)) continue;
		const legal = getLegalActions(state, seatId, helpers, rng);
		if (legal.length > 0) return { seat: seatId, legal };
	}
	return null;
}

function rollout(
	state: DeterminizedState,
	rootSeat: string,
	maxDepth: number,
	helpers: EngineHelpers,
	rng: () => number,
	evaluateFn: EvaluateFn,
	rolloutPolicyFn: RolloutPolicyFn,
): number {
	let current: FaceturnServerState = state;

	for (let ply = 0; ply < maxDepth; ply++) {
		if (isTerminal(current)) break;

		const acting = actingSeatFor(current, helpers, rng);
		if (!acting) break;
		const { seat, legal } = acting;

		const choice = rolloutPolicyFn(current, seat, helpers, rng, legal);
		if (choice.kind === "none") break;

		current =
			choice.kind === "decline_via_timeout"
				? applyTimerExpired(current)
				: applyAction(current, seat, choice.action);
	}

	return evaluateFn(current, rootSeat);
}