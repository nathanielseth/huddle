import { m } from "motion/react";
import { useBlankSlateState } from "../hooks/useBlankSlateState";
import { Loading } from "./shared";
import { roundLabel } from "../constants";

export function Result() {
	const { state, playerId, getName } = useBlankSlateState();
	if (!state) return <Loading />;

	const result = state.lastResult;
	if (!result) return <Loading />;

	const guesserName = getName(result.guesserPlayerId);
	const iAmGuesser = result.guesserPlayerId === playerId;
	const outcomeLabel = result.correct
		? "Guessed correctly!"
		: result.guess === null
			? "Skipped"
			: "Missed";

	return (
		<div className="flex flex-col items-center min-h-screen px-6 py-12 gap-8">
			<m.div
				initial={{ opacity: 0, y: -6 }}
				animate={{ opacity: 1, y: 0 }}
				className="text-center"
			>
				<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
					{roundLabel(state.roundNumber, state.totalRounds)}
				</p>
				<p className="text-5xl mb-3">{result.correct ? "✅" : "❌"}</p>
				<h1 className="text-3xl font-display font-bold text-white">
					{outcomeLabel}
				</h1>
				<p className="text-white/40 text-sm mt-1">
					{iAmGuesser ? "You" : guesserName} were guessing
				</p>
			</m.div>

			<m.div
				initial={{ opacity: 0, scale: 0.94 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ delay: 0.1 }}
				className="text-center"
			>
				<p className="text-xs uppercase tracking-widest text-white/40 mb-1">
					Secret word
				</p>
				<p className="text-huddle text-3xl font-display font-bold tracking-wide">
					{result.secretWord}
				</p>
				{result.guess !== null && (
					<p className="text-white/50 text-sm mt-2">
						Guessed: <span className="text-white font-medium">{result.guess}</span>
					</p>
				)}
			</m.div>

			<div className="w-full max-w-sm">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-3 text-center">
					All clues
				</p>
				<div className="flex flex-col gap-2">
					{result.clueEntries.map((clue, i) => (
						<m.div
							key={clue.playerId}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: 0.2 + i * 0.06 }}
							className={`flex items-center justify-between gap-3 px-5 py-3 rounded-xl border ${
								clue.eliminated
									? "border-border bg-surface opacity-50"
									: "border-white/30 bg-white/5"
							}`}
						>
							<span
								className={`text-base font-medium ${
									clue.eliminated ? "text-white/40 line-through" : "text-white"
								}`}
							>
								{clue.text}
							</span>
							<span className="text-white/40 text-xs shrink-0">
								{getName(clue.playerId)}
								{clue.eliminated ? " · duplicate" : ""}
							</span>
						</m.div>
					))}
				</div>
			</div>

			{Object.keys(result.scoreDeltas).length > 0 && (
				<m.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.4 }}
					className="flex gap-2 flex-wrap justify-center"
				>
					{Object.entries(result.scoreDeltas).map(([id, delta]) => (
						<span
							key={id}
							className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-border text-white/60"
						>
							{getName(id)}{" "}
							<span className="text-green-400 font-semibold">+{delta}</span>
						</span>
					))}
				</m.div>
			)}
		</div>
	);
}
