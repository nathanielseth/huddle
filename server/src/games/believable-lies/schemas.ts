import { z } from "zod";
import { MAX_LIE_LENGTH } from "./constants";

// semantic checks (category in choices, answer not own lie, text not truth)
// require server state and stay in the engine as imperative guards
const SubmitLieSchema = z.object({
	type: z.literal("submit_lie"),
	text: z.string().trim().min(1).max(MAX_LIE_LENGTH),
});

const PickAnswerSchema = z.object({
	type: z.literal("pick_answer"),
	answerId: z.string().min(1),
});

const SelectCategorySchema = z.object({
	type: z.literal("select_category"),
	category: z.string().min(1),
});

const BelievableLiesActionSchema = z.discriminatedUnion("type", [
	SubmitLieSchema,
	PickAnswerSchema,
	SelectCategorySchema,
]);

export type ParsedBelievableLiesAction = z.infer<
	typeof BelievableLiesActionSchema
>;

export type ParsedSubmitLie = z.infer<typeof SubmitLieSchema>;
export type ParsedPickAnswer = z.infer<typeof PickAnswerSchema>;
export type ParsedSelectCategory = z.infer<typeof SelectCategorySchema>;

// returns parsed action or null. engine treats null as no-op
export function parseBelievableLiesAction(
	raw: unknown,
): ParsedBelievableLiesAction | null {
	const result = BelievableLiesActionSchema.safeParse(raw);
	return result.success ? result.data : null;
}