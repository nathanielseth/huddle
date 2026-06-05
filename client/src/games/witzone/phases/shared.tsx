import { motion } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";
import type { WitzonePlayerView } from "@shared/witzone";
import { MEDALS } from "../constants";

export function Loading() {
	return (
		<div className="flex items-center justify-center min-h-screen text-white/40 text-sm">
			Loading...
		</div>
	);
}

// shared waiting screen — answering phases use hasAnswered, voting phases use hasVoted
export function WaitingView({
	message,
	dotField = "hasAnswered",
}: {
	message: string;
	dotField?: "hasAnswered" | "hasVoted";
}) {
	const { state } = useWitzoneState();
	if (!state) return null;

	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6">
			<motion.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 20 }}
				className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl"
			>
				✓
			</motion.div>
			<motion.p
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
				className="text-white/60 text-sm"
			>
				{message}
			</motion.p>
			<div className="flex gap-2 flex-wrap justify-center">
				{Object.values(state.players).map((p) => (
					<div
						key={p.id}
						className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
							p[dotField] ? "bg-white/80" : "bg-white/20"
						}`}
					/>
				))}
			</div>
		</div>
	);
}

// shared leaderboard rows — used by RoundEnd + Finished
export function Leaderboard({
	players,
	playerId,
	getName,
	delayBase = 0,
}: {
	players: WitzonePlayerView[];
	playerId: string;
	getName: (id: string) => string;
	delayBase?: number;
}) {
	return (
		<>
			{players.map((p, rank) => {
				const isMe = p.id === playerId;
				return (
					<motion.div
						key={p.id}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: delayBase + rank * 0.07 }}
						className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${
							isMe ? "border-white/30 bg-white/5" : "border-border bg-surface"
						}`}
					>
						<span className="text-lg w-6 text-center">
							{MEDALS[rank] ?? `${rank + 1}`}
						</span>
						<span
							className={`flex-1 text-sm ${isMe ? "text-white font-medium" : "text-white/70"}`}
						>
							{isMe ? "You" : getName(p.id)}
						</span>
						<span className="text-white font-semibold text-sm tabular-nums">
							{p.score.toLocaleString()}
						</span>
					</motion.div>
				);
			})}
		</>
	);
}