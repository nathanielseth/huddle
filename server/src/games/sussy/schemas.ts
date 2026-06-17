import { z } from "zod";

const ShowOfHandsResponseSchema = z.object({
	type: z.literal("show_of_hands"),
	raised: z.boolean(),
});

const FingerPointingResponseSchema = z.object({
	type: z.literal("finger_pointing"),
	targetId: z.string().nullable(),
});

const NumbersGameResponseSchema = z.object({
	type: z.literal("numbers_game"),
	count: z.number().int().min(0).max(5),
});

const ThumbShotResponseSchema = z.object({
	type: z.literal("thumb_shot"),
	choices: z.array(z.boolean()).length(3),
});

const FaceTurnResponseSchema = z.object({
	type: z.literal("face_turn"),
	emoji: z.string().nullable(),
});

const GlitchInTheChatResponseSchema = z.object({
	type: z.literal("glitch_in_the_chat"),
	answers: z.array(z.string().min(1)).max(3),
});

const SussyResponseSchema = z.discriminatedUnion("type", [
	ShowOfHandsResponseSchema,
	FingerPointingResponseSchema,
	NumbersGameResponseSchema,
	ThumbShotResponseSchema,
	FaceTurnResponseSchema,
	GlitchInTheChatResponseSchema,
]);

export type ParsedSussyResponse = z.infer<typeof SussyResponseSchema>;
export type ParsedShowOfHandsResponse = z.infer<
	typeof ShowOfHandsResponseSchema
>;
export type ParsedFingerPointingResponse = z.infer<
	typeof FingerPointingResponseSchema
>;
export type ParsedNumbersGameResponse = z.infer<
	typeof NumbersGameResponseSchema
>;
export type ParsedThumbShotResponse = z.infer<typeof ThumbShotResponseSchema>;
export type ParsedFaceTurnResponse = z.infer<typeof FaceTurnResponseSchema>;
export type ParsedGlitchInTheChatResponse = z.infer<
	typeof GlitchInTheChatResponseSchema
>;

// select_category intentionally excludes glitch_in_the_chat.
// round 4 (glitch) is auto-assigned by the server — players never pick it
const SelectCategorySchema = z.object({
	type: z.literal("select_category"),
	category: z.enum([
		"show_of_hands",
		"finger_pointing",
		"numbers_game",
		"thumb_shot",
		"face_turn",
	]),
});

const SubmitResponseSchema = z.object({
	type: z.literal("submit_response"),
	response: SussyResponseSchema,
});

const CastVoteSchema = z.object({
	type: z.literal("cast_vote"),
	targetId: z.string().min(1),
});

const SussyActionSchema = z.discriminatedUnion("type", [
	SelectCategorySchema,
	SubmitResponseSchema,
	CastVoteSchema,
]);

export type ParsedSussyAction = z.infer<typeof SussyActionSchema>;
export type ParsedSelectCategory = z.infer<typeof SelectCategorySchema>;
export type ParsedSubmitResponse = z.infer<typeof SubmitResponseSchema>;
export type ParsedCastVote = z.infer<typeof CastVoteSchema>;

export function parseSussyAction(raw: unknown): ParsedSussyAction | null {
	const result = SussyActionSchema.safeParse(raw);
	return result.success ? result.data : null;
}