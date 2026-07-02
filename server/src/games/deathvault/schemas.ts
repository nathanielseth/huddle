import { z } from "zod";
import { MAX_SCRAMBLE_WORD_LENGTH } from "./constants";
import type { DeathvaultParsedAction } from "./types";

const PlaceWagerSchema = z.object({
	type: z.literal("place_wager"),
	amount: z.number().int().min(0),
});

const SubmitAnswerSchema = z.object({
	type: z.literal("submit_answer"),
	choiceId: z.string().min(1),
});

const DilemmaChooseSchema = z.object({
	type: z.literal("dilemma_choose"),
	choice: z.enum(["share", "steal"]),
});

const LavaPickTileSchema = z.object({
	type: z.literal("lava_pick_tile"),
	tileIndex: z.number().int().min(0),
});

const ScrambleSubmitSchema = z.object({
	type: z.literal("scramble_submit"),
	word: z.string().trim().min(1).max(MAX_SCRAMBLE_WORD_LENGTH),
});

const ToxicAnswerSchema = z.object({
	type: z.literal("toxic_answer"),
	choiceId: z.string().min(1),
});

const MoneyTapSchema = z.object({
	type: z.literal("money_tap"),
});

const HigherLowerGuessSchema = z.object({
	type: z.literal("higher_lower_guess"),
	guess: z.enum(["higher", "lower"]),
});

const FinalCutProposeSchema = z.object({
	type: z.literal("final_cut_propose"),
	percentage: z.number().min(0).max(100),
});

const DeathvaultActionSchema = z.discriminatedUnion("type", [
	PlaceWagerSchema,
	SubmitAnswerSchema,
	DilemmaChooseSchema,
	LavaPickTileSchema,
	ScrambleSubmitSchema,
	ToxicAnswerSchema,
	MoneyTapSchema,
	HigherLowerGuessSchema,
	FinalCutProposeSchema,
]);

export function parseDeathvaultAction(
	raw: unknown,
): DeathvaultParsedAction | null {
	const result = DeathvaultActionSchema.safeParse(raw);
	if (!result.success) return null;
	return result.data;
}
