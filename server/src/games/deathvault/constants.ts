// economy
export const STARTING_CASH = 1_000;
export const MIN_WAGER = 0;
export const CASH_FLOOR = 0;

// game structure
export const NORMAL_ROUNDS = 7;
export const TOTAL_ROUNDS = NORMAL_ROUNDS + 1;

// phase timers (milliseconds)
export const WAGER_MS = 20_000;
export const QUESTION_MS = 25_000;
export const QUESTION_RESULT_MS = 8_000;
export const MINIGAME_INTRO_MS = 5_000;
export const ROUND_END_MS = 6_000;
export const PODIUM_MS = 0;

export const LAVA_PICK_MS = 10_000;
export const SCRAMBLE_MS = 30_000;
export const TOXIC_ANSWER_MS = 12_000;
export const MONEY_GRAB_MS = 15_000;
export const HIGHER_LOWER_GUESS_MS = 8_000;
export const FINAL_CUT_MS = 20_000;
export const DILEMMA_MS = 25_000;
export const MINIGAME_RESULT_MS = 8_000;

// floor is lava
export const LAVA_GRID_SIZE: Record<number, number> = {
	2: 9, // 3×3
	3: 9,
	4: 16, // 4×4
	5: 16,
	6: 25, // 5×5
	7: 25,
	8: 25,
};
export const LAVA_WAVES = 3;

// money grab
export const MONEY_GRAB_DURATION_MS = 15_000;
export const MONEY_GRAB_PENALTY_PER_LOSER = 200;

// higher / lower
export const HIGHER_LOWER_SEQUENCE_LENGTH = 6;
export const HIGHER_LOWER_NUMBER_RANGE: [number, number] = [1, 99];
export const HIGHER_LOWER_STREAK_MULTIPLIERS = [1, 1.25, 1.5, 2, 2.5, 3];

// minigame prize pools
export const MINIGAME_STAKE_PER_PLAYER = 200;
export const DILEMMA_STAKE_PER_PLAYER = 300;

// final round
export const FINAL_WAGER_MAX_MULTIPLIER = 2;

// input limits
export const MAX_SCRAMBLE_WORD_LENGTH = 32;