import { z } from "zod";
import { C, HEX_COLOR_RE } from "./constants";
import {
	CANVAS_WIDTH,
	CANVAS_HEIGHT,
} from "../../../../shared/games/squadoodle/index";

// sub-pixel precision is invisible after smoothing; rounding to int eliminates float noise with no visual loss.
// wire compression is disabled (per-connection memory trade-off), so integer coordinates don't reduce payload size anyway.
const clampInt = (lo: number, hi: number) => (v: number) =>
	Math.max(lo, Math.min(hi, Math.round(v)));

const InputPointSchema = z.object({
	// clamp out-of-bounds points from pointer jitter instead of rejecting them, so valid strokes aren't lost
	x: z.number().transform(clampInt(0, CANVAS_WIDTH)),
	y: z.number().transform(clampInt(0, CANVAS_HEIGHT)),
	pressure: z.number().min(0).max(1),
});

const StrokeSchema = z.object({
	points: z
		.array(InputPointSchema)
		.max(
			C.MAX_POINTS_PER_STROKE,
			`Max ${C.MAX_POINTS_PER_STROKE} points per stroke`,
		),
	color: z.string().regex(HEX_COLOR_RE, "color must be a CSS hex string"),
	size: z
		.number()
		.positive()
		.max(C.MAX_STROKE_SIZE, `Max stroke size is ${C.MAX_STROKE_SIZE}`),
});

const StrokesSchema = z
	.array(StrokeSchema)
	.max(C.MAX_STROKES, `Max ${C.MAX_STROKES} strokes per drawing`);

export const SquadoodleActionSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("submit_prompt"),
		text: z.string().trim().min(1).max(C.MAX_PROMPT_LENGTH),
	}),

	z.object({
		type: z.literal("submit_drawing"),
		strokes: StrokesSchema,
	}),

	z.object({
		type: z.literal("submit_guess"),
		text: z.string().trim().min(1).max(C.MAX_GUESS_LENGTH),
	}),

	z.object({
		type: z.literal("react"),
		chainIndex: z.number().int().min(0),
		entryIndex: z.number().int().min(0),
		reaction: z.enum(["fire", "laugh", "heart", "trash"]),
	}),

	z.object({ type: z.literal("next_reveal") }),

	z.object({ type: z.literal("play_again") }),
]);