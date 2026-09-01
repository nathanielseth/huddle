// client/src/games/poker/components/PlayingCard.tsx

import { cn } from "../../../lib/utils/cn";
import type { Card } from "@shared/games/poker/index";

type Suit = "h" | "d" | "c" | "s";

const SUIT_SYMBOL: Record<Suit, string> = {
	h: "♥",
	d: "♦",
	c: "♣",
	s: "♠",
};
const IS_RED: Record<Suit, boolean> = {
	h: true,
	d: true,
	c: false,
	s: false,
};

export type CardSize = "sm" | "md" | "lg" | "xl";

// Overall card footprint (kept identical to the old component so layouts
// elsewhere — OpponentsStrip, CommunityCards, HoleCards — don't shift)
const BACK_SIZE: Record<CardSize, string> = {
	sm: "w-9 h-14",
	md: "w-12 h-[4.5rem]",
	lg: "w-16 h-24",
	xl: "w-24 h-36",
};
const FACE_SIZE = BACK_SIZE;

// Corner rank/suit sizing — deliberately small so the pip grid has room
const CORNER_RANK_TEXT: Record<CardSize, string> = {
	sm: "text-[7px]",
	md: "text-[9px]",
	lg: "text-[11px]",
	xl: "text-base",
};
const CORNER_SUIT_TEXT: Record<CardSize, string> = {
	sm: "text-[6px]",
	md: "text-[8px]",
	lg: "text-[9px]",
	xl: "text-sm",
};
const CORNER_INSET_TL: Record<CardSize, string> = {
	sm: "top-0.5 left-0.5",
	md: "top-0.5 left-1",
	lg: "top-1 left-1",
	xl: "top-1.5 left-1.5",
};
const CORNER_INSET_BR: Record<CardSize, string> = {
	sm: "bottom-0.5 right-0.5",
	md: "bottom-0.5 right-1",
	lg: "bottom-1 right-1",
	xl: "bottom-1.5 right-1.5",
};

// Center pip sizing (suit glyphs for number cards)
const PIP_TEXT: Record<CardSize, string> = {
	sm: "text-[7px]",
	md: "text-[9px]",
	lg: "text-xs",
	xl: "text-xl",
};
// Center face sizing (big letter/suit for A, J, Q, K)
const CENTER_TEXT: Record<CardSize, string> = {
	sm: "text-base",
	md: "text-xl",
	lg: "text-3xl",
	xl: "text-5xl",
};

interface Pip {
	// Stable identity for this pip *within a given rank's pattern* (e.g.
	// "center", "topLeft", "extraCenter") rather than its position in the
	// array. Rank never changes without the whole PlayingCard remounting —
	// callers key each PlayingCard on the card string itself — so these ids
	// are stable across re-renders and safe as React keys, unlike the array
	// index they replace.
	id: string;
	left: string;
	top: string;
	flip?: boolean;
}

