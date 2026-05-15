import type { Card, Rank, Suit } from "../../../../shared/poker.js";

const RANKS: readonly Rank[] = [
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"T",
	"J",
	"Q",
	"K",
	"A",
];

const SUITS: readonly Suit[] = ["h", "d", "c", "s"];

// builds an unshuffled 52-card deck. new array every call, rank-major order
export function buildDeck(): Card[] {
	const deck: Card[] = [];
	for (const rank of RANKS) {
		for (const suit of SUITS) {
			deck.push(`${rank}${suit}` as Card);
		}
	}
	return deck;
}

// fisher-yates shuffle
export function shuffle<T>(array: readonly T[]): T[] {
	const a = [...array];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		const tmp = a[i]!;
		a[i] = a[j]!;
		a[j] = tmp;
	}
	return a;
}

// fresh shuffled 52-card deck
export function freshShuffledDeck(): Card[] {
	return shuffle(buildDeck());
}

// deals one card from the deck. throws if empty (should never happen)
export function dealOne(deck: Card[]): Card {
	const card = deck.pop();
	if (card === undefined) {
		throw new Error(
			"[poker/deck] Deck exhausted — this is a bug in hand setup.",
		);
	}
	return card;
}

// mutates deck, returns dealt cards
export function dealN(deck: Card[], count: number): Card[] {
	const cards: Card[] = [];
	for (let i = 0; i < count; i++) {
		cards.push(dealOne(deck));
	}
	return cards;
}

export function burnOne(deck: Card[]): void {
	dealOne(deck);
}
