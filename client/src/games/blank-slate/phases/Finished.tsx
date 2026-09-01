import { m } from "motion/react";
import { useBlankSlateState } from "../hooks/useBlankSlateState";
import { Leaderboard, Loading } from "./shared";

export function Finished() {
	const { state, playerId, getName } = useBlankSlateState();
	if (!state) return <Loading />;

	const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
	const winner = sorted[0];
	const iWon = winner?.playerId === playerId;

	return (
		<div className="flex flex-col items-center min-h-screen px-6 py-14 gap-10">
			<m.div
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
					{iWon ? "You win!" : `${getName(winner?.playerId ?? "")} wins!`}
				</h2>
				{winner && (
					<p className="text-white/40 text-sm mt-1">
						{winner.score.toLocaleString()} points
					</p>
				)}
			</m.div>

			<div className="w-full max-w-sm flex flex-col gap-2">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-1">
					Final scores
				</p>
				<Leaderboard
					players={sorted.map((p) => ({ id: p.playerId, score: p.score }))}
					playerId={playerId}
					getName={getName}
					delayBase={0.2}
				/>
			</div>
		</div>
	);
}
