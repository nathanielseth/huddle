import type { TaskType } from "@shared/games/sussy/index";

export interface TaskMeta {
	label: string;
	icon: string;
	desc: string;
}

// Defined locally — runtime constants from @shared cause nodenext CJS issues
export const SELECTABLE_TASKS = [
	"show_of_hands",
	"finger_pointing",
	"numbers_game",
	"thumb_shot",
	"face_turn",
] as const;

// derive the type from the const — single source of truth
export type SelectableTask = (typeof SELECTABLE_TASKS)[number];

export const TASK_META: Record<
	Exclude<TaskType, "glitch_in_the_chat">,
	TaskMeta
> = {
	show_of_hands: {
		label: "Show of Hands",
		icon: "✋",
		desc: "Raise it or fake it",
	},
	finger_pointing: {
		label: "Finger Pointing",
		icon: "👉",
		desc: "Point at who fits",
	},
	numbers_game: {
		label: "Finger Blast",
		icon: "🖐️",
		desc: "How many fingers?",
	},
	thumb_shot: {
		label: "Thumb Shot",
		icon: "👍",
		desc: "Up or down — three times",
	},
	face_turn: { label: "Face Turn", icon: "😶", desc: "Show your reaction" },
};

const GLITCH_META: TaskMeta = {
	label: "Glitch in the Chat",
	icon: "⌨️",
	desc: "Answer honestly. Or don't.",
};

export function getTaskMeta(taskType: TaskType): TaskMeta {
	if (taskType === "glitch_in_the_chat") return GLITCH_META;
	return TASK_META[taskType];
}

export const REACTION_EMOJIS = [
	"😂",
	"😭",
	"😤",
	"😱",
	"😍",
	"🤣",
	"😮",
	"🫠",
	"🥹",
	"😶",
	"🤔",
	"😏",
	"😬",
	"🫣",
	"🥴",
	"😅",
	"🤡",
	"💀",
	"🫡",
	"🤌",
	"👀",
	"😒",
	"🙄",
	"🫤",
	"🥲",
	"😳",
	"🫥",
	"😵",
	"🤩",
	"😌",
];
