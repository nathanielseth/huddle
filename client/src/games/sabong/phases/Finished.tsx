import { motion } from "motion/react";
import { useGameStore } from "../../../app/store";
import { useSabongState } from "../hooks/useSabongState";
import { cn } from "../../../lib/utils/cn";

function getRankSuffix(rank: number): string {
	if (rank === 1) return "st";
	if (rank === 2) return "nd";
	if (rank === 3) return "rd";
	return "th";
}

// shared leaderboard
function Leaderboard({ compact = false }: { compact?: boolean }) {
	const storePlayers = useGameStore((s) => s.players);
	const { sabong } = useSabongState();

	if (!sabong) return null;

	const finalSlot = sabong.bracket[6];
	const tournamentWinnerId = finalSlot?.winnerId ?? null;
	const winnerManok = tournamentWinnerId
		? sabong.manoks[tournamentWinnerId]
		: null;

	const ranked = [...storePlayers].sort((a, b) => {
		const balA = sabong.players[a.id]?.balance ?? 0;
		const balB = sabong.players[b.id]?.balance ?? 0;
		return balB - balA;
	});

	return (
		<div className="flex flex-col gap-2">
			{ranked.map((player, i) => {
				const rank = i + 1;
				const isFirst = rank === 1;
				const sabongP = sabong.players[player.id];
				const balance = sabongP?.balance ?? 0;
				const pickedWinner =
					tournamentWinnerId && sabongP?.bracketPickId === tournamentWinnerId;

				return (
					<motion.div
						key={player.id}
						className={cn(
							"flex items-center gap-3 px-4 py-3 rounded-2xl border",
							isFirst
								? "border-yellow-400/40 bg-yellow-500/8"
								: "border-border bg-surface-raised",
							compact ? "px-3 py-2" : "px-4 py-3",
						)}
						initial={{ opacity: 0, x: -16 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: i * 0.07, duration: 0.25 }}
					>
						<span
							className={cn(
								"font-display font-black tabular-nums leading-none shrink-0",
								compact ? "text-xl w-6" : "text-2xl w-8",
								isFirst ? "text-yellow-400" : "text-white/20",
							)}
						>
							{rank}
							<span className="text-[0.4em] align-super">
								{getRankSuffix(rank)}
							</span>
						</span>

						<div className="flex flex-col flex-1 min-w-0">
							<span
								className={cn(
									"font-semibold truncate",
									compact ? "text-sm" : "text-base",
									isFirst ? "text-white" : "text-white/80",
								)}
							>
								{player.name}
							</span>
							{pickedWinner && winnerManok && (
								<span className="text-[10px] font-bold tracking-widest uppercase text-yellow-400/70">
									★ Picked {winnerManok.name} +₱{150}
								</span>
							)}
						</div>

						<span
							className={cn(
								"font-display font-black tabular-nums shrink-0",
								compact ? "text-xl" : "text-2xl",
								isFirst ? "text-yellow-400" : "text-white/60",
							)}
						>
							₱{balance}
						</span>
					</motion.div>
				);
			})}
		</div>
	);
}

// tournament winner callout
function WinnerCallout() {
	const { sabong } = useSabongState();
	if (!sabong) return null;

	const finalSlot = sabong.bracket[6];
	const tournamentWinnerId = finalSlot?.winnerId ?? null;
	const winnerManok = tournamentWinnerId
		? sabong.manoks[tournamentWinnerId]
		: null;

	if (!winnerManok) return null;

	return (
		<motion.div
			className="flex flex-col items-center gap-1 text-center"
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.35 }}
		>
			<span className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/30">
				Tournament Champion
			</span>
			<span className="font-display text-5xl font-black uppercase text-white leading-none">
				{winnerManok.name}
			</span>
			<span className="text-xs text-white/30 mt-1">
				Bracket pickers get +₱150
			</span>
		</motion.div>
	);
}

// player end screen
export function FinishedPlayer() {
	const { sabong, myPlayer } = useSabongState();
	const storePlayers = useGameStore((s) => s.players);

	if (!sabong || !myPlayer) return null;

	const finalSlot = sabong.bracket[6];
	const tournamentWinnerId = finalSlot?.winnerId ?? null;
	const pickedWinner =
		tournamentWinnerId && myPlayer.bracketPickId === tournamentWinnerId;

	const myRank =
		[...storePlayers]
			.sort((a, b) => {
				const balA = sabong.players[a.id]?.balance ?? 0;
				const balB = sabong.players[b.id]?.balance ?? 0;
				return balB - balA;
			})
			.findIndex((p) => sabong.players[p.id]?.playerId === myPlayer.playerId) +
		1;

	return (
		<div className="flex flex-col min-h-screen bg-bg">
			<div className="flex flex-col gap-4 px-5 pt-8 pb-5 border-b border-border items-center text-center">
				<motion.div
					className="flex flex-col gap-1"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
				>
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						Super Sabong — Final Results
					</span>
					<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
						Tournament Over!
					</h1>
				</motion.div>

				{/* personal result */}
				<motion.div
					className={cn(
						"flex flex-col items-center gap-0.5 px-8 py-4 rounded-2xl border w-full",
						myRank === 1
							? "border-yellow-400/40 bg-yellow-500/8"
							: "border-border bg-surface-raised",
					)}
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: 0.15 }}
				>
					<span className="font-display text-5xl font-black text-white tabular-nums">
						{myRank}
						<span className="text-2xl align-super">
							{getRankSuffix(myRank)}
						</span>
					</span>
					<span className="text-xs text-white/40">place</span>
					<span className="font-display text-2xl font-black text-white tabular-nums mt-1">
						₱{myPlayer.balance}
					</span>
					{pickedWinner && (
						<span className="text-xs font-bold text-yellow-400 mt-1">
							★ Bracket pick correct! +₱150
						</span>
					)}
				</motion.div>
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-6">
				<WinnerCallout />

				<div className="flex flex-col gap-2">
					<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
						Final Standings
					</p>
					<Leaderboard compact />
				</div>
			</div>

			<div className="px-4 py-4 border-t border-border">
				<p className="text-center text-xs text-white/25">
					Waiting for host to end the session
				</p>
			</div>
		</div>
	);
}

// host end screen
export function FinishedHost() {
	const { sabong } = useSabongState();
	const role = useGameStore((s) => s.role);
	const leaveRoom = useGameStore((s) => s.leaveRoom);

	if (!sabong) return null;

	return (
		<div className="flex flex-col min-h-screen bg-bg px-8 py-8 gap-8">
			{/* header */}
			<motion.div
				className="flex items-end justify-between"
				initial={{ opacity: 0, y: 12 }}
				animate={{ opacity: 1, y: 0 }}
			>
				<div className="flex flex-col gap-1">
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						Super Sabong — Final Results
					</span>
					<h1 className="font-display text-6xl font-black uppercase leading-none text-white">
						Tournament Over!
					</h1>
				</div>

				{role === "host" && (
					<button
						type="button"
						onClick={leaveRoom}
						className="shrink-0 h-11 px-8 rounded-xl border border-border text-sm font-bold tracking-widest uppercase text-white/40 hover:text-white hover:border-white/30 transition-all cursor-pointer"
					>
						End Session
					</button>
				)}
			</motion.div>

			<WinnerCallout />

			{/* full leaderboard */}
			<div className="flex flex-col gap-3 flex-1">
				<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
					Final Standings
				</p>
				<Leaderboard />
			</div>
		</div>
	);
}
