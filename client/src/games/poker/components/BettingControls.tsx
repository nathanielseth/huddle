import { useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { Flag, Scale, TreePine, Flame } from "lucide-react";
import { cn } from "../../../lib/utils/cn";
import { socket } from "../../../lib/network/socket";
import type { PokerState, PokerPlayerView } from "@shared/games/poker/index";

interface BettingControlsProps {
	poker: PokerState;
	myPlayer: PokerPlayerView;
	/**
	 * When true, renders the same button grid (so the sheet never changes
	 * shape/height) but visually inert and non-interactive — used while
	 * waiting for another player so nothing above ever reflows.
	 */
	disabled?: boolean;
}

// Fix: prefer-module-scope-pure-function — emit() only closes over the
// module-level `socket` import and receives `action` as a param.
// Moving it out of BettingControls means it is allocated once, not every render.
function emit(action: object) {
	socket.emit("player_action", action);
}

export function BettingControls({
	poker,
	myPlayer,
	disabled = false,
}: BettingControlsProps) {
	const callAmount = Math.min(
		poker.betToCall - myPlayer.currentBet,
		myPlayer.stack,
	);
	const canCheck = myPlayer.currentBet >= poker.betToCall;
	const canRaise = myPlayer.canRaise && myPlayer.stack > 0;
	const allInTotal = myPlayer.stack + myPlayer.currentBet;
	const minRaiseTo = Math.min(poker.minRaise, allInTotal);

	const [raiseOpen, setRaiseOpen] = useState(false);
	const [raiseAmountRaw, setRaiseAmountRaw] = useState(minRaiseTo);

	const raiseAmount = Math.max(
		minRaiseTo,
		Math.min(raiseAmountRaw, allInTotal),
	);
	const isGoingAllIn = raiseAmount >= allInTotal;

	const potTotal = poker.pots.reduce((s, p) => s + p.amount, 0);

	// ── Raise panel ──────────────────────────────────────────────────────────
	if (raiseOpen) {
		return (
			<AnimatePresence mode="wait">
				<m.div
					key="raise-panel"
					className="flex flex-col gap-4 p-4 rounded-2xl border border-white/10 bg-white/5"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 8 }}
					transition={{ duration: 0.15 }}
				>
					<div className="flex items-center justify-between">
						<span
							className={cn(
								"font-display text-xl font-black tabular-nums",
								isGoingAllIn ? "text-red-400" : "text-white",
							)}
						>
							{isGoingAllIn ? "🔥 ALL IN" : `₱${raiseAmount}`}
						</span>
						<button
							type="button"
							onClick={() => {
								setRaiseOpen(false);
							}}
							className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer"
						>
							Cancel
						</button>
					</div>

					<input
						type="range"
						min={minRaiseTo}
						max={allInTotal}
						step={1}
						value={raiseAmount}
						onChange={(e) => {
							setRaiseAmountRaw(Number(e.target.value));
						}}
						aria-label="Raise amount"
						className="w-full accent-green-400 cursor-pointer"
					/>

					<div className="flex justify-between text-[10px] text-white/25 font-semibold">
						<span>Min ₱{minRaiseTo}</span>
						<span>All In ₱{allInTotal}</span>
					</div>

					<div className="flex gap-2">
						{potTotal > 0 &&
							([0.5, 0.75, 1] as const).map((frac) => {
								const val = Math.round(potTotal * frac);
								const clamped = Math.max(minRaiseTo, Math.min(val, allInTotal));
								return (
									<button
										key={frac}
										type="button"
										onClick={() => {
											setRaiseAmountRaw(clamped);
										}}
										className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white/50 hover:text-white cursor-pointer transition-colors"
									>
										{frac === 1 ? "Pot" : `${frac * 100}%`}
									</button>
								);
							})}
						<button
							type="button"
							onClick={() => {
								setRaiseAmountRaw(allInTotal);
							}}
							className="flex-1 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-bold text-red-300 hover:text-red-200 cursor-pointer transition-colors"
						>
							Max
						</button>
					</div>

					<button
						type="button"
						onClick={() => {
							emit(
								isGoingAllIn
									? { type: "all_in" }
									: { type: "raise", amount: raiseAmount },
							);
							setRaiseOpen(false);
						}}
						className={cn(
							"w-full h-12 rounded-xl font-bold tracking-widest uppercase text-sm cursor-pointer transition-all active:scale-[0.98]",
							isGoingAllIn
								? "bg-red-500 hover:bg-red-400 text-white"
								: "bg-green-500 hover:bg-green-400 text-white",
						)}
					>
						{isGoingAllIn ? "Go All In" : `Raise to ₱${raiseAmount}`}
					</button>
				</m.div>
			</AnimatePresence>
		);
	}

	// ── Default action grid ──────────────────────────────────────────────────
	// Always exactly 4 buttons, fixed 2x2 grid: Fold, Call/Check, Raise, All In.
	// Raise opens the slider panel; All In fires immediately without opening
	// anything. These are kept as two separate, always-visible buttons rather
	// than collapsing All In into Raise — do not re-merge them.
	//
	// `disabled` keeps all 4 slots mounted, same positions, just inert/dimmed
	// — so the sheet's height and layout never change when it's not your turn.
	const secondLabel = canCheck ? "Check" : `Call ${callAmount}`;

	return (
		<div className="grid grid-cols-2 gap-2.5">
			<ActionBtn
				label="Fold"
				icon={Flag}
				palette="fold"
				disabled={disabled}
				onClick={() => {
					emit({ type: "fold" });
				}}
			/>

			<ActionBtn
				label={secondLabel}
				icon={Scale}
				palette="call"
				disabled={disabled}
				onClick={() => {
					emit(canCheck ? { type: "check" } : { type: "call" });
				}}
			/>

			<ActionBtn
				label="Raise"
				icon={TreePine}
				palette="raise"
				disabled={disabled || !canRaise}
				onClick={() => {
					setRaiseOpen(true);
				}}
			/>

			<ActionBtn
				label="All In"
				icon={Flame}
				palette="allin"
				disabled={disabled || myPlayer.stack <= 0}
				onClick={() => {
					emit({ type: "all_in" });
				}}
			/>
		</div>
	);
}

// ── Shared button ─────────────────────────────────────────────────────────────
// Flat pastel fills (no border) — mirrors a native action-sheet button rather
// than a translucent outlined pill. Colors are deliberately soft/desaturated
// so four of them sitting together read as calm, not alarming.

const PALETTE = {
	fold: "bg-sky-200/90 hover:bg-sky-200 text-sky-950",
	call: "bg-emerald-200/90 hover:bg-emerald-200 text-emerald-950",
	raise: "bg-rose-100/90 hover:bg-rose-100 text-rose-950",
	allin: "bg-orange-200/90 hover:bg-orange-200 text-orange-950",
} as const;

function ActionBtn({
	label,
	icon: Icon,
	palette,
	onClick,
	disabled = false,
}: {
	label: string;
	icon: typeof Flag;
	palette: keyof typeof PALETTE;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			aria-disabled={disabled}
			className={cn(
				"flex items-center justify-center gap-2 h-14 rounded-2xl font-bold text-base",
				"transition-all",
				disabled
					? "opacity-35 grayscale-[0.4] cursor-default pointer-events-none"
					: cn("cursor-pointer active:scale-[0.98]", PALETTE[palette]),
				disabled && PALETTE[palette],
			)}
		>
			<Icon size={18} strokeWidth={2.5} />
			{label}
		</button>
	);
}