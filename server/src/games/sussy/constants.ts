import type { TaskType } from "../../../../shared/sussy.js";

// ─── Task config ──────────────────────────────────────────────────────────────

export const SELECTABLE_TASKS: TaskType[] = [
	"show_of_hands",
	"finger_pointing",
	"finger_blast",
	"thumb_shot",
	"face_turn",
];

export const TASK_DURATIONS_MS: Record<TaskType, number> = {
	show_of_hands: 15_000,
	finger_pointing: 20_000,
	finger_blast: 15_000,
	thumb_shot: 25_000,
	face_turn: 20_000,
	glitch_in_the_chat: 60_000,
};

export const HANGOUT_NO_SUBMIT_TASKS: readonly TaskType[] = [
	"show_of_hands",
	"finger_pointing",
	"finger_blast",
	"thumb_shot",
	"face_turn",
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * SLEUTH BONUS  (correct vote, no majority required):
 *   1st correct vote this round → 100, 2nd → 125, 3rd → 150
 *
 * CAUGHT BONUS  (majority catches faker — replaces sleuth bonus that task):
 *   Task 1 catch → 375 for all correct voters
 *   Task 2 catch → 250 (first-timers) | 275 (also correct on t1)
 *   Task 3 catch → 105 / 130 / 155
 *
 * FAKER BONUS   (impostor survives a majority vote):
 *   Task 1 → 100, Task 2 → 125, Task 3 → 150
 *
 * THUMB_SHOT    (one vote only, flat bonuses):
 *   Faker escapes → 150, Correct voters → 100, Majority catch → 150
 */
export const SUSSY_SCORING = {
	SLEUTH: [0, 100, 125, 150] as const,
	CAUGHT: [[], [375, 375, 375], [250, 275, 275], [105, 130, 155]] as const,
	FAKER_SURVIVED: [0, 100, 125, 150] as const,
	THUMB_FAKER_ESCAPE: 150,
	THUMB_CORRECT_VOTER: 100,
	THUMB_MAJORITY_CATCH: 150,
} as const;
