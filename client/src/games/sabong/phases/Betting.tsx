import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { useSabongState } from "../hooks/useSabongState";
import { ManokCard } from "../components/ManokCard";
import { TimerBar } from "../components/TimerBar";
import { socket } from "../../../lib/socket";
import { cn } from "../../../utils/cn";

// player
export function BettingPlayer() {
	const { sabong, myPlayer, fighter1, fighter2, players, timer, playerId } =
		useSabongState();

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [amount, setAmount] = useState(10);

	if (!sabong || !myPlayer || !fighter1 || !fighter2) return null;

	const isLocked = myPlayer.betLocked;
	const balance = myPlayer.balance;

	const lockedCount = Object.values(sabong.players).filter(
		(p) => p.betLocked,
	).length;
	const totalPlayers = players.length;
	const canLock = !!selectedId && amount >= 1 && !isLocked;

	function handleSelect(manokId: string) {
		if (isLocked) return;
		setSelectedId(manokId);
		socket.emit("player_action", { type: "place_bet", manokId, amount });
	}

	function handleSlider(e: React.ChangeEvent<HTMLInputElement>) {
		const val = Number(e.target.value);
		setAmount(val);
		if (selectedId) {
			socket.emit("player_action", {
				type: "place_bet",
				manokId: selectedId,
				amount: val,
			});
		}
	}

	function handleLock() {
		if (!canLock) return;
		socket.emit("player_action", { type: "lock_bet" });
	}

	const matchLabel = `Match ${sabong.currentMatchIndex + 1} of 7`;

	return (
		<div className="flex flex-col min-h-screen bg-bg">
			{/* header */}
			<div className="flex flex-col gap-3 px-5 pt-6 pb-4 border-b border-border">
				<div className="flex items-center justify-between">
					<span className="font-display text-xs font-bold tracking-[0.25em] uppercase text-white/40">
						{matchLabel}
					</span>
					<span className="text-xs text-white/30">
						{lockedCount}/{totalPlayers} locked
					</span>
				</div>
				<h1 className="font-display text-3xl font-black uppercase leading-none text-white">
					Place Your Bet
				</h1>
				<TimerBar timer={timer} />
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
				{/* fighter selection */}
				<div className="flex flex-col gap-2">
					<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
						Pick a side
					</p>
					<motion.div
						layoutId="active-match-slot"
						layout
						className="grid grid-cols-2 gap-8 flex-1 items-start"
						transition={{ type: "spring", stiffness: 280, damping: 28 }}
					>
						<ManokCard
							manok={fighter1}
							selected={selectedId === fighter1.id}
							onClick={() => handleSelect(fighter1.id)}
							disabled={isLocked}
						/>
						<ManokCard
							manok={fighter2}
							selected={selectedId === fighter2.id}
							onClick={() => handleSelect(fighter2.id)}
							disabled={isLocked}
						/>
					</motion.div>
				</div>

				{/* who's betting on who */}
				<div className="flex flex-col gap-2">
					<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
						Table
					</p>
					<div className="flex flex-col gap-1.5">
						{Object.values(sabong.players).map((sp) => {
							const roomPlayer = players.find((p) => p.id === sp.playerId);
							if (!roomPlayer) return null;
							const isMe = sp.playerId === playerId;
							const side =
								sp.currentBet?.manokId === fighter1.id
									? fighter1.name
									: sp.currentBet?.manokId === fighter2.id
										? fighter2.name
										: null;

							return (
								<div
									key={sp.playerId}
									className={cn(
										"flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
										sp.betLocked
											? "bg-green-500/10 border border-green-500/20 text-green-400"
											: "bg-white/3 border border-border text-white/50",
									)}
								>
									<span className="flex-1 truncate">
										{roomPlayer.name}
										{isMe && <span className="text-white/30 ml-1">(you)</span>}
									</span>
									{side ? (
										<span
											className={cn(
												"font-display font-bold uppercase",
												sp.betLocked ? "text-green-300" : "text-white/40",
											)}
										>
											{side}
											{sp.currentBet && (
												<span className="ml-1 font-normal text-[10px] opacity-70">
													₱{sp.currentBet.amount}
												</span>
											)}
										</span>
									) : (
										<span className="text-white/20">deciding...</span>
									)}
									{sp.betLocked && (
										<span className="text-green-400 text-[10px]">✓</span>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* amount slider */}
				<AnimatePresence>
					{selectedId && !isLocked && (
						<motion.div
							className="flex flex-col gap-4 p-4 rounded-2xl border border-border bg-surface-raised"
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 8 }}
							transition={{ duration: 0.2 }}
						>
							<div className="flex items-center justify-between">
								<span className="text-xs font-bold tracking-widest uppercase text-white/40">
									Bet Amount
								</span>
								<span className="font-display text-2xl font-black text-white tabular-nums">
									₱{amount}
								</span>
							</div>

							<input
								type="range"
								min={1}
								max={balance}
								value={amount}
								onChange={handleSlider}
								className="w-full accent-orange-400 cursor-pointer"
							/>

							<div className="flex justify-between text-[10px] text-white/25 font-semibold">
								<span>₱1</span>
								<span>Balance: ₱{balance}</span>
								<span>₱{balance}</span>
							</div>

							{/* quick picks */}
							<div className="flex gap-2">
								{[0.25, 0.5, 1].map((frac) => {
									const val = Math.max(1, Math.floor(balance * frac));
									return (
										<button
											key={frac}
											type="button"
											onClick={() => {
												setAmount(val);
												if (selectedId) {
													socket.emit("player_action", {
														type: "place_bet",
														manokId: selectedId,
														amount: val,
													});
												}
											}}
											className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-white/50 hover:text-white transition-all cursor-pointer"
										>
											{frac === 1 ? "ALL IN" : `${frac * 100}%`}
										</button>
									);
								})}
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* lock bar */}
			<div className="sticky bottom-0 border-t border-border bg-bg/95 backdrop-blur-md px-4 py-4">
				<AnimatePresence mode="wait">
					{isLocked ? (
						<motion.div
							key="locked"
							className="flex items-center justify-center gap-2 h-12 rounded-xl bg-white/5 text-white/40 text-sm font-semibold"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
						>
							✓ Bet locked - waiting for others
						</motion.div>
					) : (
						<motion.button
							key="lock"
							type="button"
							onClick={handleLock}
							disabled={!canLock}
							className={cn(
								"w-full h-12 rounded-xl text-sm font-bold tracking-widest uppercase transition-all duration-150",
								canLock
									? "bg-orange-500 text-white cursor-pointer hover:bg-orange-400 active:scale-[0.98]"
									: "bg-white/5 text-white/20 cursor-not-allowed",
							)}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
						>
							{selectedId ? `Lock Bet — ₱${amount}` : "Pick a Side First"}
						</motion.button>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

// host
export function BettingHost() {
	const { sabong, fighter1, fighter2, players, timer } = useSabongState();

	if (!sabong || !fighter1 || !fighter2) return null;

	const lockedCount = Object.values(sabong.players).filter(
		(p) => p.betLocked,
	).length;
	const totalPlayers = players.length;
	const matchLabel = `Match ${sabong.currentMatchIndex + 1} of 7`;

	return (
		<div className="flex flex-col min-h-screen bg-bg px-8 py-8 gap-8">
			<div className="flex items-end justify-between">
				<div className="flex flex-col gap-1">
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						{matchLabel}
					</span>
					<h1 className="font-display text-5xl font-black uppercase leading-none text-white">
						Place Your Bets
					</h1>
				</div>
				<div className="flex flex-col items-end gap-1">
					<span className="font-display text-4xl font-black tabular-nums text-white">
						{lockedCount}
						<span className="text-white/30">/{totalPlayers}</span>
					</span>
					<span className="text-xs uppercase tracking-widest text-white/30">
						locked
					</span>
				</div>
			</div>

			<TimerBar timer={timer} />

			{/* matchup */}
			<div className="grid grid-cols-2 gap-8 flex-1 items-start">
				<ManokCard manok={fighter1} corner="red" disabled />
				<ManokCard manok={fighter2} corner="blue" disabled />
			</div>

			{/* player bet status */}
			<div className="flex flex-col gap-2">
				<p className="text-[10px] font-bold tracking-widest uppercase text-white/30 mb-1">
					Bets
				</p>
				<div className="flex flex-wrap gap-2">
					{players.map((p) => {
						const sp = sabong.players[p.id];
						if (!sp) return null;
						const locked = sp.betLocked;
						const bet = sp.currentBet;
						const side =
							bet?.manokId === fighter1.id
								? fighter1.name
								: bet?.manokId === fighter2.id
									? fighter2.name
									: null;

						return (
							<div
								key={p.id}
								className={cn(
									"flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all duration-300",
									locked
										? "border-green-500/40 bg-green-500/10 text-green-400"
										: "border-border bg-white/3 text-white/40",
								)}
							>
								<span
									className={cn(
										"w-1.5 h-1.5 rounded-full shrink-0",
										locked ? "bg-green-400" : "bg-white/20",
									)}
								/>
								<span>{p.name}</span>
								{side && (
									<span
										className={cn(
											"font-display font-bold uppercase",
											locked ? "text-green-300" : "text-orange-300/60",
										)}
									>
										→ {side}
										{bet && (
											<span className="ml-1 font-normal opacity-70">
												₱{bet.amount}
											</span>
										)}
									</span>
								)}
								{!side && (
									<span className="text-white/20 text-xs">thinking...</span>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
