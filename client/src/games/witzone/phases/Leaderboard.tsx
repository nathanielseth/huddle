import { m } from "motion/react";
import type { WitzonePlayerView } from "@shared/games/witzone/index";
import { MEDALS } from "../constants";

type LeaderboardPlayer = WitzonePlayerView & { id: string; score: number };

export function Leaderboard({
	players,
	playerId,
	getName,
	delayBase = 0,
}: {
	players: LeaderboardPlayer[];
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