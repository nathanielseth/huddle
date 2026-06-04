import type { WitzoneServerPrompt, WitzoneFinalPrompt } from "./types";
import type {
	WitzoneReveal,
	WitzoneFinalReveal,
} from "../../../../shared/witzone";
import {
	PTS_PER_VOTE,
	WINNER_BONUS,
	WITTY_BONUS,
	DEFAULT_BONUS,
	FINAL_SCORE_BASE,
} from "./constants";

// helpers

function normalize(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
		.trim();
}

// r1 / r2 prompt scoring

export interface PromptScoreResult {
	reveal: WitzoneReveal;
	scoreDeltas: Record<string, number>;
}

// score one r1/r2 prompt
export function scorePromptR1R2(
	prompt: WitzoneServerPrompt,
	round: 1 | 2,
): PromptScoreResult {
	const mult = round === 1 ? 1 : 2;
	const eligibleCount = prompt.eligibleVoterIds.size;
	const [slot0, slot1] = prompt.slots;
	const scoreDeltas: Record<string, number> = {};

	// jinx: both authors submitted the same normalized answer
	if (
		slot0.text !== null &&
		slot1.text !== null &&
		normalize(slot0.text) === normalize(slot1.text)
	) {
		return {
			reveal: {
				promptText: prompt.text,
				answers: [
					{
						id: slot0.answerId,
						text: slot0.text,
						authorId: slot0.authorId,
						voteCount: 0,
						scoreDelta: 0,
					},
					{
						id: slot1.answerId,
						text: slot1.text,
						authorId: slot1.authorId,
						voteCount: 0,
						scoreDelta: 0,
					},
				],
				wasJinx: true,
				wasDefault: false,
				wittyWinnerId: null,
			},
			scoreDeltas,
		};
	}

	// default: one or both authors didn't submit
	if (slot0.text === null || slot1.text === null) {
		if (slot0.text === null && slot1.text === null) {
			return {
				reveal: {
					promptText: prompt.text,
					answers: [
						{
							id: slot0.answerId,
							text: null,
							authorId: slot0.authorId,
							voteCount: 0,
							scoreDelta: 0,
						},
						{
							id: slot1.answerId,
							text: null,
							authorId: slot1.authorId,
							voteCount: 0,
							scoreDelta: 0,
						},
					],
					wasJinx: false,
					wasDefault: true,
					wittyWinnerId: null,
				},
				scoreDeltas,
			};
		}

		const bonus = DEFAULT_BONUS * mult;
		const submitted = slot0.text !== null ? slot0 : slot1;
		const missing = slot0.text !== null ? slot1 : slot0;
		scoreDeltas[submitted.authorId] = bonus;

		return {
			reveal: {
				promptText: prompt.text,
				answers: [
					{
						id: submitted.answerId,
						text: submitted.text,
						authorId: submitted.authorId,
						voteCount: 0,
						scoreDelta: bonus,
					},
					{
						id: missing.answerId,
						text: null,
						authorId: missing.authorId,
						voteCount: 0,
						scoreDelta: 0,
					},
				],
				wasJinx: false,
				wasDefault: true,
				wittyWinnerId: null,
			},
			scoreDeltas,
		};
	}

	// normal voting
	const allVotes = [...prompt.votes.values()];
	const votes0 = allVotes.filter((id) => id === slot0.answerId).length;
	const votes1 = allVotes.filter((id) => id === slot1.answerId).length;
	const totalCast = votes0 + votes1;

	const isWitty0 =
		eligibleCount > 0 &&
		totalCast === eligibleCount &&
		votes0 === eligibleCount;
	const isWitty1 =
		eligibleCount > 0 &&
		totalCast === eligibleCount &&
		votes1 === eligibleCount;

	let delta0 = votes0 * PTS_PER_VOTE * mult;
	let delta1 = votes1 * PTS_PER_VOTE * mult;
	let wittyWinnerId: string | null = null;

	if (isWitty0) {
		delta0 += WITTY_BONUS * mult;
		wittyWinnerId = slot0.authorId;
	} else if (isWitty1) {
		delta1 += WITTY_BONUS * mult;
		wittyWinnerId = slot1.authorId;
	} else if (votes0 > votes1) {
		delta0 += WINNER_BONUS * mult;
	} else if (votes1 > votes0) {
		delta1 += WINNER_BONUS * mult;
	}
	// tie → no winner bonus

	if (delta0 > 0) scoreDeltas[slot0.authorId] = delta0;
	if (delta1 > 0) scoreDeltas[slot1.authorId] = delta1;

	return {
		reveal: {
			promptText: prompt.text,
			answers: [
				{
					id: slot0.answerId,
					text: slot0.text,
					authorId: slot0.authorId,
					voteCount: votes0,
					scoreDelta: delta0,
				},
				{
					id: slot1.answerId,
					text: slot1.text,
					authorId: slot1.authorId,
					voteCount: votes1,
					scoreDelta: delta1,
				},
			],
			wasJinx: false,
			wasDefault: false,
			wittyWinnerId,
		},
		scoreDeltas,
	};
}

// final round scoring

export interface FinalScoreResult {
	reveal: WitzoneFinalReveal;
	scoreDeltas: Record<string, number>;
}

export function scorePromptFinal(fp: WitzoneFinalPrompt): FinalScoreResult {
	const scoreDeltas: Record<string, number> = {};
	const tokenMap = new Map<string, number>();
	let totalTokens = 0;

	for (const playerVotes of fp.votes.values()) {
		for (const [answerId, tokens] of playerVotes) {
			tokenMap.set(answerId, (tokenMap.get(answerId) ?? 0) + tokens);
			totalTokens += tokens;
		}
	}

	const answers: WitzoneFinalReveal["answers"] = [];

	for (const [playerId, entry] of fp.answers) {
		if (entry.text === null) continue;
		const tokens = tokenMap.get(entry.answerId) ?? 0;
		const delta =
			totalTokens > 0
				? Math.round((tokens / totalTokens) * FINAL_SCORE_BASE)
				: 0;
		if (delta > 0) scoreDeltas[playerId] = delta;
		answers.push({
			id: entry.answerId,
			text: entry.text,
			authorId: playerId,
			tokenCount: tokens,
			scoreDelta: delta,
		});
	}

	// sort by token count descending for a natural reveal order
	answers.sort((a, b) => b.tokenCount - a.tokenCount);

	return { reveal: { promptText: fp.text, answers }, scoreDeltas };
}