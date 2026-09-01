import type { Card } from "../../../../shared/games/poker/index";
import { shuffle } from "../lib/random";
import { RANK_CHARS, SUIT_CHARS } from "./lib/cards";

// builds an unshuffled 52-card deck. new array every call, rank-major order
function buildDeck(): Card[] {
	const deck: Card[] = [];
	for (const rank of RANK_CHARS) {
		for (const suit of SUIT_CHARS) {
			deck.push(`${rank}${suit}`);
		}
	}
	return deck;
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