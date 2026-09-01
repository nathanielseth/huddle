// client/src/games/poker/PokerTableHost.tsx
//
// Fixed-viewport host table. 100dvh, zero scroll.
// Table surface + seat geometry come from ./components/TableSurface, shared
// with PokerTablePlayer so the two views never visually drift apart.

import { m, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils/cn";
import { usePokerState } from "./hooks/usePokerState";
import { useGameStore } from "../../app/store";
import { TimerBar } from "../sabong/components/TimerBar";
import { CommunityCards } from "./components/CommunityCards";
import { PotDisplay } from "./components/PotDisplay";
import { PlayingCard } from "./components/PlayingCard";
import { TableSurface } from "./components/TableSurface";
import { getSeatPosition, getBetChipPosition } from "./lib/tableGeometry";
import type { PokerPlayerView, PokerState } from "@shared/games/poker/index";

// ── Stacking order ─────────────────────────────────────────────────────────
// Same scale as PokerTablePlayer.tsx — kept numerically identical across
// both files on purpose, even though they don't share overlays, so a
// developer moving between the two never has to re-learn what a given tier
// means. See PokerTablePlayer.tsx for the incident this prevents.
const Z = {
	seat: 10,
	betChip: 25,
	tableOverlay: 40,
	blockingOverlay: 50,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// SEAT CARD
//
// Redesigned as: cards on top (as if dealt out from the felt into the seat),
// then a single info plate below with a subtle gradient footer — name small
// and muted, stack large and dominant, since stack size is the number that
// actually matters at a glance. Dealer button is a small corner badge on the
// plate rather than an inline glyph competing with the name. Current-turn
// state glows the whole seat (cards + plate) as one unit instead of just the
// plate's border.
// ─────────────────────────────────────────────────────────────────────────────

interface HostSeatProps {
	player: PokerPlayerView;
	name: string;
	isCurrent: boolean;
	isDealer: boolean;
	showCards: boolean;
}

function HostSeat({
	player,
	name,
	isCurrent,
	isDealer,
	showCards,
}: HostSeatProps) {
	const isFolded = player.status === "folded";
	const isOut = player.status === "out";
	const isAllIn = player.status === "allin";
	const faded = isFolded || isOut;

	return (
		<div
			className={cn(
				"relative flex flex-col items-center transition-all duration-300",
				isCurrent && !faded && "drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]",
			)}
			style={{ width: "clamp(8rem, 15cqw, 12rem)" }}
		>
			{/* dealer button — corner badge, not competing with the name line */}
			{isDealer && (
				<span className="absolute -top-2 -left-2 z-10 w-6 h-6 rounded-full bg-white border-2 border-black/40 flex items-center justify-center text-[10px] font-black text-black shadow-md">
					D
				</span>
			)}

			{/* cards — sit above the plate, as if just dealt to the seat */}
			{!faded && (
				<div className="flex gap-1 mb-[-0.6rem] z-1">
					{showCards ? (
						<>
							<PlayingCard card={player.holeCards[0] ?? undefined} size="lg" />
							<PlayingCard card={player.holeCards[1] ?? undefined} size="lg" />
						</>
					) : (
						<>
							<PlayingCard faceDown size="lg" />
							<PlayingCard faceDown size="lg" />
						</>
					)}
				</div>
			)}

			{/* info plate */}
			<div
				className={cn(
					"relative w-full rounded-xl border overflow-hidden",
					isOut && "border-white/5",
					isFolded && "border-white/5",
					isCurrent && !faded && "border-amber-400/70",
					!isCurrent && !faded && "border-white/10",
				)}
				style={{ backdropFilter: "blur(8px)" }}
			>
				{/* gradient footer fill instead of a flat single-alpha block —
				    reads as a lit plaque rather than a debug rectangle */}
				<div
					className="absolute inset-0"
					style={{
						background:
							isCurrent && !faded
								? "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(20,15,0,0.9) 100%)"
								: faded
									? "rgba(0,0,0,0.5)"
									: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.82) 100%)",
					}}
				/>

				<div className="relative flex flex-col items-center gap-0.5 px-3 pt-2.5 pb-2">
					<div className="flex items-center gap-1.5 max-w-full">
						<span
							className={cn(
								"text-xs font-semibold truncate",
								isCurrent
									? "text-amber-200"
									: faded
										? "text-white/35"
										: "text-white/60",
							)}
						>
							{name}
						</span>
						{isCurrent && !faded && (
							<m.span
								className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400"
								animate={{ opacity: [1, 0.15, 1] }}
								transition={{ duration: 0.85, repeat: Infinity }}
							/>
						)}
					</div>

					<span
						className={cn(
							"font-display text-xl font-black tabular-nums leading-none",
							faded ? "text-white/30" : "text-white",
						)}
					>
						₱{player.stack}
					</span>

					{isAllIn && (
						<span className="text-[9px] font-black tracking-widest uppercase text-red-400 leading-none mt-0.5">
							ALL IN
						</span>
					)}
					{isFolded && (
						<span className="text-[9px] font-black tracking-widest uppercase text-white/25 leading-none mt-0.5">
							FOLDED
						</span>
					)}
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// OVAL TABLE COMPOSITE
// ─────────────────────────────────────────────────────────────────────────────

interface OvalTableProps {
	poker: PokerState;
	playerMap: Record<string, { id: string; name: string; score: number }>;
	showCards: boolean;
}

function OvalTable({ poker, playerMap, showCards }: OvalTableProps) {
	const { seatOrder, players, currentPlayerId, dealerSeatIndex } = poker;
	const activeSeatIds = seatOrder.filter((id) => players[id]);
	const count = activeSeatIds.length;

	return (
		<div
			className="relative mx-auto"
			style={{
				aspectRatio: "1000 / 560",
				width: "min(100cqw, 100cqh * (1000 / 560))",
				height: "min(100cqh, 100cqw * (560 / 1000))",
			}}
		>
			<div className="absolute inset-0">
				<TableSurface />
			</div>

			<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
				<PotDisplay pots={poker.pots} />
				<CommunityCards cards={poker.communityCards} size="xl" layout="row" />
				<AnimatePresence mode="wait">
					{poker.lastAction && (
						<m.p
							key={`${poker.lastAction.playerId}-${poker.lastAction.type}`}
							initial={{ opacity: 0, y: 3 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="text-base text-white/40 text-center mt-1"
						>
							<span className="text-white/65 font-semibold">
								{poker.players[poker.lastAction.playerId]?.displayName ??
									playerMap[poker.lastAction.playerId]?.name ??
									poker.lastAction.playerId}
							</span>{" "}
							{formatLastAction(poker.lastAction)}
						</m.p>
					)}
				</AnimatePresence>
			</div>

			{activeSeatIds.map((id, seatIdx) => {
				const player = players[id];
				if (!player) return null;
				const pos = getSeatPosition(seatIdx, count);
				const isCurrent = id === currentPlayerId;
				const isDealer = seatIdx === dealerSeatIndex;
				const name = player.displayName ?? playerMap[id]?.name ?? id;

				return (
					<div key={id} className="absolute" style={{ ...pos, zIndex: Z.seat }}>
						<HostSeat
							player={player}
							name={name}
							isCurrent={isCurrent}
							isDealer={isDealer}
							showCards={showCards}
						/>
					</div>
				);
			})}

			{/* bet chips — on the felt between each seat and the pot, not part
			    of the seat badge itself */}
			{activeSeatIds.map((id, seatIdx) => {
				const player = players[id];
				if (!player || player.currentBet <= 0) return null;
				const faded = player.status === "folded" || player.status === "out";
				if (faded) return null;
				const pos = getBetChipPosition(seatIdx, count, 0, "landscape", 65);

				return (
					<div
						key={`chip-${id}`}
						className="absolute"
						style={{ ...pos, zIndex: Z.betChip }}
					>
						<BetChip amount={player.currentBet} />
					</div>
				);
			})}
		</div>
	);
}

function BetChip({ amount }: { amount: number }) {
	return (
		<div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/70 backdrop-blur-sm border border-amber-400/20">
			<span className="w-3 h-3 rounded-full bg-linear-to-br from-amber-300 to-amber-600 shadow-[0_0_0_1.5px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)]" />
			<span className="text-sm font-bold text-amber-300 tabular-nums leading-none">
				{amount}
			</span>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function phaseLabel(phase: string): string {
	const labels: Record<string, string> = {
		pre_flop: "Pre-Flop",
		flop: "Flop",
		turn: "Turn",
		river: "River",
		showdown: "Showdown",
		hand_end: "Hand Result",
		waiting: "Waiting",
		finished: "Game Over",
	};
	return labels[phase] ?? phase;
}

function formatLastAction(action: { type: string; amount?: number }): string {
	switch (action.type) {
		case "fold":
			return "folded";
		case "check":
			return "checked";
		case "call":
			return `called ₱${action.amount ?? ""}`;
		case "raise":
			return `raised to ₱${action.amount ?? ""}`;
		case "all_in":
			return `went ALL IN (₱${action.amount ?? ""})`;
		default:
			return action.type;
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE OVERLAYS
// ─────────────────────────────────────────────────────────────────────────────

function WaitingOverlay() {
	return (
		<m.div
			key="waiting"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.3 }}
			className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-bg/80 backdrop-blur-sm"
		>
			<span className="font-display text-xs font-bold tracking-[0.4em] uppercase text-white/30">
				Next Hand
			</span>
			<h2 className="font-display text-6xl font-black uppercase text-white">
				Starting Soon
			</h2>
			<div className="flex gap-1.5 mt-2">
				{[0, 1, 2].map((i) => (
					<m.span
						key={i}
						className="w-2 h-2 rounded-full bg-white/25"
						animate={{ opacity: [0.25, 1, 0.25] }}
						transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
					/>
				))}
			</div>
		</m.div>
	);
}

function HandResultOverlay({
	poker,
	playerMap,
}: {
	poker: PokerState;
	playerMap: Record<string, { name: string }>;
}) {
	if (!poker.handResult) return null;
	const { potResults } = poker.handResult;

	return (
		<m.div
			key="hand-result"
			initial={{ opacity: 0, y: -16 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -16 }}
			transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
			className="absolute inset-x-0 top-0 z-40 px-6 pt-4"
		>
			<div className="flex flex-col gap-2 rounded-2xl border border-gold/30 bg-black/90 backdrop-blur-sm px-6 py-4">
				<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
					Hand #{poker.handNumber} Result
				</p>
				{potResults.map((pr, i) => (
					<div
						key={`${pr.winnerIds.join(",")}-${pr.amount}`}
						className="flex items-center justify-between gap-4"
					>
						<span className="text-xs text-white/40 shrink-0">
							{i === 0 ? "Main pot" : `Side pot ${i}`} · ₱{pr.amount}
						</span>
						<div className="flex items-center gap-3 min-w-0">
							{pr.handDescription && (
								<span className="text-xs text-white/30 truncate">
									{pr.handDescription}
								</span>
							)}
							<span className="font-display text-lg font-black text-gold shrink-0">
								{pr.winnerIds
									.map((id) => playerMap[id]?.name ?? id)
									.join(" & ")}
							</span>
						</div>
					</div>
				))}
			</div>
		</m.div>
	);
}

function FinishedOverlay({
	poker,
	playerMap,
}: {
	poker: PokerState;
	playerMap: Record<string, { name: string }>;
}) {
	const leaveRoom = useGameStore((s) => s.leaveRoom);
	const sorted = poker.seatOrder
		.reduce<{ id: string; stack: number }[]>((acc, id) => {
			const p = poker.players[id];
			if (p) acc.push({ id, stack: p.stack });
			return acc;
		}, [])
		.toSorted((a, b) => b.stack - a.stack);
	const winner = sorted[0];

	return (
		<m.div
			key="finished"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.4 }}
			className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8 bg-bg/95 backdrop-blur-sm"
		>
			<h2 className="font-display text-6xl font-black uppercase text-gold">
				Game Over
			</h2>
			{winner && (
				<div className="flex flex-col items-center gap-1">
					<span className="text-white/40 text-sm">Winner</span>
					<span className="font-display text-4xl font-black text-white">
						{playerMap[winner.id]?.name ?? winner.id}
					</span>
					<span className="font-display text-2xl font-black text-gold tabular-nums">
						₱{winner.stack}
					</span>
				</div>
			)}
			<div className="flex flex-col gap-2 w-full max-w-md">
				{sorted.map(({ id, stack }, i) => (
					<div
						key={id}
						className={cn(
							"flex items-center justify-between px-4 py-3 rounded-xl border",
							i === 0
								? "border-gold/40 bg-[rgba(232,185,58,0.05)]"
								: "border-border bg-surface-raised opacity-60",
						)}
					>
						<span className="text-white/50 font-bold text-sm w-6">
							#{i + 1}
						</span>
						<span className="flex-1 text-sm font-semibold text-white/80">
							{playerMap[id]?.name ?? id}
						</span>
						<span className="font-display font-black tabular-nums text-white">
							₱{stack}
						</span>
					</div>
				))}
			</div>
			<button
				type="button"
				onClick={leaveRoom}
				className="mt-2 px-8 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm font-bold tracking-widest uppercase cursor-pointer transition-all active:scale-[0.98]"
			>
				End Session
			</button>
		</m.div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────

export function PokerTableHost() {
	const { poker, playerMap, timer } = usePokerState();
	if (!poker) return null;

	const phase = poker.phase;
	const isWaiting = phase === "waiting";
	const isHandEnd = phase === "hand_end";
	const isShowdown = phase === "showdown";
	const isFinished = phase === "finished";
	const showCards = isShowdown || isHandEnd;

	return (
		<div className="relative flex flex-col w-full h-dvh overflow-hidden bg-black">
			<div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/5">
				<div className="flex items-center gap-3">
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/25">
						Hand #{poker.handNumber}
					</span>
					<span className="text-white/15">·</span>
					<span className="font-display text-sm font-black uppercase text-white/60">
						{phaseLabel(phase)}
					</span>
				</div>
				<PotDisplay pots={poker.pots} />
			</div>

			<div
				className="flex-1 min-h-0 flex items-center justify-center p-4"
				style={{ containerType: "size" }}
			>
				<OvalTable poker={poker} playerMap={playerMap} showCards={showCards} />
			</div>

			<div className="shrink-0 px-6 py-3 border-t border-white/5">
				<TimerBar timer={timer} />
			</div>

			<AnimatePresence>
				{isWaiting && <WaitingOverlay />}
				{isHandEnd && <HandResultOverlay poker={poker} playerMap={playerMap} />}
				{isFinished && <FinishedOverlay poker={poker} playerMap={playerMap} />}
			</AnimatePresence>
		</div>
	);
}