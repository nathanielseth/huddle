import { z } from "zod";

export const ShowOfHandsResponseSchema = z.object({
	type: z.literal("show_of_hands"),
	raised: z.boolean(),
});

export const FingerPointingResponseSchema = z.object({
	type: z.literal("finger_pointing"),
	targetId: z.string().nullable(),
});

export const FingerBlastResponseSchema = z.object({
	type: z.literal("finger_blast"),
	count: z.number().int().min(0).max(5),
});

export const ThumbShotResponseSchema = z.object({
	type: z.literal("thumb_shot"),
	choices: z.array(z.boolean()).length(3),
});

export const FaceTurnResponseSchema = z.object({
	type: z.literal("face_turn"),
	emoji: z.string().nullable(),
});

export const GlitchInTheChatResponseSchema = z.object({
	type: z.literal("glitch_in_the_chat"),
	answers: z.array(z.string().min(1)).max(3),
});

export const SussyResponseSchema = z.discriminatedUnion("type", [
	ShowOfHandsResponseSchema,
	FingerPointingResponseSchema,
	FingerBlastResponseSchema,
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
export type ParsedFingerBlastResponse = z.infer<
	typeof FingerBlastResponseSchema
>;
export type ParsedThumbShotResponse = z.infer<typeof ThumbShotResponseSchema>;
export type ParsedFaceTurnResponse = z.infer<typeof FaceTurnResponseSchema>;
export type ParsedGlitchInTheChatResponse = z.infer<
	typeof GlitchInTheChatResponseSchema
>;

// select_category intentionally excludes glitch_in_the_chat.
// round 4 (glitch) is auto-assigned by the server — players never pick it
export const SelectCategorySchema = z.object({
	type: z.literal("select_category"),
	category: z.enum([
		"show_of_hands",
		"finger_pointing",
		"finger_blast",
		"thumb_shot",
		"face_turn",
	]),
});

export const SubmitResponseSchema = z.object({
	type: z.literal("submit_response"),
	response: SussyResponseSchema,
});

export const CastVoteSchema = z.object({
	type: z.literal("cast_vote"),
	targetId: z.string().min(1),
});

export const SussyActionSchema = z.discriminatedUnion("type", [
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