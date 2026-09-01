// client/src/games/poker/components/CommunityCards.tsx
//
// Community board with two selectable layouts:
//  - "row": flat [][][][][], for wide/landscape views (host/TV) where there's
//    horizontal room and a single row reads clearly at a glance.
//  - "stagger": classic 3-over-2 ([][] over [][][]), for narrow/portrait
//    views (phone) where 5 cards side by side would get cramped or force
//    tiny card sizes.
//
// Both host and player views share this component but pass different
// `layout` values — don't hardcode one shape here again, that's exactly what
// broke the host view last time (mobile's stagger silently became the only
// option and host inherited it with no way to opt back into a flat row).

import { m, AnimatePresence } from "motion/react";
import { PlayingCard, CardSlot } from "./PlayingCard";
import type { CardSize } from "./PlayingCard";
import type { Card } from "@shared/games/poker/index";

interface CommunityCardsProps {
	cards: readonly Card[];
	size?: CardSize;
	layout?: "row" | "stagger";
}

export function CommunityCards({
	cards,
	size = "md",
	layout = "row",
}: CommunityCardsProps) {
	const shown = cards.slice(0, 5);

	if (layout === "row") {
		const slotCount = 5 - shown.length;
		return (
			<div className="flex gap-1.5 items-center justify-center">
				<AnimatePresence initial={false}>
					{shown.map((card, i) => (
						<m.div
							key={`card-${card}-${i}`}
							initial={{ opacity: 0, scale: 0.75, y: -6 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							transition={{
								duration: 0.22,
								ease: [0.22, 1, 0.36, 1],
								delay: i < 3 && shown.length === 3 ? i * 0.06 : 0,
							}}
						>
							<PlayingCard card={card} size={size} />
						</m.div>
					))}
				</AnimatePresence>
				{Array.from({ length: slotCount }).map((_, i) => (
					<CardSlot key={`slot-${i}`} size={size} />
				))}
			</div>
		);
	}

	// ── Stagger: 3-over-2, for narrow/portrait views ──────────────────────────
	const flopCount = Math.min(shown.length, 3);
	const turnRiverCount = Math.max(0, shown.length - 3);

	const flopCards = shown.slice(0, 3);
	const turnRiverCards = shown.slice(3, 5);

	const flopSlotCount = 3 - flopCount;
	const turnRiverSlotCount = 2 - turnRiverCount;

	return (
		<div className="flex flex-col items-center gap-1.5">
			{/* Row 1: flop (3 slots, always shown as slots or cards) */}
			<div className="flex gap-1.5">
				<AnimatePresence initial={false}>
					{flopCards.map((card, i) => (
						<m.div
							key={`flop-${card}-${i}`}
							initial={{ opacity: 0, scale: 0.75, y: -6 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							transition={{
								duration: 0.22,
								ease: [0.22, 1, 0.36, 1],
								delay: i * 0.06,
							}}
						>
							<PlayingCard card={card} size={size} />
						</m.div>
					))}
				</AnimatePresence>
				{Array.from({ length: flopSlotCount }).map((_, i) => (
					<CardSlot key={`flop-slot-${i}`} size={size} />
				))}
			</div>

			{/* Row 2: turn + river (2 slots) — always rendered, even pre-flop with
			    zero cards dealt, so the board's 3-over-2 shape is visible from
			    the start instead of popping in only once the flop lands. */}
			<div className="flex gap-1.5">
				<AnimatePresence initial={false}>
					{turnRiverCards.map((card, i) => (
						<m.div
							key={`tr-${card}-${i}`}
							initial={{ opacity: 0, scale: 0.75, y: -6 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
						>
							<PlayingCard card={card} size={size} />
						</m.div>
					))}
				</AnimatePresence>
				{Array.from({ length: turnRiverSlotCount }).map((_, i) => (
					<CardSlot key={`tr-slot-${i}`} size={size} />
				))}
			</div>
		</div>
	);
}