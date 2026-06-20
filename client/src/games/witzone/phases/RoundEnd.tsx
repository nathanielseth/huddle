import { m } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";
import { Leaderboard } from "./shared";

export function RoundEnd() {
	const { state, playerId, getName } = useWitzoneState();
	if (!state) return null;

	const sorted = Object.values(state.players).sort((a, b) => b.score - a.score);
	const toFinal = state.round === 2;

	return (
		<div className="flex flex-col items-center min-h-screen px-6 py-14 gap-10">
			<div className="text-center">
				<m.p
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
					className="text-xs uppercase tracking-widest text-white/40 mb-2"
				>
					Round {state.round} complete
				</m.p>
				<m.h2
					initial={{ opacity: 0, y: -6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.07 }}
					className="text-3xl font-display font-bold text-white"
				>
					{toFinal ? "Final Round up next!" : "Round 2 up next!"}
				</m.h2>
				<m.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.18 }}
					className="text-white/40 text-sm mt-2"
				>
					{toFinal
						? "One shared prompt. All players. 3 tokens to spend."
						: "Everything doubled. Same rules, higher stakes."}
				</m.p>
			</div>

			<div className="w-full max-w-sm flex flex-col gap-2">
				<Leaderboard
					players={sorted}
					playerId={playerId}
					getName={getName}
					delayBase={0.15}
				/>
			</div>
		</div>
	);
}