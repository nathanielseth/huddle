import { TRUTH_BASE, FOOL_BASE, ROUND_MULTIPLIER } from "./constants";
import { ABSTAIN } from "./types";
import type { BelievableLiesBuiltAnswer } from "./types";
import type { BelievableLiesRound } from "../../../../shared/games/believable-lies/index";

export function scoreRound(params: {
	round: BelievableLiesRound;
	answerPool: BelievableLiesBuiltAnswer[];
	picks: Map<string, string>;
	playerIds: string[];
}): Record<string, number> {
	const { round, answerPool, picks, playerIds } = params;
	const mult = ROUND_MULTIPLIER[round];
	const deltas: Record<string, number> = {};

	for (const id of playerIds) deltas[id] = 0;

	const answerById = new Map(answerPool.map((a) => [a.id, a]));

	for (const [pickerId, answerId] of picks) {
		if (answerId === ABSTAIN) continue;

		const answer = answerById.get(answerId);
		if (!answer) continue;

		if (answer.isTruth) {
			deltas[pickerId] = (deltas[pickerId] ?? 0) + TRUTH_BASE * mult;
		} else {
			// award fool points to every author of the chosen lie
			for (const authorId of answer.authorIds) {
				if (authorId === pickerId) continue;
				deltas[authorId] = (deltas[authorId] ?? 0) + FOOL_BASE * mult;
			}
		}
	}

	return deltas;
}
