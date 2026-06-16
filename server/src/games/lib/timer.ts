import type { GameTimer } from "../../../../shared/core/room";

export const makeTimer = (durationMs: number): GameTimer => ({
	startsAt: Date.now(),
	duration: durationMs,
});
