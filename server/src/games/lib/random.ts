import { randomBytes } from "crypto";
import { invariant } from "./assert";

export function shuffle<T>(
	arr: readonly T[],
	rng: () => number = Math.random,
): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]] as [T, T];
	}
	return out;
}

export function pickRandom<T>(
	arr: readonly T[],
	rng: () => number = Math.random,
): T {
	invariant(arr.length > 0, "pickRandom: empty array");
	return arr[Math.floor(rng() * arr.length)]!;
}

export function randomIntBetween(
	lo: number,
	hi: number,
	rng: () => number = Math.random,
): number {
	return Math.floor(rng() * (hi - lo + 1)) + lo;
}

export function shortId(): string {
	return randomBytes(3).toString("hex");
}