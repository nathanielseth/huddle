import { z } from "zod";

export const SabongBetAction = z.object({
	type: z.literal("place_bet"),
	side: z.enum(["meron", "wala", "draw"]),
	amount: z.number().int().positive().max(100_000),
});

export const SabongFoldAction = z.object({
	type: z.literal("fold"),
});

// discriminatedUnion gives Zod a fast path and better error messages
export const SabongAction = z.discriminatedUnion("type", [
	SabongBetAction,
	SabongFoldAction,
]);

export type SabongAction = z.infer<typeof SabongAction>;
