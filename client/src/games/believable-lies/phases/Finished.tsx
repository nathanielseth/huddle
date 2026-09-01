import { m } from "motion/react";
import { useBelievableLiesState } from "../hooks/useBelievableLiesState";

const MEDALS = ["🥇", "🥈", "🥉"];

export function Finished() {
	const { state, playerId, getName } = useBelievableLiesState();

	if (!state) return null;

	const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
	const winner = sorted[0];
	const iWon = winner?.playerId === playerId;

	return (
		<div className="bl-screen" style={{ alignItems: "center", paddingTop: 48 }}>
			{/* Winner callout */}
			<m.div
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 20 }}
				style={{ textAlign: "center", marginBottom: 32 }}
			>
				<div className="bl-winner-emoji">{iWon ? "🎉" : "🏆"}</div>

				<m.div
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.15 }}
				>
					<div
						className="bl-eyebrow"
						style={{ marginBottom: 6, marginTop: 16 }}
					>
						Game over
					</div>
					<h2 className="bl-winner-name">
						{iWon ? "You win!" : `${getName(winner?.playerId ?? "")} wins!`}
					</h2>
					{winner && (
						<p className="bl-winner-score">
							{winner.score.toLocaleString()} points
						</p>
					)}
				</m.div>
			</m.div>

			{/* Final leaderboard */}
			<div style={{ width: "100%" }}>
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

					return (
						<m.div
							key={p.playerId}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.25 + rank * 0.07 }}
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