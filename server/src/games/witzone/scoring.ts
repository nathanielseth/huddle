import type { WitzonePromptReveal } from "../../../../shared/witzone.js";
import type { WitzoneServerPrompt } from "./types.js";
import {
	MAX_FINAL_POINTS,
	POINTS_PER_VOTE,
	WINNER_BONUS,
	WITTY_BONUS,
} from "./constants.js";

// ─── Text normalization ───────────────────────────────────────────────────────

export function normalize(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function isJinx(a: string, b: string): boolean {
	return normalize(a) === normalize(b);
}

// ─── R1 / R2 prompt scoring ───────────────────────────────────────────────────

export function scorePromptR1R2(
	prompt: WitzoneServerPrompt,
	round: 1 | 2,
): Omit<WitzonePromptReveal, "promptId" | "promptText"> {
	const slots = prompt.answerSlots!;
	const [slot1, slot2] = [slots[0]!, slots[1]!];

	const wasDefault = slot1.text === null || slot2.text === null;
	const wasJinx = !wasDefault && isJinx(slot1.text!, slot2.text!);

	// Tally votes per answerId
	const votesByAnswerId: Record<string, number> = {};
	for (const slot of slots) votesByAnswerId[slot.answerId] = 0;
	for (const [, targetAnswerId] of prompt.votes) {
		votesByAnswerId[targetAnswerId] =
			(votesByAnswerId[targetAnswerId] ?? 0) + 1;
	}

	const scoreDeltas: Record<string, number> = {};
	for (const slot of slots) scoreDeltas[slot.authorId] = 0;

	const answers = slots.map((s) => ({
		answerId: s.answerId,
		authorId: s.authorId,
		text: s.text,
	}));

	// JINX — both get zero regardless of votes
	if (wasJinx) {
		return {
			answers,
			votes: votesByAnswerId,
			scoreDeltas,
			wasJinx: true,
			wasDefault: false,
			wittyWinnerId: null,
		};
	}

	// DEFAULT — submitter gets winner bonus, non-submitter gets zero; votes ignored
	if (wasDefault) {
		const winnerId = slot1.text !== null ? slot1.authorId : slot2.authorId;
		scoreDeltas[winnerId] = WINNER_BONUS[round]!;
		return {
			answers,
			votes: votesByAnswerId,
			scoreDeltas,
			wasJinx: false,
			wasDefault: true,
			wittyWinnerId: null,
		};
	}

	// Normal — votes count
	const ppv = POINTS_PER_VOTE[round]!;
	const winBonus = WINNER_BONUS[round]!;
	const witBonus = WITTY_BONUS[round]!;

	const v1 = votesByAnswerId[slot1.answerId] ?? 0;
	const v2 = votesByAnswerId[slot2.answerId] ?? 0;
	const totalVotes = v1 + v2;

	let delta1 = v1 * ppv;
	let delta2 = v2 * ppv;
	let wittyWinnerId: string | null = null;

	if (totalVotes > 0) {
		if (v1 === totalVotes) {
			delta1 += witBonus;
			wittyWinnerId = slot1.authorId;
		} else if (v2 === totalVotes) {
			delta2 += witBonus;
			wittyWinnerId = slot2.authorId;
		} else if (v1 > v2) {
			delta1 += winBonus;
		} else if (v2 > v1) {
			delta2 += winBonus;
		}
		// tie → no bonus
	}

	scoreDeltas[slot1.authorId] = delta1;
	scoreDeltas[slot2.authorId] = delta2;

	return {
		answers,
		votes: votesByAnswerId,
		scoreDeltas,
		wasJinx: false,
		wasDefault: false,
		wittyWinnerId,
	};
}

// ─── R3 final prompt scoring ──────────────────────────────────────────────────

export function scorePromptFinal(
	prompt: WitzoneServerPrompt,
): Omit<WitzonePromptReveal, "promptId" | "promptText"> {
	const slots = prompt.answerSlots!;

	const tokensByAnswerId: Record<string, number> = {};
	for (const slot of slots) tokensByAnswerId[slot.answerId] = 0;

	for (const [, votes] of prompt.finalVotes) {
		for (const [answerId, tokens] of Object.entries(votes)) {
			tokensByAnswerId[answerId] = (tokensByAnswerId[answerId] ?? 0) + tokens;
		}
	}

	const totalTokens = Object.values(tokensByAnswerId).reduce(
		(a, b) => a + b,
		0,
	);

	const scoreDeltas: Record<string, number> = {};
	for (const slot of slots) {
		const tokens = tokensByAnswerId[slot.answerId] ?? 0;
		scoreDeltas[slot.authorId] =
			totalTokens > 0
				? Math.round((tokens / totalTokens) * MAX_FINAL_POINTS)
				: 0;
	}

	const answers = slots.map((s) => ({
		answerId: s.answerId,
		authorId: s.authorId,
		text: s.text,
	}));

	return {
		answers,
		votes: tokensByAnswerId,
		scoreDeltas,
		wasJinx: false,
		wasDefault: false,
		wittyWinnerId: null,
	};
}
