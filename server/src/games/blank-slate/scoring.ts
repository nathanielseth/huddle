import type { BlankSlateResolvedClue } from "./types";

export function scoreRound(
	guesserPlayerId: string,
	correct: boolean,
	resolvedClues: BlankSlateResolvedClue[],
): Record<string, number> {
	if (!correct) return {};

	const deltas: Record<string, number> = { [guesserPlayerId]: 2 };

	for (const { playerId, eliminated } of resolvedClues) {
		if (!eliminated) {
			deltas[playerId] = (deltas[playerId] ?? 0) + 1;
		}
	}

	return deltas;
}