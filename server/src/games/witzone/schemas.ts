import { z } from "zod";
import { MAX_ANSWER_LENGTH, FINAL_VOTE_TOKENS } from "./constants";

// individual action schemas

export const SubmitAnswerSchema = z.object({
	type: z.literal("submit_answer"),
	promptIndex: z.number().int().min(0),
	text: z.string().min(1).max(MAX_ANSWER_LENGTH).trim(),
});

export const CastVoteSchema = z.object({
	type: z.literal("cast_vote"),
	answerId: z.string().min(1),
});

// structural schema only, validates shape and per-token bounds
//
// in the engine, the sum is validated imperatively after parsing so that
// the discriminated union can still fast-path on "type"
export const CastFinalVotesSchema = z.object({
	type: z.literal("cast_final_votes"),
	votes: z.record(
		z.string().min(1), // answerid key
		z.number().int().min(0).max(FINAL_VOTE_TOKENS),
	),
});

// combined action schema
//
// discriminatedunion gives zod a fast path (no need to try each branch)
// and better error messages when the wrong action type is sent

export const WitzoneActionSchema = z.discriminatedUnion("type", [
	SubmitAnswerSchema,
	CastVoteSchema,
	CastFinalVotesSchema,
]);

export type ParsedWitzoneAction = z.infer<typeof WitzoneActionSchema>;

// narrowed types for each branch — use these inside action handlers so
// typescript knows the exact shape without needing a second cast
export type ParsedSubmitAnswer = z.infer<typeof SubmitAnswerSchema>;
export type ParsedCastVote = z.infer<typeof CastVoteSchema>;
export type ParsedCastFinalVotes = z.infer<typeof CastFinalVotesSchema>;

// refined final-vote schema (for tests / one-off validation)
//
// adds the semantic constraint that votes must sum to exactly final_vote_tokens
// returns zodeffects, so it cannot be used inside the discriminatedunion above

export const CastFinalVotesRefinedSchema = CastFinalVotesSchema.refine(
	(data) => {
		const total = Object.values(data.votes).reduce((sum, n) => sum + n, 0);
		return total === FINAL_VOTE_TOKENS;
	},
	{
		message: `votes must sum to exactly ${FINAL_VOTE_TOKENS}`,
		path: ["votes"],
	},
);

// parse helper

export function parseWitzoneAction(raw: unknown): ParsedWitzoneAction | null {
	const result = WitzoneActionSchema.safeParse(raw);
	return result.success ? result.data : null;
}