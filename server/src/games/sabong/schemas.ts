import { z } from "zod";

const PickBracketWinnerSchema = z.object({
	type: z.literal("pick_bracket_winner"),
	manokId: z.string().min(1),
});

const LockBracketPickSchema = z.object({
	type: z.literal("lock_bracket_pick"),
});

// debuff (attack ×0.8, determination → 0) applied privately, public odds unchanged
const SabotageManokSchema = z.object({
	type: z.literal("sabotage_manok"),
	manokId: z.string().min(1),
});

// server reveals one randomly-chosen hidden stat to the requesting player only
const RevealStatSchema = z.object({
	type: z.literal("reveal_stat"),
	manokId: z.string().min(1),
});

const PlaceBetSchema = z.object({
	type: z.literal("place_bet"),
	manokId: z.string().min(1),
	amount: z.number().int().min(1), // engine caps to player balance
});

const LockBetSchema = z.object({
	type: z.literal("lock_bet"),
});

const SabongActionSchema = z.discriminatedUnion("type", [
	PickBracketWinnerSchema,
	LockBracketPickSchema,
	SabotageManokSchema,
	RevealStatSchema,
	PlaceBetSchema,
	LockBetSchema,
]);

export type ParsedSabongAction = z.infer<typeof SabongActionSchema>;
export type ParsedPickBracketWinner = z.infer<typeof PickBracketWinnerSchema>;
export type ParsedLockBracketPick = z.infer<typeof LockBracketPickSchema>;
export type ParsedSabotageManok = z.infer<typeof SabotageManokSchema>;
export type ParsedRevealStat = z.infer<typeof RevealStatSchema>;
export type ParsedPlaceBet = z.infer<typeof PlaceBetSchema>;
export type ParsedLockBet = z.infer<typeof LockBetSchema>;

// semantic checks
export function parseSabongAction(raw: unknown): ParsedSabongAction | null {
	const result = SabongActionSchema.safeParse(raw);
	if (result.success) return result.data;

	if (process.env["NODE_ENV"] !== "production") {
		console.warn("[sabong] action parse failure:", result.error.flatten());
	}

	return null;
}