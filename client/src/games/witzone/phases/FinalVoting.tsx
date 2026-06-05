import { useState } from "react";
import { motion } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { Loading, WaitingView } from "./shared";
import { FINAL_VOTE_TOKENS } from "../constants";

function HostView() {
	const { state, timer, getName } = useWitzoneState();
	if (!state?.finalAnswers) return null;

	return (
		<div className="flex flex-col min-h-screen px-10 py-10 gap-8">
			<TimerBar timer={timer} />

			<div className="flex items-end justify-between mt-2">
				<div>
					<p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-1">
						Final Round
					</p>
					<h1 className="text-4xl font-display font-bold text-white">Voting</h1>
				</div>
				<p className="text-white/40 text-lg tabular-nums">
					{state.finalVotedCount}/{state.totalPlayers} voted
				</p>
			</div>

			<div className="flex flex-col gap-3">
				{state.finalAnswers.map((answer, i) => (
					<div
						key={answer.id}
						className="bg-surface border border-border rounded-2xl px-8 py-5"
					>
						<p className="text-xs uppercase tracking-widest text-white/30 mb-2">
							Answer {i + 1}
						</p>
						<p className="text-white text-2xl font-medium">{answer.text}</p>
					</div>
				))}
			</div>

			<div className="flex flex-wrap gap-3">
				{Object.values(state.players).map((p) => (
					<div
						key={p.id}
						className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all duration-300 ${
							p.hasVoted
								? "bg-white/10 text-white/80"
								: "bg-surface border border-border text-white/30"
						}`}
					>
						<span
							className={`w-1.5 h-1.5 rounded-full ${p.hasVoted ? "bg-white/80" : "bg-white/20"}`}
						/>
						{getName(p.id)}
					</div>
				))}
			</div>
		</div>
	);
}

export function FinalVoting() {
	const { state, secret, role, playerId, timer, sendAction } =
		useWitzoneState();
	const [allocation, setAllocation] = useState<Record<string, number>>({});
	const [submitted, setSubmitted] = useState(false);

	if (!state) return null;
	if (role === "host") return <HostView />;
	if (!secret || !state.finalAnswers) return <Loading />;

	const hasVoted = state.players[playerId]?.hasVoted ?? false;
	if (hasVoted || submitted) {
		return (
			<WaitingView
				message="Votes cast. Waiting for everyone..."
				dotField="hasVoted"
			/>
		);
	}

	const myAnswerId = secret.finalAnswerId;
	const usedTokens = Object.values(allocation).reduce((a, b) => a + b, 0);
	const remaining = FINAL_VOTE_TOKENS - usedTokens;

	function add(answerId: string) {
		if (answerId === myAnswerId || remaining <= 0) return;
		setAllocation((prev) => ({
			...prev,
			[answerId]: (prev[answerId] ?? 0) + 1,
		}));
	}

	function remove(answerId: string) {
		setAllocation((prev) => ({
			...prev,
			[answerId]: Math.max(0, (prev[answerId] ?? 0) - 1),
		}));
	}

	function handleSubmit() {
		if (remaining !== 0) return;
		const votes = Object.fromEntries(
			Object.entries(allocation).filter(([, v]) => v > 0),
		);
		setSubmitted(true);
		sendAction({ type: "cast_final_votes", votes });
	}

	return (
		<div className="flex flex-col min-h-screen px-6 py-10">
			<TimerBar timer={timer} />

			<div className="flex items-center justify-between mt-4 mb-8">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					Final Round — Vote
				</div>
				<div className="text-xs text-white/40">
					{state.finalVotedCount}/{state.totalPlayers} voted
				</div>
			</div>

			{/* token counter */}
			<div className="flex items-center justify-center gap-2 mb-6">
				{Array.from({ length: FINAL_VOTE_TOKENS }).map((_, i) => (
					<div
						key={i}
						className={`w-4 h-4 rounded-full transition-colors duration-200 ${i < usedTokens ? "bg-white" : "bg-white/20"}`}
					/>
				))}
				<span className="ml-2 text-white/40 text-xs tabular-nums">
					{remaining} token{remaining !== 1 ? "s" : ""} left
				</span>
			</div>

			<div className="flex flex-col gap-3 flex-1">
				{state.finalAnswers.map((answer, i) => {
					const isOwn = answer.id === myAnswerId;
					const tokens = allocation[answer.id] ?? 0;

					return (
						<motion.div
							key={answer.id}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: i * 0.07 }}
							className={`rounded-2xl border px-5 py-4 border-border bg-surface ${isOwn ? "opacity-40" : ""}`}
						>
							<div className="flex items-center gap-4">
								<p className="flex-1 text-white font-medium text-base">
									{answer.text}
								</p>

								{isOwn ? (
									<span className="text-xs text-white/30 shrink-0">
										your answer
									</span>
								) : (
									<div className="flex items-center gap-2 shrink-0">
										<button
											onClick={() => remove(answer.id)}
											disabled={tokens === 0}
											className="w-8 h-8 rounded-lg border border-border bg-bg text-white/60 text-lg font-bold disabled:opacity-20 disabled:cursor-not-allowed hover:border-white/30 transition-all active:scale-[0.93]"
										>
											−
										</button>
										<span className="w-6 text-center text-white font-semibold tabular-nums text-base">
											{tokens}
										</span>
										<button
											onClick={() => add(answer.id)}
											disabled={remaining <= 0}
											className="w-8 h-8 rounded-lg border border-border bg-bg text-white/60 text-lg font-bold disabled:opacity-20 disabled:cursor-not-allowed hover:border-white/30 transition-all active:scale-[0.93]"
										>
											+
										</button>
									</div>
								)}
							</div>
						</motion.div>
					);
				})}
			</div>

			<div className="pt-6">
				<button
					onClick={handleSubmit}
					disabled={remaining !== 0}
					className="w-full py-4 rounded-2xl bg-white text-black font-semibold text-base disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
				>
					{remaining === 0
						? "Submit votes"
						: `Use all ${FINAL_VOTE_TOKENS} tokens first`}
				</button>
			</div>
		</div>
	);
}