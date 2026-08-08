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
import {
	getTuning,
	selectFinalAction,
	decideChallenge,
	decideBlock,
} from "./personality";
import type { CpuDifficulty } from "./types";

export function decideAction(
	state: FaceturnServerState,
	seat: string,
	difficulty: CpuDifficulty,
	rng: () => number = Math.random,
): FaceturnsAction | null {
	const helpers: EngineHelpers = {
		getMoveCost,
		getClassActionCost,
		computeActorWasBluffing,
	};

	const legal = getLegalActions(state, seat, helpers);
	if (legal.length === 0) return null;
	if (legal.length === 1) return legal[0]!;

	const tuning = getTuning(difficulty);

	const fastPathAction = tryFastPath(state, seat, legal, tuning, rng);
	if (fastPathAction) return fastPathAction;

	const result = search(state, seat, helpers, {
		iterations: tuning.iterations,
		rolloutDepth: tuning.rolloutDepth,
		rng,
	});
	if (!result) return legal[0]!; // defensive fallback, shouldnt hit

	return selectFinalAction(result, tuning.actionTemperature, rng);
}

// response-window phases use cheap heuristics instead of ismcts
function tryFastPath(
	state: FaceturnServerState,
	seat: string,
	legal: FaceturnsAction[],
	tuning: ReturnType<typeof getTuning>,
	rng: () => number,
): FaceturnsAction | null {
	switch (state.phase) {
		case "challenge_window":
			return decideInChallengeWindow(state, seat, legal, tuning, rng);
		case "block_window":
			return decideInBlockWindow(state, seat, legal, tuning, rng);
		case "block_declared":
			return decideInBlockDeclared(state, seat, legal, tuning, rng);
		default:
			return null;
	}
}

function decideInChallengeWindow(
	state: FaceturnServerState,
	seat: string,
	legal: FaceturnsAction[],
	tuning: ReturnType<typeof getTuning>,
	rng: () => number,
): FaceturnsAction | null {
	const pending = state.pendingAction;
	if (!pending) return null;

	const challenger = state.players.get(seat);
	const actor = state.players.get(pending.actorId);
	if (!challenger || !actor) return null;

	const canBlock = legal.some((a) => a.type === "block");
	if (canBlock) {
		const striker = actor; // actor is the striker for a strike declaration
		const shouldBlock = decideBlock({
			blocker: challenger,
			striker,
			tuning,
			rng,
		});
		if (shouldBlock) return { type: "block" };
		// if not blocking, still need to decide challenge or pass
	}

	const declaredAction = pending.declaredClass;
	if (!declaredAction || declaredAction === "block") {
		// declaredClass is null for card-driven strikes with no class declaration; nothing to challenge, just pass
		return { type: "pass_challenge" };
	}

	const shouldChallenge = decideChallenge({
		state,
		challenger,
		actor,
		declaredAction,
		tuning,
		rng,
	});

	return shouldChallenge ? { type: "challenge" } : { type: "pass_challenge" };
}

function decideInBlockWindow(
	state: FaceturnServerState,
	seat: string,
	legal: FaceturnsAction[],
	tuning: ReturnType<typeof getTuning>,
	rng: () => number,
): FaceturnsAction | null {
	// block_window only offers 'block' as an action; if not legal, nothing to decide
	if (!legal.some((a) => a.type === "block")) return null;

	const pending = state.pendingAction;
	if (!pending) return null;
	const blocker = state.players.get(seat);
	const striker = state.players.get(pending.actorId);
	if (!blocker || !striker) return null;

	const shouldBlock = decideBlock({ blocker, striker, tuning, rng });
	return shouldBlock ? { type: "block" } : null;
}

function decideInBlockDeclared(
	state: FaceturnServerState,
	seat: string,
	legal: FaceturnsAction[],
	tuning: ReturnType<typeof getTuning>,
	rng: () => number,
): FaceturnsAction | null {
	const canChallengeBlock = legal.some((a) => a.type === "challenge_block");
	if (!canChallengeBlock) return { type: "accept_block" };

	const pending = state.pendingAction;
	if (!pending) return { type: "accept_block" };

	const originalStriker = state.players.get(seat);
	const blocker = state.players.get(pending.actorId);
	if (!originalStriker || !blocker) return { type: "accept_block" };

	// challenging a block is the same bluff-catch question; reuse decideChallenge with declaredAction fixed to 'block'
	const shouldChallenge = decideChallenge({
		state,
		challenger: originalStriker,
		actor: blocker,
		declaredAction: "block",
		tuning,
		rng,
	});

	return shouldChallenge
		? { type: "challenge_block" }
		: { type: "accept_block" };
}