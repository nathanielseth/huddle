export const ANSWERING_MS = 60_000;
export const VOTING_MS = 30_000;
export const REVEAL_MS = 5_000;
export const ROUND_END_MS = 8_000;
export const FINAL_ANSWERING_MS = 60_000;
export const FINAL_VOTING_MS = 40_000;

// points per vote received (R1), doubled in R2
export const PTS_PER_VOTE = 10;
// winner bonus — more votes than opponent (R1), doubled in R2
export const WINNER_BONUS = 100;
// "witty!",  ALL eligible votes went to you (R1), replaces winner bonus, doubled in R2
export const WITTY_BONUS = 250;
// one player didn't submit, submitter gets this bonus (R1), doubled in R2
export const DEFAULT_BONUS = 100;
// final round: (tokens received / total tokens) x this value
export const FINAL_SCORE_BASE = 1_000;

export const MAX_ANSWER_LENGTH = 150;
export const FINAL_VOTE_TOKENS = 3;