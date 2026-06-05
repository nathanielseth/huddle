export const MAX_ANSWER_LENGTH = 150;
export const FINAL_VOTE_TOKENS = 3;
export const MEDALS = ["🥇", "🥈", "🥉"] as const;
export const roundLabel = (round: number) =>
	round === 3 ? "Final Round" : `Round ${round}`;