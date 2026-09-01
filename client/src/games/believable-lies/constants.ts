// Client-side mirror of server/games/believable-lies/constants.ts
// These are used for display-only purposes (timers, progress bars).
// They do NOT affect game logic — the server is authoritative.
// Update here if you change the server constants.

import type { BelievableLiesPhase } from "@shared/games/believable-lies/index";

// Single source of truth for phase durations, keyed by phase. Phases
// with no timer (currently just "finished") are omitted from the map.
export const PHASE_DURATION_MS: Partial<Record<BelievableLiesPhase, number>> = {
	question_select: 15_000,
	lie_input: 60_000,
	picking: 30_000,
	result: 10_000,
	round_end: 8_000,
};

// Step timings within the result phase (relative to phase start).
// ~22 % and ~48 % through PHASE_DURATION_MS.result.
export const RESULT_STEP_PICKS_AT_MS = 2_200;
export const RESULT_STEP_SCORES_AT_MS = 4_800;