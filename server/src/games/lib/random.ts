import { randomBytes } from "crypto";
import { invariant } from "./assert";

export function shuffle<T>(arr: readonly T[]): T[] {
	const out = [...arr];
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]] as [T, T];
	}
	return out;
}

export function pickRandom<T>(arr: readonly T[]): T {
	invariant(arr.length > 0, "pickRandom: empty array");
	return arr[Math.floor(Math.random() * arr.length)]!;
}

export function randomIntBetween(lo: number, hi: number): number {
	return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

export function shortId(): string {
	return randomBytes(3).toString("hex");
}