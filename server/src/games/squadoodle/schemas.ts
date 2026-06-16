import { z } from "zod";
import { C, HEX_COLOR_RE } from "./constants.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../../../../shared/games/squadoodle.js";

// clamps v into [lo, hi] and rounds to nearest integer.
// coordinates stored as integers because:
//   - canvas is 800×600 logical pixels, sub-pixel precision is invisible after
//     perfect-freehand's smoothing pass
//   - integer values compress far better under permessage-deflate
//   - eliminates floating-point noise with no visual loss
const clampInt = (lo: number, hi: number) => (v: number) =>
	Math.max(lo, Math.min(hi, Math.round(v)));

const InputPointSchema = z.object({
	// accept any finite number, clamp+round into canvas bounds.
	// coordinates slightly outside canvas (e.g. -0.3 from pointer jitter) are
	// clamped rather than rejected so valid strokes aren't lost
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