// Pip grid lives inside a safe zone that never overlaps the corner badges:
// horizontal 28%-72%, vertical 30%-70% for the outer rows, with 8/9/10
// using a tighter 4-row vertical spread (36%-64%) since they need more rows.
function getPips(rank: number): Pip[] {
	switch (rank) {
		case 1: // Ace
			return [{ id: "center", left: "50%", top: "50%" }];
		case 2:
			return [
				{ id: "top", left: "50%", top: "32%" },
				{ id: "bottom", left: "50%", top: "68%", flip: true },
			];
		case 3:
			return [
				{ id: "center", left: "50%", top: "50%" },
				{ id: "top", left: "50%", top: "32%" },
				{ id: "bottom", left: "50%", top: "68%", flip: true },
			];
		case 4:
			return [
				{ id: "topLeft", left: "32%", top: "32%" },
				{ id: "bottomLeft", left: "32%", top: "68%", flip: true },
				{ id: "topRight", left: "68%", top: "32%" },
				{ id: "bottomRight", left: "68%", top: "68%", flip: true },
			];
		case 5:
			return [
				{ id: "center", left: "50%", top: "50%" },
				{ id: "topLeft", left: "32%", top: "32%" },
				{ id: "bottomLeft", left: "32%", top: "68%", flip: true },
				{ id: "topRight", left: "68%", top: "32%" },
				{ id: "bottomRight", left: "68%", top: "68%", flip: true },
			];
		case 6:
			return [
				{ id: "midLeft", left: "32%", top: "50%" },
				{ id: "topLeft", left: "32%", top: "32%" },
				{ id: "bottomLeft", left: "32%", top: "68%", flip: true },
				{ id: "midRight", left: "68%", top: "50%" },
				{ id: "topRight", left: "68%", top: "32%" },
				{ id: "bottomRight", left: "68%", top: "68%", flip: true },
			];
		case 7:
			return [
				{ id: "midLeft", left: "32%", top: "50%" },
				{ id: "topLeft", left: "32%", top: "32%" },
				{ id: "bottomLeft", left: "32%", top: "68%", flip: true },
				{ id: "midRight", left: "68%", top: "50%" },
				{ id: "topRight", left: "68%", top: "32%" },
				{ id: "bottomRight", left: "68%", top: "68%", flip: true },
				{ id: "extraCenter", left: "50%", top: "41%" },
			];
		case 8:
			return [
				{ id: "topLeft", left: "32%", top: "32%" },
				{ id: "upperMidLeft", left: "32%", top: "44%" },
				{ id: "lowerMidLeft", left: "32%", top: "56%", flip: true },
				{ id: "bottomLeft", left: "32%", top: "68%", flip: true },
				{ id: "topRight", left: "68%", top: "32%" },
				{ id: "upperMidRight", left: "68%", top: "44%" },
				{ id: "lowerMidRight", left: "68%", top: "56%", flip: true },
				{ id: "bottomRight", left: "68%", top: "68%", flip: true },
			];
		case 9:
			return [
				{ id: "center", left: "50%", top: "50%" },
				{ id: "topLeft", left: "32%", top: "32%" },
				{ id: "upperMidLeft", left: "32%", top: "44%" },
				{ id: "lowerMidLeft", left: "32%", top: "56%", flip: true },
				{ id: "bottomLeft", left: "32%", top: "68%", flip: true },
				{ id: "topRight", left: "68%", top: "32%" },
				{ id: "upperMidRight", left: "68%", top: "44%" },
				{ id: "lowerMidRight", left: "68%", top: "56%", flip: true },
				{ id: "bottomRight", left: "68%", top: "68%", flip: true },
			];
		case 10:
			return [
				{ id: "topCenter", left: "50%", top: "38%" },
				{ id: "bottomCenter", left: "50%", top: "62%", flip: true },
				{ id: "topLeft", left: "32%", top: "28%" },
				{ id: "upperMidLeft", left: "32%", top: "42%" },
				{ id: "lowerMidLeft", left: "32%", top: "58%", flip: true },
				{ id: "bottomLeft", left: "32%", top: "72%", flip: true },
				{ id: "topRight", left: "68%", top: "28%" },
				{ id: "upperMidRight", left: "68%", top: "42%" },
				{ id: "lowerMidRight", left: "68%", top: "58%", flip: true },
				{ id: "bottomRight", left: "68%", top: "72%", flip: true },
			];
		default:
			return [];
	}
}

function rankToNumber(rankChar: string): number {
	switch (rankChar) {
		case "A":
			return 1;
		case "T":
			return 10;
		case "J":
			return 11;
		case "Q":
			return 12;
		case "K":
			return 13;
		default:
			return Number(rankChar); // "2".."9"
	}
}

function displayRankText(rankChar: string): string {
	return rankChar === "T" ? "10" : rankChar;
}

interface PlayingCardProps {
	card?: Card | null;
	faceDown?: boolean;
	size?: CardSize;
	className?: string;
}

