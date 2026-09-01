// client/src/games/poker/PokerTablePlayer.tsx
//
// Phone player view. Renders the *same* oval table graphic as the host
// (see ./components/TableSurface), rotated so "my" seat always sits at the
// bottom of the ring — but seats on the felt are small badges only (name,
// stack, bet chip), same size for everyone including me. My actual hole
// cards are NOT part of the rotating ring: they dock in a fixed strip right
// above the action sheet, so they never move, never get huge, and never
// visually detach from "You ₱X" the way they did when both lived inside the
// same absolutely-positioned seat column.

import type { ReactNode } from "react";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { m, AnimatePresence } from "motion/react";
import { cn } from "../../lib/utils/cn";
import { usePokerState } from "./hooks/usePokerState";
import { useGameStore } from "../../app/store";
import { BettingControls } from "./components/BettingControls";
import { TimerBar } from "../sabong/components/TimerBar";
import { CommunityCards } from "./components/CommunityCards";
import { PotDisplay } from "./components/PotDisplay";
import { PlayingCard } from "./components/PlayingCard";
import { TableSurface } from "./components/TableSurface";
import {
	getSeatPosition,
	getRotationOffsetForSeat,
	getBetChipPosition,
} from "./lib/tableGeometry";
import type {
	Card,
	PokerPlayerView,
	PokerState,
} from "@shared/games/poker/index";

// ── Stacking order ─────────────────────────────────────────────────────────
//
// One explicit scale for every z-indexed element in this view. The bug this
// prevents: bet chips were bumped to z-30 to clear seat badges (z-20), but
// WaitingOverlay/HandResultOverlay were ALSO z-20 — nobody had reconciled the
// two scales, so chips ended up rendering on top of a full-screen dimming
// overlay that was supposed to cover the whole table. Anything added later
// should pick a tier from here rather than a fresh ad-hoc number.
const Z = {
	/** Seat badge for an opponent. */
	seatOpponent: 10,
	/** Seat badge for "me" — sits slightly above opponents. */
	seatMe: 20,
	/** Bet chips on the felt — above all seats, still part of the table. */
	betChip: 25,
	/** Full-table overlays (waiting/hand-result banners) — above everything
	 *  on the table, since they're meant to dim/replace it. */
	tableOverlay: 40,
	/** Terminal/blocking overlays (game finished) — above table overlays. */
	blockingOverlay: 50,
} as const;

// ── Phase helpers ─────────────────────────────────────────────────────────────

function isBettingPhase(phase: string) {
	return ["pre_flop", "flop", "turn", "river"].includes(phase);
}

function phaseLabel(phase: string): string {
	const labels: Record<string, string> = {
		pre_flop: "Pre-Flop",
		flop: "Flop",
		turn: "Turn",
		river: "River",
		showdown: "Showdown",
		hand_end: "Hand Over",
		waiting: "Starting Soon",
		finished: "Game Over",
	};
	return labels[phase] ?? phase;
}

// ── Seat badge — small, identical shape for every seat; mine reveals cards ──
//
// Every seat shows card BACKS by default. "Me" is the one seat that can show
// FACE-UP cards, because I'm the only client that has my own hole cards —
// they render right here at the seat, same spot the backs would occupy, just
// larger and face up. This is the one and only place my cards render: there
// is no separate detached "dock" duplicating them below the table.

interface SeatBadgeProps {
	player: PokerPlayerView;
	name: string;
	isCurrent: boolean;
	isDealer: boolean;
	isMe: boolean;
	holeCards?: readonly [Card, Card] | null;
}

