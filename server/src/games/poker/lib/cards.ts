// lib/cards.ts
export const RANK_CHARS = [
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
] as const;
export const SUIT_CHARS = ["h", "d", "c", "s"] as const;

export type Rank = (typeof RANK_CHARS)[number];
export type Suit = (typeof SUIT_CHARS)[number];
