import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { FaceturnServerPlayer, FaceturnServerState } from "../types";
import type { CpuDifficulty, CpuTuning } from "./types";
import type { IsmctsResult } from "./ismcts";

const TUNING: Record<CpuDifficulty, CpuTuning> = {
	normal: {
		iterations: 120,
		rolloutDepth: 6,
		actionTemperature: 0.9,
		challengeAccuracy: 0.55,
		thinkMs: [400, 1100],
	},
	hard: {
		iterations: 600,
		rolloutDepth: 10,
		actionTemperature: 0.35,
		challengeAccuracy: 0.78,
		thinkMs: [600, 1600],
	},
	brutal: {
		iterations: 2000,
		rolloutDepth: 14,
		actionTemperature: 0.08,
		challengeAccuracy: 0.93,
		thinkMs: [500, 1400],
	},
};

export function getTuning(difficulty: CpuDifficulty): CpuTuning {
	return TUNING[difficulty];
}

export function sampleThinkMs(
	tuning: CpuTuning,
	rng: () => number = Math.random,
): number {
	const [min, max] = tuning.thinkMs;
	return Math.round(min + rng() * (max - min));
}

// temperature 0 = argmax. higher temperature softens to visit-proportional sampling so weaker cpus dont always pick the best line
export function selectFinalAction(
	result: IsmctsResult,
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

export interface ChallengeHeuristicInput {
	readonly state: FaceturnServerState;
	readonly challenger: FaceturnServerPlayer;
	readonly actor: FaceturnServerPlayer;
	readonly declaredAction: "strike" | "collect" | "unturn" | "block";
	readonly tuning: CpuTuning;
	readonly rng: () => number;
}

// suspicion is based on how many hidden crew the actor has left (more hidden = more room to bluff) and the stakes of the declared action
// accuracy-gated: lower difficulties sometimes ignore the suspicion signal and flip a coin
export function decideChallenge(input: ChallengeHeuristicInput): boolean {
	const { state, challenger, actor, declaredAction, tuning, rng } = input;
	void state;

	const actorHiddenCrew = countFaceDown(actor);
	const challengerHiddenCrew = countFaceDown(challenger);

	let suspicion = 0.28;

	suspicion += actorHiddenCrew * 0.1;

	if (declaredAction === "strike") suspicion += 0.08;
	if (declaredAction === "collect") suspicion -= 0.05;

	if (challengerHiddenCrew === 0) suspicion += 0.05;

	suspicion = clamp01(suspicion);

	const followHeuristic = rng() < tuning.challengeAccuracy;
	const heuristicSaysChallenge = suspicion > 0.5;

	return followHeuristic ? heuristicSaysChallenge : rng() < 0.5;
}

// no separate bluff action; ismcts itself decides to bluff by evaluating class-action declares as worthwhile even without the matching crew
// a separate decideBluff would duplicate the search's reasoning

export interface BlockHeuristicInput {
	readonly blocker: FaceturnServerPlayer;
	readonly striker: FaceturnServerPlayer;
	readonly tuning: CpuTuning;
	readonly rng: () => number;
}

// blocking weighs the value of protecting a hidden crew against the cost of eating a strike
// same accuracy-gated pattern as challenge: accuracy controls how much the heuristic is followed
export function decideBlock(input: BlockHeuristicInput): boolean {
	const { blocker, striker, tuning, rng } = input;
	void striker;

	const hiddenCrew = countFaceDown(blocker);
	if (hiddenCrew === 0) return false;

	let willingness = hiddenCrew === 1 ? 0.62 : 0.4;

	if (blocker.cash >= 3) willingness += 0.1;

	willingness = clamp01(willingness);

	const followHeuristic = rng() < tuning.challengeAccuracy;
	const heuristicSaysBlock = willingness > 0.5;

	return followHeuristic ? heuristicSaysBlock : rng() < 0.5;
}

function countFaceDown(player: FaceturnServerPlayer): number {
	let count = 0;
	for (let i = 0; i < 2; i++) {
		const slot = i as 0 | 1;
		if (player.crewIds[slot] && !player.crewTurned[slot]) count += 1;
	}
	return count;
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}