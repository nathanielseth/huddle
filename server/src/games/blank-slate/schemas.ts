import { z } from "zod";
import { MAX_CLUE_LENGTH, MAX_GUESS_LENGTH } from "./constants";

const SubmitClueSchema = z.object({
	type: z.literal("submit_clue"),
	text: z
		.string()
		.trim()
		.min(1)
		.max(MAX_CLUE_LENGTH)
		.refine((s) => !/\s/.test(s), { message: "Clue must be a single word" }),
});

const SubmitGuessSchema = z.object({
	type: z.literal("submit_guess"),
	text: z.string().trim().min(1).max(MAX_GUESS_LENGTH),
});

const SkipGuessSchema = z.object({
	type: z.literal("skip_guess"),
});

export const BlankSlateActionSchema = z.discriminatedUnion("type", [
	SubmitClueSchema,
	SubmitGuessSchema,
	SkipGuessSchema,
]);

export type ParsedBlankSlateAction = z.infer<typeof BlankSlateActionSchema>;

export function parseBlankSlateAction(
	raw: unknown,
): ParsedBlankSlateAction | null {
	const result = BlankSlateActionSchema.safeParse(raw);
	return result.success ? result.data : null;
}
