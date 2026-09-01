import { m } from "motion/react";
import { PlayingCard } from "./PlayingCard";
import { useHoleCards } from "../hooks/useHoleCards";
import { cn } from "../../../lib/utils/cn";
import type { Card } from "@shared/games/poker/index";

interface HoleCardsProps {
	holeCards: readonly [Card, Card] | null;
	handNumber: number;
}

export function HoleCards({ holeCards, handNumber }: HoleCardsProps) {
	const { peeking, togglePeek } = useHoleCards(handNumber);

	const hasCards = holeCards !== null;

	return (
		<button
			type="button"
			onClick={togglePeek}
			disabled={!hasCards}
			className={cn(
				"flex flex-col items-center gap-3 w-full",
				"py-5 rounded-2xl border transition-all duration-200",
				hasCards
					? "border-border bg-surface-raised cursor-pointer active:scale-[0.98]"
					: "border-border/40 bg-white/2 cursor-default",
			)}
		>
			{/* cards row */}
			<div className="flex gap-3 items-center">
				<m.div
					animate={{ rotateY: peeking ? 0 : 180 }}
					transition={{ duration: 0.35, ease: "easeInOut" }}
					style={{ perspective: 600 }}
				>
					<PlayingCard
						card={peeking ? holeCards?.[0] : undefined}
						faceDown={!peeking}
						size="lg"
					/>
				</m.div>

				<m.div
					animate={{ rotateY: peeking ? 0 : 180 }}
					transition={{ duration: 0.35, ease: "easeInOut", delay: 0.05 }}
					style={{ perspective: 600 }}
				>
					<PlayingCard
						card={peeking ? holeCards?.[1] : undefined}
						faceDown={!peeking}
						size="lg"
					/>
				</m.div>
			</div>

			{/* tap hint */}
			<span
				className={cn(
					"text-[10px] font-bold tracking-widest uppercase transition-colors duration-200",
					peeking ? "text-white/50" : "text-white/25",
				)}
			>
				{!hasCards
					? "Waiting for deal…"
					: peeking
						? "Tap to hide"
						: "Tap to peek"}
			</span>
		</button>
	);
}
