import { SUSSY_SCORING } from "./constants.js";

export type CorrectVoteMap = Map<string, number>;

export interface VoteOutcome {
	impostorId: string;
	votes: Map<string, string | null>;
	playerCount: number;
}

export interface TaskScoreResult {
	deltas: Record<string, number>;
	wasCaught: boolean;
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

export function scoreTaskVote(
	outcome: VoteOutcome,
	taskNumber: 1 | 2 | 3,
	correctCount: CorrectVoteMap,
	allowCaught = true,
): TaskScoreResult {
	const { impostorId, votes, playerCount } = outcome;
	const majority = getMajorityTarget(votes, playerCount);
	const rawCaught = majority === impostorId;
	const wasCaught = allowCaught && rawCaught;
	const deltas: Record<string, number> = {};

	for (const [voterId, targetId] of votes) {
		if (voterId === impostorId) continue;
		if (targetId !== impostorId) continue;

		const prior = correctCount.get(voterId) ?? 0;
		let points: number;

		if (wasCaught) {
			const tierIdx = Math.min(prior, 2) as 0 | 1 | 2;
			points = SUSSY_SCORING.CAUGHT[taskNumber][tierIdx];
		} else {
			const tier = Math.min(prior + 1, 3) as 1 | 2 | 3;
			points = SUSSY_SCORING.SLEUTH[tier];
		}

		deltas[voterId] = (deltas[voterId] ?? 0) + points;
		correctCount.set(voterId, prior + 1);
	}

	if (!wasCaught) {
		const tier = Math.min(taskNumber, 3) as 1 | 2 | 3;
		deltas[impostorId] =
			(deltas[impostorId] ?? 0) + SUSSY_SCORING.FAKER_SURVIVED[tier];
	}

	return { deltas, wasCaught };
}

export function scoreThumbVote(outcome: VoteOutcome): TaskScoreResult {
	const { impostorId, votes, playerCount } = outcome;
	const majority = getMajorityTarget(votes, playerCount);
	const wasCaught = majority === impostorId;
	const deltas: Record<string, number> = {};

	for (const [voterId, targetId] of votes) {
		if (voterId === impostorId) continue;
		if (targetId !== impostorId) continue;
		deltas[voterId] = wasCaught
			? SUSSY_SCORING.THUMB_MAJORITY_CATCH
			: SUSSY_SCORING.THUMB_CORRECT_VOTER;
	}

	if (!wasCaught) {
		deltas[impostorId] =
			(deltas[impostorId] ?? 0) + SUSSY_SCORING.THUMB_FAKER_ESCAPE;
	}

	return { deltas, wasCaught };
}

export function mergeDeltas(
	...maps: Record<string, number>[]
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const map of maps) {
		for (const [id, delta] of Object.entries(map)) {
			result[id] = (result[id] ?? 0) + delta;
		}
	}
	return result;
}
