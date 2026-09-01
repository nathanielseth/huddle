import { m } from "motion/react";
import { useBelievableLiesState } from "../hooks/useBelievableLiesState";

export function RoundEnd() {
	const { state, playerId, getName } = useBelievableLiesState();

	if (!state) return null;

	const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
	const nextRound = (state.roundNumber as number) + 1;
	const isFinalRound = state.roundNumber >= 3;

	return (
		<div className="bl-screen">
			{/* Header */}
			<div style={{ textAlign: "center", marginBottom: 24 }}>
				<m.span
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
					className="bl-pill bl-pill-yellow"
					style={{ display: "inline-block", marginBottom: 10 }}
				>
					Round {state.roundNumber} complete
				</m.span>

				<m.h2
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.08 }}
					className="bl-title"
				>
					{isFinalRound
						? "Final results incoming…"
						: `Round ${nextRound} up next`}
				</m.h2>

				{nextRound === 3 && !isFinalRound && (
					<m.p
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.2 }}
						className="bl-muted"
						style={{ marginTop: 6, color: "var(--bl-pink)" }}
					>
						Final round — points tripled 👀
					</m.p>
				)}
			</div>

			{/* Leaderboard */}
			<div>
				{sorted.map((p, rank) => {
					const isMe = p.playerId === playerId;

					const rowClass = [
						"bl-lb-row",
						rank === 0
							? "bl-lb-gold"
							: rank === 1
								? "bl-lb-silver"
								: rank === 2
									? "bl-lb-bronze"
									: "bl-lb-plain",
					].join(" ");

					const MEDALS = ["🥇", "🥈", "🥉"];

					return (
						<m.div
							key={p.playerId}
							initial={{ opacity: 0, x: -12 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.15 + rank * 0.07 }}
							className={rowClass}
						>
							<span className="bl-lb-rank">
								{MEDALS[rank] ?? `${rank + 1}`}
							</span>
							<div style={{ flex: 1, minWidth: 0 }}>
								<div className="bl-lb-name">
									{isMe ? "You" : getName(p.playerId)}
								</div>
							</div>
							<span className="bl-lb-score">{p.score.toLocaleString()}</span>
						</m.div>
					);
				})}
			</div>
		</div>
	);
}