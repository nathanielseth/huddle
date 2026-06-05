import { motion } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";
import { Leaderboard } from "./shared";

export function Finished() {
	const { state, playerId, getName } = useWitzoneState();
	if (!state) return null;

	const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
	const winner = sorted[0];
	const iWon = winner?.id === playerId;

	return (
		<div className="flex flex-col items-center min-h-screen px-6 py-14 gap-10">
			<motion.div
				initial={{ opacity: 0, scale: 0.92 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 20 }}
				className="text-center"
			>
				<p className="text-5xl mb-4">{iWon ? "🎉" : "🏆"}</p>
				<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
					Game over
				</p>
				<h2 className="text-3xl font-display font-bold text-white">
					{iWon ? "You win!" : `${getName(winner?.id ?? "")} wins!`}
				</h2>
				{winner && (
					<p className="text-white/40 text-sm mt-1">
						{winner.score.toLocaleString()} points
					</p>
				)}
			</motion.div>

			{state.finalReveal && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.2 }}
					className="w-full max-w-sm"
				>
					<p className="text-xs uppercase tracking-widest text-white/40 mb-3">
						Final prompt
					</p>
					<div className="bg-surface border border-border rounded-2xl px-6 py-4 mb-3">
						<p className="text-white font-medium">
							{state.finalReveal.promptText}
						</p>
					</div>

					<div className="flex flex-col gap-2">
						{state.finalReveal.answers.map((answer, rank) => {
							const isMe = answer.authorId === playerId;
							return (
								<motion.div
									key={answer.id}
									initial={{ opacity: 0, x: -8 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.3 + rank * 0.08 }}
									className={`flex items-start gap-3 px-5 py-4 rounded-xl border ${
										isMe
											? "border-white/30 bg-white/5"
											: "border-border bg-surface"
									}`}
								>
									<div className="flex-1 min-w-0">
										<p
											className={`text-sm font-medium ${isMe ? "text-white" : "text-white/80"}`}
										>
											{answer.text}
										</p>
										<p className="text-white/40 text-xs mt-0.5">
											{isMe ? "You" : getName(answer.authorId)}
											{" · "}
											{answer.tokenCount} token
											{answer.tokenCount !== 1 ? "s" : ""}
										</p>
									</div>
									{answer.scoreDelta > 0 && (
										<span className="text-green-400 text-sm font-bold tabular-nums shrink-0">
											+{answer.scoreDelta}
										</span>
									)}
								</motion.div>
							);
						})}
					</div>
				</motion.div>
			)}

			<div className="w-full max-w-sm flex flex-col gap-2">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-1">
					Final scores
				</p>
				<Leaderboard
					players={sorted}
					playerId={playerId}
					getName={getName}
					delayBase={0.5}
				/>
			</div>
		</div>
	);
}