export function PlayingCard({
	card,
	faceDown = false,
	size = "md",
	className,
}: PlayingCardProps) {
	// ── Face-down ────────────────────────────────────────────────────────────
	// Layered diamond lattice + border/inner-rim + subtle shadow so backs read
	// as an actual card object sitting on the felt, not a flat gray rectangle.
	if (faceDown || !card) {
		return (
			<div
				className={cn(
					"relative overflow-hidden rounded-lg shrink-0",
					"border border-white/15",
					"shadow-[0_2px_6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.06)]",
					BACK_SIZE[size],
					className,
				)}
				style={{
					background:
						"linear-gradient(155deg, #2a3a5c 0%, #1c2740 55%, #131b30 100%)",
				}}
			>
				{/* inner rim */}
				<div className="absolute inset-0.75 rounded-[5px] border border-white/10" />
				{/* diamond lattice back pattern */}
				<div
					className="absolute inset-1.25 rounded-[3px] opacity-[0.22]"
					style={{
						backgroundImage:
							"repeating-linear-gradient(45deg, white 0, white 1px, transparent 1px, transparent 6px), repeating-linear-gradient(-45deg, white 0, white 1px, transparent 1px, transparent 6px)",
					}}
				/>
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="font-display font-black text-white/25 select-none drop-shadow-sm">
						♦
					</span>
				</div>
			</div>
		);
	}

	// ── Face-up ──────────────────────────────────────────────────────────────
	// Card format is always 2 chars: rank char + suit char ('A', 'T', '2', ...)
	const rankChar = card[0];
	const suitChar = card[1] as Suit;
	const rankNum = rankToNumber(rankChar);
	const rankText = displayRankText(rankChar);
	const isRed = IS_RED[suitChar];
	const suitGlyph = SUIT_SYMBOL[suitChar];
	const pips = getPips(rankNum);
	const isFaceCard = rankNum === 11 || rankNum === 12 || rankNum === 13; // J, Q, K

	const colorClass = isRed ? "text-red-500" : "text-slate-900";

	return (
		<div
			className={cn(
				"relative rounded-lg bg-white border border-black/10 shrink-0",
				"shadow-[0_2px_8px_rgba(0,0,0,0.45)]",
				FACE_SIZE[size],
				className,
			)}
		>
			{/* top-left corner */}
			<div
				className={cn(
					"absolute flex flex-col items-center leading-none select-none font-bold",
					CORNER_INSET_TL[size],
					colorClass,
				)}
			>
				<span className={CORNER_RANK_TEXT[size]}>{rankText}</span>
				<span className={CORNER_SUIT_TEXT[size]}>{suitGlyph}</span>
			</div>

			{/* bottom-right corner, rotated 180° like a real card */}
			<div
				className={cn(
					"absolute flex flex-col items-center leading-none select-none font-bold rotate-180",
					CORNER_INSET_BR[size],
					colorClass,
				)}
			>
				<span className={CORNER_RANK_TEXT[size]}>{rankText}</span>
				<span className={CORNER_SUIT_TEXT[size]}>{suitGlyph}</span>
			</div>

			{/* center: pip layout for number cards, big glyph for A/J/Q/K */}
			{pips.length > 0 ? (
				pips.map((pip) => (
					<span
						key={pip.id}
						className={cn(
							"absolute select-none -translate-x-1/2 -translate-y-1/2",
							PIP_TEXT[size],
							colorClass,
							pip.flip && "rotate-180",
						)}
						style={{ left: pip.left, top: pip.top }}
					>
						{suitGlyph}
					</span>
				))
			) : (
				<div
					className={cn(
						"absolute inset-0 flex items-center justify-center select-none font-black",
						CENTER_TEXT[size],
						colorClass,
					)}
				>
					{isFaceCard ? rankText : suitGlyph}
				</div>
			)}
		</div>
	);
}

// ── Blank card slot (empty board position) ────────────────────────────────────
// Needs enough contrast to read as "a card goes here" rather than an
// invisible ghost — a dashed inset outline plus a faint fill does that
// without competing visually with real cards once they're dealt.
export function CardSlot({ size = "md" }: { size?: CardSize }) {
	return (
		<div
			className={cn(
				"relative rounded-lg shrink-0 bg-black/15",
				BACK_SIZE[size],
			)}
		>
			<div className="absolute inset-0.75 rounded-[5px] border border-dashed border-white/20" />
		</div>
	);
}