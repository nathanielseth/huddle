import { SUSSY_SCORING } from "./constants";

export interface VoteOutcome {
	impostorId: string;
	votes: Map<string, string | null>;
	playerCount: number;
}

export interface TaskScoreResult {
	deltas: Record<string, number>;
	wasCaught: boolean;
	// crew who correctly identified the impostor this task. engine owns updating
	// correctVoteCount and totalSleuthed from this
	newCorrectVoters: ReadonlySet<string>;
}

// the only places that touch SUSSY_SCORING indices. no call site should do
// Math.min or array index arithmetic directly
function sleuthPoints(priorCorrect: number): number {
	return SUSSY_SCORING.SLEUTH[Math.min(priorCorrect, 2) as 0 | 1 | 2];
}

function caughtPoints(taskNumber: 1 | 2 | 3, priorCorrect: number): number {
	return SUSSY_SCORING.CAUGHT[taskNumber][
		Math.min(priorCorrect, 2) as 0 | 1 | 2
	];
}

function fakerSurvivedPoints(taskNumber: 1 | 2 | 3): number {
	return SUSSY_SCORING.FAKER_SURVIVED[taskNumber];
}

export function getMajorityTarget(
	votes: Map<string, string | null>,
	playerCount: number,
): string | null {
	const tally = new Map<string, number>();
	for (const targetId of votes.values()) {
		if (!targetId) continue;
		tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
	}
	const threshold = Math.floor(playerCount / 2) + 1;
	for (const [targetId, count] of tally) {
		if (count >= threshold) return targetId;
	}
	return null;
}

// pure scoring for all non-thumb task votes. reads correctCount to determine
// tier but never writes — mutation is the engine's responsibility
export function scoreTaskVote(
	outcome: VoteOutcome,
	taskNumber: 1 | 2 | 3,
	correctCount: ReadonlyMap<string, number>,
	allowCaught: boolean,
): TaskScoreResult {
	const { impostorId, votes, playerCount } = outcome;
	const majority = getMajorityTarget(votes, playerCount);
	const wasCaught = allowCaught && majority === impostorId;
	const deltas: Record<string, number> = {};
	const newCorrectVoters = new Set<string>();

	for (const [voterId, targetId] of votes) {
		if (voterId === impostorId) continue;
		if (targetId !== impostorId) continue;

		newCorrectVoters.add(voterId);

		const prior = correctCount.get(voterId) ?? 0;
		const points = wasCaught
			? caughtPoints(taskNumber, prior)
			: sleuthPoints(prior);

		deltas[voterId] = (deltas[voterId] ?? 0) + points;
	}

	if (!wasCaught) {
		deltas[impostorId] =
			(deltas[impostorId] ?? 0) + fakerSurvivedPoints(taskNumber);
	}

	return { deltas, wasCaught, newCorrectVoters };
}

// pure scoring for thumb_shot votes. always ends the round after single vote
// phase so correctCount tiers don't apply — all bonuses are flat
export function scoreThumbVote(outcome: VoteOutcome): TaskScoreResult {
	const { impostorId, votes, playerCount } = outcome;
	const majority = getMajorityTarget(votes, playerCount);
	const wasCaught = majority === impostorId;
	const deltas: Record<string, number> = {};
	const newCorrectVoters = new Set<string>();

	for (const [voterId, targetId] of votes) {
		if (voterId === impostorId) continue;
		if (targetId !== impostorId) continue;
		newCorrectVoters.add(voterId);
		deltas[voterId] = wasCaught
			? SUSSY_SCORING.THUMB_MAJORITY_CATCH
			: SUSSY_SCORING.THUMB_CORRECT_VOTER;
	}

	if (!wasCaught) {
		deltas[impostorId] =
			(deltas[impostorId] ?? 0) + SUSSY_SCORING.THUMB_FAKER_ESCAPE;
	}

	return { deltas, wasCaught, newCorrectVoters };
}