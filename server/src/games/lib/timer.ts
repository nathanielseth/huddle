import type { GameTimer } from "../../../../shared/types";

export const makeTimer = (durationMs: number): GameTimer => ({
	startsAt: Date.now(),
	duration: durationMs,
});
