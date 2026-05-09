import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSabongState } from "../hooks/useSabongState";
import { ManokCard } from "../components/ManokCard";
import { TimerBar } from "../components/TimerBar";
import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";

// player view (phone)
export function PreTournamentPlayer() {
	const { sabong, myPlayer, manokList, players, timer } = useSabongState();
	const [mode, setMode] = useState<"pick" | "sabotage">("pick");

	if (!sabong || !myPlayer) return null;

	const isLocked = myPlayer.bracketPickLocked;
	const pickId = myPlayer.bracketPickId;
	const sabotageId = myPlayer.sabotageTargetId;
	const canLock = !!pickId && !isLocked;

	const lockedCount = Object.values(sabong.players).filter(
		(p) => p.bracketPickLocked,
	).length;

	function handleCardTap(manokId: string) {
		if (isLocked) return;
		if (mode === "pick") {
			socket.emit("player_action", { type: "pick_bracket_winner", manokId });
		} else {
			const next = sabotageId === manokId ? null : manokId;
			socket.emit("player_action", {
				type: "sabotage_manok",
				manokId: next ?? manokId,
			});
			if (sabotageId === manokId) {
				setMode("pick");
			}
		}
	}

	function handleLock() {
		if (!canLock) return;
		socket.emit("player_action", { type: "lock_bracket_pick" });
	}

	return (
		<div className="flex flex-col min-h-screen bg-bg">
			{/* header */}
			<div className="flex flex-col gap-3 px-5 pt-6 pb-4 border-b border-border">
				<div className="flex items-center justify-between">
					<span className="font-display text-xs font-bold tracking-[0.25em] uppercase text-white/40">
						Super Sabong
					</span>
					<span className="text-xs text-white/30">
						{lockedCount}/{players.length} locked
					</span>
				</div>
				<h1 className="font-display text-3xl font-black uppercase leading-none text-white">
					Study the Bracket
				</h1>
				<TimerBar timer={timer} />
			</div>

			{/* mode toggle */}
			{!isLocked && (
				<div className="px-4 pt-4">
					<div className="flex rounded-xl overflow-hidden border border-border bg-surface-raised p-1 gap-1">
						<button
							type="button"
							onClick={() => setMode("pick")}
							className={cn(
								"flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all duration-150",
								mode === "pick"
									? "bg-orange-500 text-white"
									: "text-white/40 hover:text-white/70",
							)}
						>
							🏆 Pick Champion
						</button>
						<button
							type="button"
							onClick={() => setMode("sabotage")}
							className={cn(
								"flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all duration-150",
								mode === "sabotage"
									? "bg-red-600 text-white"
									: "text-white/40 hover:text-white/70",
							)}
						>
							💀 Sabotage
						</button>
					</div>

					{/* contextual hint */}
					<AnimatePresence mode="wait">
						<motion.p
							key={mode}
							className="text-[10px] text-center text-white/30 mt-2"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
						>
							{mode === "pick"
								? "Tap a manok to pick your tournament champion"
								: "Tap a manok to secretly debuff it — no one else will know"}
						</motion.p>
					</AnimatePresence>
				</div>
			)}

			{/* status pills */}
			<div className="flex items-center gap-2 px-4 pt-3">
				{pickId && (
					<span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-bold text-orange-400 uppercase tracking-widest">
						🏆 {manokList.find((m) => m.id === pickId)?.name ?? "picked"}
					</span>
				)}
				{sabotageId && (
					<span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-900/40 text-[10px] font-bold text-red-400 uppercase tracking-widest">
						💀 {manokList.find((m) => m.id === sabotageId)?.name ?? "target"}
					</span>
				)}
			</div>

			{/* manok grid */}
			<div className="flex-1 overflow-y-auto px-4 py-4">
				<div className="grid grid-cols-2 gap-3">
					{manokList.map((manok) => {
						const isPickSelected = mode === "pick" && pickId === manok.id;
						const isSabotageSelected =
							mode === "sabotage" && sabotageId === manok.id;

						return (
							<motion.div
								key={manok.id}
								layout
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.2 }}
							>
								<ManokCard
									manok={manok}
									selected={isPickSelected || isSabotageSelected}
									onClick={() => handleCardTap(manok.id)}
									disabled={isLocked}
									sabotaged={sabotageId === manok.id}
								/>
							</motion.div>
						);
					})}
				</div>
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
							✓ Locked in - waiting for others
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
							{pickId ? "Lock In Pick →" : "Select a Champion First"}
						</motion.button>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

// host view (tv display)
export function PreTournamentHost() {
	const { sabong, players, timer } = useSabongState();

	if (!sabong) return null;

	const lockedCount = Object.values(sabong.players).filter(
		(p) => p.bracketPickLocked,
	).length;
	const totalPlayers = players.length;
	const allLocked = lockedCount === totalPlayers && totalPlayers > 0;

	// qf matchups only (slots 0–3)
	const qfSlots = sabong.bracket.slice(0, 4);

	return (
		<div className="flex flex-col min-h-screen bg-bg px-8 py-8 gap-8">
			{/* header */}
			<div className="flex items-end justify-between">
				<div className="flex flex-col gap-1">
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						Super Sabong
					</span>
					<h1 className="font-display text-5xl font-black uppercase leading-none text-white">
						Study the Bracket
					</h1>
					<p className="text-white/40 text-sm mt-1">
						Players - pick your tournament champion on your phone
					</p>
				</div>
				<div className="flex flex-col items-end gap-2">
					<span className="font-display text-4xl font-black tabular-nums text-white">
						{lockedCount}
						<span className="text-white/30">/{totalPlayers}</span>
					</span>
					<span className="text-xs uppercase tracking-widest text-white/30">
						{allLocked ? "All locked!" : "locked in"}
					</span>
				</div>
			</div>

			<TimerBar timer={timer} />

			{/* qf matchup grid */}
			<div className="grid grid-cols-2 gap-6 flex-1">
				{qfSlots.map((slot) => {
					const f1 = slot.fighter1Id ? sabong.manoks[slot.fighter1Id] : null;
					const f2 = slot.fighter2Id ? sabong.manoks[slot.fighter2Id] : null;
					if (!f1 || !f2) return null;
					return (
						<div key={slot.matchIndex} className="flex flex-col gap-2">
							<span className="text-[10px] font-bold tracking-[0.25em] uppercase text-white/30">
								Match {slot.matchIndex + 1}
							</span>
							<div className="flex flex-col gap-2">
								<ManokCard manok={f1} />
								<div className="flex items-center justify-center">
									<span className="font-display text-xs font-bold tracking-widest uppercase text-white/20">
										vs
									</span>
								</div>
								<ManokCard manok={f2} />
							</div>
						</div>
					);
				})}
			</div>

			{/* player lock status */}
			<div className="flex flex-wrap gap-2">
				{players.map((p) => {
					const sabongPlayer = sabong.players[p.id];
					const locked = sabongPlayer?.bracketPickLocked ?? false;
					return (
						<div
							key={p.id}
							className={cn(
								"flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-300",
								locked
									? "border-green-500/40 bg-green-500/10 text-green-400"
									: "border-border bg-white/3 text-white/40",
							)}
						>
							<span
								className={cn(
									"w-1.5 h-1.5 rounded-full",
									locked ? "bg-green-400" : "bg-white/20",
								)}
							/>
							{p.name}
						</div>
					);
				})}
			</div>
		</div>
	);
}
