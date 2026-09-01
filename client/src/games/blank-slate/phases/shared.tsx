import { m } from "motion/react";
import { MEDALS } from "../constants";

export function Loading() {
	return (
		<div className="flex items-center justify-center min-h-screen text-white/40 text-sm">
			Loading...
		</div>
	);
}

interface LeaderboardEntry {
	id: string;
	score: number;
}

export function Leaderboard({
	players,
	playerId,
	getName,
	delayBase = 0,
}: {
	players: LeaderboardEntry[];
	playerId: string;
	getName: (id: string) => string;
	delayBase?: number;
}) {
	return (
		<>
			{players.map((p, rank) => {
				const isMe = p.id === playerId;
				return (
					<m.div
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
					</m.div>
				);
			})}
		</>
	);
}
