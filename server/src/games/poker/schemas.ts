import { z } from "zod";

export const PokerActionSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("fold") }),
	z.object({ type: z.literal("check") }),
	z.object({ type: z.literal("call") }),
	z.object({
		type: z.literal("raise"),
		amount: z.number().int().positive(),
	}),
	z.object({ type: z.literal("all_in") }),
]);

export type ValidatedPokerAction = z.infer<typeof PokerActionSchema>;
