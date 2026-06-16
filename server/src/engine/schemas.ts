import { z } from "zod";
import type { GameTimer, RoomPhase } from "../../../shared/core/room";

export const GameTimerSchema: z.ZodType<GameTimer> = z.object({
	startsAt: z.number(),
	duration: z.number().positive(),
});

export const RoomPhaseSchema = z.string() as z.ZodType<RoomPhase>;

export const EngineResultSchema = z.object({
	serverPayload: z.unknown(),
	publicPayload: z.unknown(),
	timer: GameTimerSchema.nullable(),
	roomPhase: RoomPhaseSchema.optional(),
	scoreDeltas: z.record(z.string(), z.number()).optional(),
	privatePayloads: z
		.instanceof(Map)
		.transform((m) => m as Map<string, unknown>)
		.optional(),
});

export type ValidatedEngineResult = z.infer<typeof EngineResultSchema>;

export function parseEngineResult(
	raw: unknown,
	engineId: string,
): ValidatedEngineResult {
	const result = EngineResultSchema.safeParse(raw);
	if (!result.success) {
		throw new Error(
			`[engine:${engineId}] Malformed EngineResult:\n${result.error.message}`,
		);
	}
	return result.data;
}

export function parsePlayerAction<T extends z.ZodTypeAny>(
	schema: T,
	action: unknown,
	engineId: string,
): z.infer<T> | null {
	const result = schema.safeParse(action);
	if (!result.success) {
		console.warn(
			`[engine:${engineId}] Rejected invalid action:`,
			z.treeifyError(result.error),
		);
		return null;
	}
	return result.data;
}
