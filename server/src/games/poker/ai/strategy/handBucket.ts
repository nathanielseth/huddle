import type { BoardTexture } from "../ranges";

export type HandBucket = "nuts" | "strong" | "medium" | "draw" | "weak" | "air";

export function classifyHand(
	equity: number,
	texture: BoardTexture | undefined,
	streetIndex: number,
	spr: number,
): HandBucket {
	if (equity >= 0.8) return "nuts";
	if (equity >= 0.65) return "strong";

	const isDrawLike =
		streetIndex === 1 &&
		spr >= 2.0 &&
		equity >= 0.36 &&
		equity < 0.52 &&
		(texture?.wetness ?? 0) >= 0.45;

	if (isDrawLike) return "draw";
	if (equity >= 0.48) return "medium";
	if (equity >= 0.22) return "weak";
	return "air";
}

export type BetSizeBucket = "min" | "small" | "medium" | "large" | "overbet";

export function classifyBetSize(
	callAmount: number,
	pot: number,
): BetSizeBucket {
	if (callAmount <= 0 || pot <= 0) return "min";
	const fraction = callAmount / pot;
	if (fraction <= 0.15) return "min";
	if (fraction <= 0.4) return "small";
	if (fraction <= 0.75) return "medium";
	if (fraction <= 1.2) return "large";
	return "overbet";
}
