import type { BelievableLiesRound } from "../../../../shared/games/believable-lies";

export const LIE_INPUT_MS = 60_000;
export const PICKING_MS = 30_000;
export const RESULT_MS = 10_000;
export const ROUND_END_MS = 8_000;
export const QUESTION_SELECT_MS = 15_000;

export const CATEGORY_CHOICE_COUNT = 3;
export const MIN_PLAYERS = 2;

export const QUESTIONS_PER_ROUND: Record<BelievableLiesRound, number> = {
	1: 3,
	2: 3,
	3: 1,
};

export const ROUND_MULTIPLIER: Record<BelievableLiesRound, number> = {
	1: 1,
	2: 2,
	3: 3,
};

// points for correctly picking the truth
export const TRUTH_BASE = 1_000;

// points per person fooled by player lie
export const FOOL_BASE = 500;

// padded with game_lies if non-truth answers fall below this
export const MIN_ANSWER_POOL_SIZE = 4;

// max raw lie length accepted from clients
export const MAX_LIE_LENGTH = 80;