function SeatBadge({
	player,
	name,
	isCurrent,
	isDealer,
	isMe,
	holeCards,
}: SeatBadgeProps) {
	const isFolded = player.status === "folded";
	const isOut = player.status === "out";
	const isAllIn = player.status === "allin";
	const faded = isFolded || isOut;

	const revealed = isMe && holeCards != null;

	return (
		<div
			className={cn("flex flex-col items-center", revealed ? "gap-2" : "gap-1")}
		>
			{!faded && (
				<div
					className={cn("relative z-10 flex", revealed ? "gap-1" : "gap-0.5")}
				>
					{revealed ? (
						<>
							<PlayingCard card={holeCards[0]} size="md" />
							<PlayingCard card={holeCards[1]} size="md" />
						</>
					) : (
						<>
							<PlayingCard faceDown size="sm" />
							<PlayingCard faceDown size="sm" />
						</>
					)}
				</div>
			)}

			<div
				className={cn(
					"relative z-0 flex items-center gap-1.5 px-2 py-1 rounded-lg shrink-0",
					// Faded seats get a flatter, more opaque fill instead of stacking
					// opacity on top of an already-translucent background — layering
					// two alphas (bg-black/75 * opacity-40 ≈ 0.3) is what made folded
					// seats nearly disappear against the felt.
					isMe ? "bg-black" : faded ? "bg-black/55" : "bg-black/75",
					isCurrent && !faded && "shadow-[0_0_0_2px_rgba(251,191,36,0.55)]",
				)}
			>
				{isDealer && (
					<span className="shrink-0 w-4 h-4 rounded-full bg-white flex items-center justify-center text-[8px] font-black text-black">
						D
					</span>
				)}
				<div className="flex flex-col leading-tight min-w-0">
					<span
						className={cn(
							"text-[11px] font-semibold truncate max-w-18",
							isMe
								? "text-amber-300"
								: faded
									? "text-white/35"
									: "text-white/55",
						)}
					>
						{name}
					</span>
					<span
						className={cn(
							"font-display text-sm font-black tabular-nums leading-none",
							faded ? "text-white/30" : "text-white",
						)}
					>
						₱{player.stack}
					</span>
				</div>
				{isCurrent && !faded && (
					<m.span
						className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
						animate={{ opacity: [1, 0.2, 1] }}
						transition={{ duration: 0.85, repeat: Infinity }}
					/>
				)}
			</div>

			{isFolded && (
				<span className="text-[8px] font-black tracking-widest uppercase text-white/30">
					FOLDED
				</span>
			)}
			{isAllIn && (
				<span className="text-[8px] font-black tracking-widest uppercase text-red-400">
					ALL IN
				</span>
			)}
		</div>
	);
}

// ── Responsive orientation ────────────────────────────────────────────────
//
// The oval table has two real shapes: portrait (tall phone) and landscape
// (wide window / tablet-in-landscape / desktop browser resized short).
// Previously this view always used the portrait TableSurface + geometry,
// sized via cqw/cqh — fine on an actual tall phone, but on a wide-short
// window (e.g. a desktop browser resized down) the height-driven side of
// that min() collapses to almost nothing, shrinking the whole table into a
// tiny floating blob. Instead we measure the actual available box and pick
// whichever orientation fits it, the same way the table would be drawn if
// you physically rotated it to fit the space.
//
// Orientation is read via useSyncExternalStore rather than
// useState+useEffect. The old version always mounted with a hardcoded
// "portrait" default and only measured the real container size inside a
// mount effect — so on a landscape window every load painted one throwaway
// frame in the wrong orientation before snapping to the right one. There's
// no server-rendered HTML here to hydrate against, so there's no reason to
// wait for an effect: useSyncExternalStore's getSnapshot runs during render
// itself, which lets the *first* paint already reflect the container's real
// shape.

type Orientation = "portrait" | "landscape";

function subscribeToOrientation(
	el: HTMLDivElement | null,
	onChange: () => void,
) {
	if (!el) return () => {};
	const observer = new ResizeObserver(onChange);
	observer.observe(el);
	return () => observer.disconnect();
}

function useContainerOrientation() {
	const ref = useRef<HTMLDivElement>(null);
	// Cache so getSnapshot can return a referentially-stable value when the
	// measured orientation hasn't actually changed (useSyncExternalStore
	// requires a stable snapshot to avoid re-render loops).
	const lastOrientation = useRef<Orientation>("portrait");

	const subscribe = useCallback((onChange: () => void) => {
		return subscribeToOrientation(ref.current, onChange);
	}, []);

	const getSnapshot = useCallback((): Orientation => {
		const el = ref.current;
		if (!el) return lastOrientation.current;
		const { width, height } = el.getBoundingClientRect();
		if (width <= 0 || height <= 0) return lastOrientation.current;
		// Container is wider than it is tall (accounting for the portrait
		// table's own ~0.66 aspect) -> landscape table fits better.
		const next: Orientation = width / height > 0.85 ? "landscape" : "portrait";
		lastOrientation.current = next;
		return next;
	}, []);

	const orientation = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	return { ref, orientation };
}

// ── Oval table — adapts portrait/landscape to the space it's actually given ─

interface MobileOvalTableProps {
	poker: PokerState;
	myPlayerId: string;
	playerMap: Record<string, { id: string; name: string; score: number }>;
	myHoleCards: readonly [Card, Card] | null;
}

const ORIENTATION_DIMENSIONS = {
	portrait: { w: 640, h: 970 },
	landscape: { w: 1000, h: 560 },
} as const;

