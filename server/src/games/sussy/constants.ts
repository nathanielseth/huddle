import type { TaskType } from "../../../../shared/games/sussy.js";

export const SELECTABLE_TASKS: readonly TaskType[] = [
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

// in hangout mode every selectable task is display-only — players react
// physically, no phone input required. glitch_in_the_chat always requires
// written answers regardless of mode. derived from SELECTABLE_TASKS so they
// can never diverge
export const HANGOUT_NO_SUBMIT_TASKS: ReadonlySet<TaskType> = new Set(
	SELECTABLE_TASKS,
);

// SLEUTH — indexed by prior correct votes this round (0, 1, 2+)
// CAUGHT — keyed by task number, then by prior correct vote tier
// FAKER_SURVIVED — keyed by task number
//
// structured so natural keys (taskNumber, priorCorrect) map directly without
// padding or off-by-one arithmetic at every call site
export const SUSSY_SCORING = {
	// [priorCorrect capped at 2]: 0 prior → 100 | 1 prior → 125 | 2+ prior → 150
	SLEUTH: [100, 125, 150] as const,

	// [taskNumber][priorCorrect capped at 2]
	CAUGHT: {
		1: [375, 375, 375], // first catch always max reward
		2: [250, 275, 275],
		3: [105, 130, 155],
	} as const,

	// [taskNumber]
	FAKER_SURVIVED: { 1: 100, 2: 125, 3: 150 } as const,

	// thumb_shot single-vote round, flat bonuses, no tier progression
	THUMB_FAKER_ESCAPE: 150,
	THUMB_CORRECT_VOTER: 100,
	THUMB_MAJORITY_CATCH: 150,
} as const;