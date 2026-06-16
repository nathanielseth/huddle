import {
	getCardCode,
	evaluate,
	rank,
	rankDescription,
} from "@pokertools/evaluator";
import type { HandResult } from "../../../../shared/games/poker";
import type {
	PokerServerState,
	PokerServerPlayer,
	SidePot,
	PotResolution,
} from "./types";

export interface ShowdownResult {
	resolutions: PotResolution[];
	awards: Map<string, number>;
}

// first eligible player clockwise from dealer, gets the odd chip on split pots
function getOddChipRecipient(
	eligibleIds: readonly string[],
	seatOrder: string[],
	dealerIndex: number,
): string {
	const idSet = new Set(eligibleIds);
	const count = seatOrder.length;

	for (let i = 1; i <= count; i++) {
		const id = seatOrder[(dealerIndex + i) % count]!;
		if (idSet.has(id)) return id;
	}

	return eligibleIds[0]!; // unreachable: eligibleIds is always non-empty here
}

// all chip movement in this module goes through this function
function awardChips(
	playerId: string,
	chips: number,
	players: Map<string, PokerServerPlayer>,
	awards: Map<string, number>,
): void {
	players.get(playerId)!.stack += chips;
	awards.set(playerId, (awards.get(playerId) ?? 0) + chips);
}

// resolves a single pot. uncontested: award without evaluation. contested:
// evaluate best 5-card hand, ties split the pot, odd chip to first clockwise
function resolvePot(
	pot: SidePot,
	potIndex: number,
	players: Map<string, PokerServerPlayer>,
	communityCardCodes: number[],
	seatOrder: string[],
	dealerIndex: number,
	awards: Map<string, number>,
): PotResolution {
	const { eligiblePlayerIds, amount } = pot;

	// one eligible player means everyone else folded, award without evaluation
	if (eligiblePlayerIds.length === 1) {
		const winnerId = eligiblePlayerIds[0]!;
		awardChips(winnerId, amount, players, awards);
		return {
			potIndex,
			winnerIds: [winnerId],
			amount,
			handDescription: null,
		};
	}

	// evaluate each eligible player's best 5-card hand from hole + community cards
	let bestScore = Infinity; // lower = better in @pokertools/evaluator
	const results: {
		playerId: string;
		score: number;
		description: string;
	}[] = [];

	for (const playerId of eligiblePlayerIds) {
		const player = players.get(playerId)!;

		// holeCards should always be set for eligible showdown players
		if (!player.holeCards) continue;

		const codes = [
			getCardCode(player.holeCards[0]),
			getCardCode(player.holeCards[1]),
			...communityCardCodes,
		];

		const score = evaluate(codes);
		const handRank = rank(codes);
		const description = rankDescription(handRank);

		results.push({ playerId, score, description });
		if (score < bestScore) bestScore = score;
	}

	// collect all tied winners
	const winners = results.filter((r) => r.score === bestScore);
	const winnerIds = winners.map((w) => w.playerId);
	const handDescription = winners[0]?.description ?? null;

	// integer floor per winner to avoid fractional chips
	const perWinner = Math.floor(amount / winnerIds.length);
	const remainder = amount - perWinner * winnerIds.length;

	for (const { playerId } of winners) {
		awardChips(playerId, perWinner, players, awards);
	}

	// odd chip goes to first eligible winner clockwise from dealer
	if (remainder > 0) {
		const recipient = getOddChipRecipient(winnerIds, seatOrder, dealerIndex);
		awardChips(recipient, remainder, players, awards);
	}

	return { potIndex, winnerIds, amount, handDescription };
}

// resolves all pots at showdown, smallest to largest so all-in players get
// their share before the main pot is awarded. mutates player stacks
export function resolveShowdown(state: PokerServerState): ShowdownResult {
	const communityCardCodes = state.communityCards.map(getCardCode);
	const awards = new Map<string, number>();

	const resolutions = state.pots.map((pot, idx) =>
		resolvePot(
			pot,
			idx,
			state.players,
			communityCardCodes,
			state.seatOrder,
			state.dealerIndex,
			awards,
		),
	);

	// per-player showdown summary: cards + best hand + chips won
	const playerInfo: Record<
		string,
		{
			cards: string[];
			hand: string | null;
			won: number;
		}
	> = {};

	for (const p of state.players.values()) {
		if ((p.status !== "active" && p.status !== "allin") || !p.holeCards)
			continue;
		let hand: string | null = null;
		if (communityCardCodes.length >= 3) {
			try {
				const codes = [
					getCardCode(p.holeCards[0]),
					getCardCode(p.holeCards[1]),
					...communityCardCodes,
				];
				hand = rankDescription(rank(codes));
			} catch {
				// pre-flop all-in: no board to evaluate
			}
		}
		playerInfo[p.playerId] = {
			cards: [...p.holeCards],
			hand,
			won: awards.get(p.playerId) ?? 0,
		};
	}

	state.logger.log("showdown_resolved", state.handNumber, {
		communityCards: state.communityCards,
		playerInfo,
		awards: Object.fromEntries(awards),
		stacks: Object.fromEntries(
			[...state.players.values()].map((p) => [p.playerId, p.stack]),
		),
	});

	return { resolutions, awards };
}

// converts PotResolution[] into HandResult shape for publicPayload
export function toHandResult(resolutions: PotResolution[]): HandResult {
	return {
		potResults: resolutions.map((r) => ({
			amount: r.amount,
			winnerIds: r.winnerIds,
			handDescription: r.handDescription,
		})),
	};
}

// net chip change per player for the hand just concluded. positive = net gain,
// negative = net loss. call before resetPlayersForNewHand clears totalContributed
export function computeScoreDeltas(
	awards: Map<string, number>,
	players: Map<string, PokerServerPlayer>,
): Record<string, number> {
	const deltas: Record<string, number> = {};

	for (const [id, player] of players) {
		const won = awards.get(id) ?? 0;
		const contributed = player.totalContributed;

		if (won !== 0 || contributed !== 0) {
			deltas[id] = won - contributed;
		}
	}

	return deltas;
}