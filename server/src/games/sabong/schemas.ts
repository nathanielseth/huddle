import { z } from "zod";

export const PickBracketWinnerSchema = z.object({
	type: z.literal("pick_bracket_winner"),
	manokId: z.string().min(1),
});

export const LockBracketPickSchema = z.object({
	type: z.literal("lock_bracket_pick"),
});

// debuff (attack ×0.8, determination → 0) applied privately, public odds unchanged
export const SabotageManokSchema = z.object({
	type: z.literal("sabotage_manok"),
	manokId: z.string().min(1),
});

// server reveals one randomly-chosen hidden stat to requesting player only
export const RevealStatSchema = z.object({
	type: z.literal("reveal_stat"),
	manokId: z.string().min(1),
});

export const PlaceBetSchema = z.object({
	type: z.literal("place_bet"),
	manokId: z.string().min(1),
	amount: z.number().int().min(1), // engine caps to player balance
});

export const LockBetSchema = z.object({
	type: z.literal("lock_bet"),
});

export const SabongActionSchema = z.discriminatedUnion("type", [
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

// semantic checks (manokId exists, phase correct, balance sufficient) stay in engine
export function parseSabongAction(raw: unknown): ParsedSabongAction | null {
	const result = SabongActionSchema.safeParse(raw);
	if (result.success) return result.data;

	if (process.env["NODE_ENV"] !== "production") {
		console.warn("[sabong] action parse failure:", result.error.flatten());
	}

	return null;
}