function MobileOvalTable({
	poker,
	myPlayerId,
	playerMap,
	myHoleCards,
}: MobileOvalTableProps) {
	const { seatOrder, players, currentPlayerId, dealerSeatIndex } = poker;
	const activeSeatIds = seatOrder.filter((id) => players[id]);
	const count = activeSeatIds.length;

	const mySeatIdx = activeSeatIds.indexOf(myPlayerId);
	const rotation =
		mySeatIdx >= 0 ? getRotationOffsetForSeat(mySeatIdx, count) : 0;

	const { ref: measureRef, orientation } = useContainerOrientation();
	const { w, h } = ORIENTATION_DIMENSIONS[orientation];

	return (
		<div
			ref={measureRef}
			className="relative w-full h-full"
			style={{ containerType: "size" }}
		>
			<div
				className="relative mx-auto"
				style={{
					aspectRatio: `${w} / ${h}`,
					// 88% reserves margin on all sides for seat badges that sit
					// slightly outside the felt edge by design (getSeatPosition's
					// ~1.076x push) — without this margin those badges clip
					// against the viewport on narrow windows.
					width: `min(88cqw, 88cqh * (${w} / ${h}))`,
					height: `min(88cqh, 88cqw * (${h} / ${w}))`,
				}}
			>
				<div className="absolute inset-0">
					<TableSurface orientation={orientation} />
				</div>

				{/* pot + board, dead center */}
				<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
					<PotDisplay pots={poker.pots} />
					<CommunityCards
						cards={poker.communityCards}
						size="md"
						layout={orientation === "portrait" ? "stagger" : "row"}
					/>
				</div>

				{/* seats — every seat (mine included) is the same badge shape */}
				{activeSeatIds.map((id, seatIdx) => {
					const player = players[id];
					if (!player) return null;
					const isMe = id === myPlayerId;
					const pos = getSeatPosition(seatIdx, count, rotation, orientation);
					const name = player.displayName ?? playerMap[id]?.name ?? id;

					return (
						<div
							key={id}
							className="absolute"
							style={{ ...pos, zIndex: isMe ? Z.seatMe : Z.seatOpponent }}
						>
							<SeatBadge
								player={player}
								name={isMe ? "You" : name}
								isCurrent={id === currentPlayerId}
								isDealer={seatIdx === dealerSeatIndex}
								isMe={isMe}
								holeCards={isMe ? myHoleCards : undefined}
							/>
						</div>
					);
				})}

				{/* bet chips — on the felt between each seat and the pot, not
				    part of the seat badge itself. radiusPct pulled in further than
				    the default (65 vs 85): mobile seats stack cards ABOVE the
				    badge, so the seat's combined visual footprint is taller than
				    the badge alone — the default clearance wasn't enough and
				    chips were landing under the card corners. */}
				{activeSeatIds.map((id, seatIdx) => {
					const player = players[id];
					if (!player || player.currentBet <= 0) return null;
					const faded = player.status === "folded" || player.status === "out";
					if (faded) return null;
					const pos = getBetChipPosition(
						seatIdx,
						count,
						rotation,
						orientation,
						65,
					);

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
		</div>
	);
}

function BetChip({ amount }: { amount: number }) {
	return (
		<div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/70 backdrop-blur-sm border border-amber-400/20">
			<span className="w-2 h-2 rounded-full bg-linear-to-br from-amber-300 to-amber-600 shadow-[0_0_0_1px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)]" />
			<span className="text-[10px] font-bold text-amber-300 tabular-nums leading-none">
				{amount}
			</span>
		</div>
	);
}

// ── Overlays ───────────────────────────────────────────────────────────────

function WaitingOverlay() {
	return (
		<m.div
			key="waiting-overlay"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.3 }}
			className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-bg/80 backdrop-blur-sm"
		>
			<span className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/30">
				Next Hand
			</span>
			<h2 className="font-display text-4xl font-black uppercase text-white">
				Starting Soon
			</h2>
			<div className="flex gap-1 mt-2">
				{[0, 1, 2].map((i) => (
					<m.span
						key={i}
						className="w-1.5 h-1.5 rounded-full bg-white/30"
						animate={{ opacity: [0.3, 1, 0.3] }}
						transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
					/>
				))}
			</div>
		</m.div>
	);
}

function HandResultOverlay() {
	const { poker, myPlayer, playerMap } = usePokerState();
	if (!poker?.handResult) return null;

	const { potResults } = poker.handResult;
	const myWonPots = potResults.filter(
		(r) => myPlayer && r.winnerIds.includes(myPlayer.playerId),
	);
	const totalWon = myWonPots.reduce(
		(s, r) => s + Math.floor(r.amount / r.winnerIds.length),
		0,
	);
	const iWon = myWonPots.length > 0;
	const netChange = iWon
		? totalWon - (myPlayer?.totalContributed ?? 0)
		: -(myPlayer?.totalContributed ?? 0);

	return (
		<m.div
			key="hand-result-overlay"
			initial={{ opacity: 0, y: -12 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -12 }}
			transition={{ duration: 0.3 }}
			className="absolute inset-x-0 top-0 z-40 px-4 pt-4"
		>
			<div
				className={cn(
					"rounded-2xl border px-5 py-4 backdrop-blur-md",
					iWon
						? "border-gold/40 bg-[rgba(232,185,58,0.12)] shadow-[0_0_40px_rgba(232,185,58,0.15)]"
						: "border-white/10 bg-black/70",
				)}
			>
				{iWon ? (
					<div className="flex items-center justify-between">
						<div className="flex flex-col gap-0.5">
							<span className="font-display text-2xl font-black text-gold">
								You Win!
							</span>
							{myWonPots[0]?.handDescription && (
								<span className="text-[10px] font-bold uppercase tracking-widest text-gold/50">
									{myWonPots[0].handDescription}
								</span>
							)}
						</div>
						<div className="flex flex-col items-end gap-0.5">
							<span className="font-display text-2xl font-black tabular-nums text-white">
								+₱{totalWon}
							</span>
							<span
								className={cn(
									"text-xs font-bold tabular-nums",
									netChange > 0 ? "text-green-400" : "text-red-400",
								)}
							>
								{netChange > 0 ? `+₱${netChange}` : `₱${netChange}`} net
							</span>
						</div>
					</div>
				) : (
					<div className="flex items-center justify-between">
						<span className="text-sm text-white/50">
							{potResults[0]?.winnerIds
								.map((id) => playerMap[id]?.name ?? id)
								.join(" & ")}{" "}
							wins
						</span>
						<span
							className={cn(
								"text-sm font-bold tabular-nums",
								netChange < 0 ? "text-red-400" : "text-white/40",
							)}
						>
							₱{netChange}
						</span>
					</div>
				)}
			</div>
		</m.div>
	);
}

function FinishedOverlay() {
	const { poker, myPlayer, playerMap } = usePokerState();
	const leaveRoom = useGameStore((s) => s.leaveRoom);
	if (!poker) return null;

	const sorted = poker.seatOrder
		.reduce<{ id: string; stack: number }[]>((acc, id) => {
			const p = poker.players[id];
			if (p) acc.push({ id, stack: p.stack });
			return acc;
		}, [])
		.toSorted((a, b) => b.stack - a.stack);

	const myRank = sorted.findIndex(({ id }) => id === myPlayer?.playerId) + 1;
	const iWinner = myRank === 1;

	return (
		<m.div
			key="finished-overlay"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.4 }}
			className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 px-6 bg-bg/95 backdrop-blur-sm"
		>
			<h2
				className={cn(
					"font-display text-5xl font-black uppercase",
					iWinner ? "text-gold" : "text-white",
				)}
			>
				{iWinner ? "🏆 You Win!" : "Game Over"}
			</h2>

			<div className="flex flex-col items-center gap-1">
				<span className="font-display text-2xl font-black text-white/50">
					#{myRank} of {sorted.length}
				</span>
				<span className="font-display text-3xl font-black tabular-nums text-white">
					₱{myPlayer?.stack ?? 0}
				</span>
			</div>

			<div className="flex flex-col gap-2 w-full max-w-sm">
				{sorted.map(({ id, stack }, i) => (
					<div
						key={id}
						className={cn(
							"flex items-center justify-between px-4 py-2 rounded-xl border text-sm",
							id === myPlayer?.playerId
								? "border-white/20 bg-white/5 text-white"
								: "border-border bg-surface-raised text-white/40",
						)}
					>
						<span className="w-5 font-bold">#{i + 1}</span>
						<span className="flex-1">{playerMap[id]?.name ?? id}</span>
						<span className="font-display font-black tabular-nums">
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
				Leave Table
			</button>
		</m.div>
	);
}

// ── Top status bar ────────────────────────────────────────────────────────────

function StatusBar({ poker }: { poker: PokerState }) {
	return (
		<div className="shrink-0 flex items-center justify-between px-4 py-2.5">
			<span className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/30">
				{phaseLabel(poker.phase)}
			</span>
			<span className="text-[10px] text-white/20 tabular-nums">
				Hand #{poker.handNumber}
			</span>
		</div>
	);
}

// ── Sticky bottom action sheet ────────────────────────────────────────────────
//
// Always mounted with the SAME shape — status line, timer, button grid — for
// every phase/turn combination. Only the status text and the grid's
// `disabled` flag change; nothing here ever unmounts or resizes, so the
// table above never reflows when the phase changes or turns pass around.
// (Previously this component returned null outside betting phases and swapped
// between differently-shaped fragments, which is what caused the table and
// hole-card dock to visibly jump.)

function StickyBottom() {
	const { poker, myPlayer, isMyTurn, timer, playerMap } = usePokerState();

	if (!poker || !myPlayer) return null;

	const betting = isBettingPhase(poker.phase);
	const folded = myPlayer.status === "folded";
	const allin = myPlayer.status === "allin";
	const out = myPlayer.status === "out";
	const active = betting && !folded && !allin && !out;

	const currentActorName = poker.currentPlayerId
		? (playerMap[poker.currentPlayerId]?.name ??
			poker.players[poker.currentPlayerId]?.displayName ??
			"Someone")
		: null;

	// One status line, one slot — text changes, layout doesn't.
	let statusNode: ReactNode;
	if (out) {
		statusNode = (
			<span className="text-xs font-bold tracking-widest uppercase text-white/20">
				Spectating
			</span>
		);
	} else if (folded) {
		statusNode = (
			<span className="text-xs font-bold tracking-widest uppercase text-white/30">
				You folded
			</span>
		);
	} else if (allin) {
		statusNode = (
			<span className="text-sm font-bold tracking-widest uppercase text-red-400">
				🔥 All In
			</span>
		);
	} else if (!betting) {
		statusNode = (
			<span className="text-xs font-bold tracking-widest uppercase text-white/25">
				{phaseLabel(poker.phase)}
			</span>
		);
	} else if (isMyTurn) {
		statusNode = (
			<span className="text-xs text-white/40 font-semibold">
				Your turn
				{poker.betToCall > myPlayer.currentBet && (
					<span className="ml-2 text-white/60">
						— call ₱
						{Math.min(poker.betToCall - myPlayer.currentBet, myPlayer.stack)} to
						stay
					</span>
				)}
			</span>
		);
	} else {
		statusNode = (
			<span className="text-xs text-white/30 font-semibold">
				Waiting for{" "}
				<span className="text-white/50 font-bold">
					{currentActorName ?? "next player"}
				</span>
			</span>
		);
	}

	return (
		<div className="shrink-0 border-t border-white/5 bg-bg/95 backdrop-blur-md px-4 py-3">
			<div className="flex flex-col gap-2.5 max-w-xl mx-auto">
				<div className="flex items-center justify-center min-h-5">
					{statusNode}
				</div>

				<TimerBar timer={timer} />

				<BettingControls
					key={`${poker.handNumber}-${poker.phase}`}
					poker={poker}
					myPlayer={myPlayer}
					disabled={!active || !isMyTurn}
				/>
			</div>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export function PokerTablePlayer() {
	const { poker, myPlayer, holeCards, playerMap, playerId } = usePokerState();
	if (!poker) return null;

	const phase = poker.phase;
	const isWaiting = phase === "waiting";
	const isHandEnd = phase === "hand_end";
	const isShowdown = phase === "showdown";
	const isFinished = phase === "finished";

	// Resolve my hole cards: prefer the live private secret, fall back to the
	// revealed cards on my own player view at showdown/hand-end.
	const resolvedHoleCards: readonly [Card, Card] | null =
		holeCards ??
		((isShowdown || isHandEnd) && myPlayer?.holeCards[0] != null
			? (myPlayer.holeCards as [Card, Card])
			: null);

	return (
		<div className="relative flex flex-col w-full h-dvh overflow-hidden bg-black">
			<StatusBar poker={poker} />

			{/* table fills all remaining space above the controls */}
			<div
				className="flex-1 min-h-0 flex items-center justify-center px-2"
				style={{ containerType: "size" }}
			>
				<MobileOvalTable
					poker={poker}
					myPlayerId={playerId}
					playerMap={playerMap}
					myHoleCards={resolvedHoleCards}
				/>
			</div>

			<StickyBottom />

			<AnimatePresence>
				{isWaiting && <WaitingOverlay />}
				{isHandEnd && <HandResultOverlay />}
				{isFinished && <FinishedOverlay />}
			</AnimatePresence>
		</div>
	);
}