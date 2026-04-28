import { motion } from "motion/react";
import { useSabongState } from "../hooks/useSabongState";
import { TimerBar } from "../components/TimerBar";
import { BracketViewFull, BracketViewQF } from "../components/BracketView";
import { ManokCard } from "../components/ManokCard";
import { cn } from "../../../utils/cn";

export function PayoutPlayer() {
	const { sabong, myPlayer, fighter1, fighter2, timer } = useSabongState();

	if (!sabong || !myPlayer || !fighter1 || !fighter2) return null;

	const slot = sabong.bracket[sabong.currentMatchIndex];
	if (!slot) return null;

	const winnerId = slot.winnerId;
	const myBet = myPlayer.currentBet;
	const won = myBet ? myBet.manokId === winnerId : null;

	const winnerManok = winnerId === fighter1.id ? fighter1 : fighter2;
	const loserManok = winnerId === fighter1.id ? fighter2 : fighter1;

	const isFinalMatch = sabong.currentMatchIndex === 6;
	const nextMatchIndex = isFinalMatch
		? undefined
		: sabong.currentMatchIndex + 1;

	return (
		<div className="flex flex-col min-h-screen bg-bg">
			<div className="flex flex-col gap-3 px-5 pt-6 pb-4 border-b border-border">
				<span className="font-display text-xs font-bold tracking-[0.25em] uppercase text-white/40">
					Payout
				</span>
				<TimerBar timer={timer} />
			</div>

			<div className="flex flex-col flex-1 overflow-y-auto px-4 py-5 gap-6">
				{/* winner / loser cards */}
				<motion.div
					className="grid grid-cols-2 gap-8"
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.3 }}
				>
					<ManokCard
						manok={winnerManok}
						corner={winnerId === fighter1.id ? "red" : "blue"}
						winner
						disabled
					/>
					<ManokCard
						manok={loserManok}
						corner={winnerId === fighter1.id ? "blue" : "red"}
						loser
						disabled
					/>
				</motion.div>

				{/* personal result */}
				{myBet && won !== null && (
					<motion.div
						className={cn(
							"flex flex-col items-center gap-1 px-8 py-5 rounded-2xl border text-center",
							won
								? "border-green-500/40 bg-green-500/10"
								: "border-red-500/20 bg-red-500/5",
						)}
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.2, duration: 0.3 }}
					>
						<span
							className={cn(
								"font-display text-4xl font-black",
								won ? "text-green-400" : "text-red-400",
							)}
						>
							{won ? "YOU WON!" : "YOU LOST"}
						</span>
						<span className="text-sm text-white/50">
							{won
								? `Your ₱${myBet.amount} bet paid off`
								: `Lost ₱${myBet.amount}`}
						</span>
					</motion.div>
				)}

				{/* balance */}
				<motion.div
					className="flex flex-col items-center gap-1"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.4 }}
				>
					<span className="text-xs uppercase tracking-widest text-white/30">
						Balance
					</span>
					<span className="font-display text-3xl font-black tabular-nums text-white">
						₱{myPlayer.balance}
					</span>
				</motion.div>

				{/* bracket - QF only on phones */}
				{!isFinalMatch && (
					<motion.div
						className="flex flex-col gap-3"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.5, duration: 0.3 }}
					>
						<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
							Bracket
						</p>
						<BracketViewQF
							bracket={sabong.bracket}
							manoks={sabong.manoks}
							currentMatchIndex={sabong.currentMatchIndex}
							nextMatchIndex={nextMatchIndex}
						/>
					</motion.div>
				)}
			</div>
		</div>
	);
}

export function PayoutHost() {
	const { sabong, fighter1, fighter2, players, timer } = useSabongState();

	if (!sabong || !fighter1 || !fighter2) return null;

	const slot = sabong.bracket[sabong.currentMatchIndex];
	if (!slot) return null;

	const winnerId = slot.winnerId;
	const winnerManok = winnerId === fighter1.id ? fighter1 : fighter2;
	const loserManok = winnerId === fighter1.id ? fighter2 : fighter1;

	const matchLabel = `Match ${sabong.currentMatchIndex + 1} of 7`;
	const isFinalMatch = sabong.currentMatchIndex === 6;
	const nextMatchIndex = isFinalMatch
		? undefined
		: sabong.currentMatchIndex + 1;

	return (
		<div className="flex flex-col min-h-screen bg-bg px-8 py-8 gap-6">
			{/* header */}
			<div className="flex items-end justify-between">
				<div className="flex flex-col gap-1">
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						{matchLabel} — Result
					</span>
					<h1 className="font-display text-5xl font-black uppercase leading-none text-white">
						{winnerManok.name} wins!
					</h1>
				</div>
			</div>

			<TimerBar timer={timer} />

			{/* winner / loser cards */}
			<motion.div
				className="grid grid-cols-2 gap-8"
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.3 }}
			>
				<ManokCard
					manok={winnerManok}
					corner={winnerId === fighter1.id ? "red" : "blue"}
					winner
					disabled
				/>
				<ManokCard
					manok={loserManok}
					corner={winnerId === fighter1.id ? "blue" : "red"}
					loser
					disabled
				/>
			</motion.div>

			{/* bracket - full tree on host */}
			<motion.div
				className="flex flex-col gap-3"
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.2, duration: 0.35 }}
			>
				<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
					Tournament Bracket
				</p>
				<BracketViewFull
					bracket={sabong.bracket}
					manoks={sabong.manoks}
					currentMatchIndex={sabong.currentMatchIndex}
					nextMatchIndex={nextMatchIndex}
				/>
			</motion.div>

			{/* player results */}
			<div className="flex flex-col gap-2">
				{players.map((p) => {
					const sp = sabong.players[p.id];
					if (!sp) return null;
					const bet = sp.currentBet;
					const won = bet ? bet.manokId === winnerId : null;

					return (
						<motion.div
							key={p.id}
							className={cn(
								"flex items-center gap-4 px-5 py-3 rounded-xl border",
								won === true && "border-green-500/30 bg-green-500/8",
								won === false && "border-red-500/20 bg-red-500/5",
								won === null && "border-border bg-surface-raised",
							)}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
						>
							<span className="flex-1 font-semibold text-white">{p.name}</span>
							{bet && (
								<span className="text-sm text-white/40">
									₱{bet.amount} on{" "}
									{bet.manokId === fighter1.id ? fighter1.name : fighter2.name}
								</span>
							)}
							<span
								className={cn(
									"font-display text-xl font-black tabular-nums",
									won === true
										? "text-green-400"
										: won === false
											? "text-red-400"
											: "text-white/30",
								)}
							>
								₱{sp.balance}
							</span>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
