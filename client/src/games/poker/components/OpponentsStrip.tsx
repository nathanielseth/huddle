// client/src/games/poker/components/OpponentsStrip.tsx
//
// Horizontal scrolling row of opponent seats.
// Used in the player view to show all other players at a glance.

import { m } from "motion/react";
import { cn } from "../../../lib/utils/cn";
import { PlayingCard } from "./PlayingCard";
import type { PokerState } from "@shared/games/poker/index";

interface OpponentsStripProps {
	opponentIds: readonly string[];
	poker: PokerState;
	currentPlayerId: string | null;
}

function statusLabel(
	status: string,
): { text: string; className: string } | null {
	switch (status) {
		case "folded":
			return {
				text: "FOLDED",
				className: "text-white/25",
			};
		case "allin":
			return {
				text: "ALL IN",
				className: "text-red-400",
			};
		case "out":
			return {
				text: "OUT",
				className: "text-white/15",
			};
		default:
			return null;
	}
}

interface OpponentSeatProps {
	playerId: string;
	poker: PokerState;
	isCurrent: boolean;
}

function OpponentSeat({ playerId, poker, isCurrent }: OpponentSeatProps) {
	const player = poker.players[playerId];
	if (!player) return null;

	const isFolded = player.status === "folded";
	const isOut = player.status === "out";
	const isAllIn = player.status === "allin";
	const faded = isFolded || isOut;
	const label = statusLabel(player.status);

	// Prefer displayName from the player view, fallback to playerId
	const name = player.displayName ?? playerId;

	return (
		<m.div
			layout
			className={cn(
				"flex flex-col gap-1.5 p-2.5 rounded-xl border shrink-0 w-24 transition-all duration-300",
				isOut && "opacity-20 border-border bg-white/2",
				isFolded && "opacity-35 border-border bg-white/2",
				isCurrent &&
					"border-amber-400/60 bg-amber-500/5 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]",
				!isCurrent && !faded && "border-border bg-surface-raised",
			)}
		>
			{/* avatar initial */}
			<div className="flex items-center justify-between gap-1">
				<div
					className={cn(
						"w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0",
						isCurrent
							? "bg-amber-400/20 text-amber-300"
							: "bg-white/8 text-white/40",
					)}
				>
					{name.charAt(0).toUpperCase()}
				</div>
				{isCurrent && (
					<m.span
						className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
						animate={{ opacity: [1, 0.3, 1] }}
						transition={{ duration: 1, repeat: Infinity }}
					/>
				)}
			</div>

			{/* name */}
			<span
				className={cn(
					"text-[10px] font-semibold truncate leading-tight",
					isCurrent ? "text-amber-200" : "text-white/60",
				)}
			>
				{name}
			</span>

			{/* stack */}
			<span
				className={cn(
					"font-display text-xs font-black tabular-nums",
					faded ? "text-white/20" : "text-white/70",
				)}
			>
				₱{player.stack}
			</span>

			{/* bet chip */}
			{player.currentBet > 0 && !faded && (
				<span className="text-[9px] text-amber-400/60 tabular-nums">
					bet ₱{player.currentBet}
				</span>
			)}

			{/* card backs or status label */}
			{!faded ? (
				<div className="flex gap-1 mt-0.5">
					<PlayingCard faceDown size="sm" />
					<PlayingCard faceDown size="sm" />
				</div>
			) : (
				label && (
					<span
						className={cn(
							"text-[8px] font-black tracking-widest uppercase mt-0.5",
							label.className,
						)}
					>
						{label.text}
					</span>
				)
			)}

			{/* all-in badge (they still have card backs visible) */}
			{isAllIn && (
				<span className="text-[8px] font-black tracking-widest uppercase text-red-400 mt-0.5">
					ALL IN
				</span>
			)}
		</m.div>
	);
}

export function OpponentsStrip({
	opponentIds,
	poker,
	currentPlayerId,
}: OpponentsStripProps) {
	if (opponentIds.length === 0) return null;

	return (
		<div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
			{opponentIds.map((id) => (
				<OpponentSeat
					key={id}
					playerId={id}
					poker={poker}
					isCurrent={id === currentPlayerId}
				/>
			))}
		</div>
	);
}