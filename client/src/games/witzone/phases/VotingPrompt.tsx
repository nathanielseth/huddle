import { motion } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { Loading } from "./shared";
import { roundLabel } from "../constants";

function RevealView() {
	const { state, playerId, getName } = useWitzoneState();
	if (!state?.lastReveal) return null;

	const { promptText, answers, wasJinx, wasDefault, wittyWinnerId } =
		state.lastReveal;
	const label = `${roundLabel(state.round)} · ${state.currentPromptIndex + 1} of ${state.totalPromptsThisRound}`;

	return (
		<div className="flex flex-col min-h-screen px-6 py-10 gap-6">
			<div className="flex items-center justify-between">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					{label}
				</div>
				{wasJinx && (
					<span className="text-xs font-bold tracking-widest uppercase text-yellow-400">
						JINX!
					</span>
				)}
				{wittyWinnerId && (
					<span className="text-xs font-bold tracking-widest uppercase text-purple-400">
						WITTY! ✨
					</span>
				)}
			</div>

			<div className="bg-surface border border-border rounded-2xl px-6 py-5">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
					The prompt
				</p>
				<p className="text-white text-xl font-medium leading-relaxed">
					{promptText}
				</p>
			</div>

			{wasJinx && (
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-6 py-4 text-center"
				>
					<p className="text-yellow-400 font-bold text-lg">JINX!</p>
					<p className="text-white/60 text-sm mt-1">
						Both players wrote the same thing. No points for anyone.
					</p>
				</motion.div>
			)}

			{wasDefault && !wasJinx && (
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-6 py-4 text-center"
				>
					<p className="text-orange-400 font-bold">No answer submitted</p>
					<p className="text-white/60 text-sm mt-1">
						Default bonus to the player who showed up.
					</p>
				</motion.div>
			)}

			<div className="flex flex-col gap-3">
				{answers.map((answer, i) => {
					const isMe = answer.authorId === playerId;
					const isWinner = wittyWinnerId === answer.authorId;

					return (
						<motion.div
							key={answer.id}
							initial={{ opacity: 0, x: -8 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.1 }}
							className={`rounded-2xl border px-6 py-4 ${isWinner ? "border-purple-500/40 bg-purple-500/10" : "border-border bg-surface"}`}
						>
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1 min-w-0">
									{answer.text !== null ? (
										<p className="text-white font-medium text-base">
											{answer.text}
										</p>
									) : (
										<p className="text-white/30 italic text-base">
											No answer submitted
										</p>
									)}
									<p className="text-white/40 text-xs mt-1">
										{isMe ? "You" : getName(answer.authorId)}
									</p>
								</div>

								<div className="flex flex-col items-end gap-1 shrink-0">
									{!wasJinx && !wasDefault && (
										<span className="text-white/50 text-xs tabular-nums">
											{answer.voteCount}{" "}
											{answer.voteCount === 1 ? "vote" : "votes"}
										</span>
									)}
									{answer.scoreDelta > 0 && (
										<span className="text-green-400 text-sm font-bold tabular-nums">
											+{answer.scoreDelta}
										</span>
									)}
									{answer.scoreDelta === 0 && !wasJinx && (
										<span className="text-white/30 text-sm tabular-nums">
											–
										</span>
									)}
								</div>
							</div>
						</motion.div>
					);
				})}
			</div>

			{wittyWinnerId && (
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.4 }}
					className="text-center text-purple-300 text-sm font-medium"
				>
					{wittyWinnerId === playerId ? "You" : getName(wittyWinnerId)} got
					every single vote! ✨
				</motion.p>
			)}
		</div>
	);
}

function HostVotingView() {
	const { state, timer, getName } = useWitzoneState();
	if (!state?.currentPrompt) return null;

	const { text, answers, votedCount, eligibleVoterCount, authorIds } =
		state.currentPrompt;
	const label = `${roundLabel(state.round)} · ${state.currentPromptIndex + 1} of ${state.totalPromptsThisRound}`;

	return (
		<div className="flex flex-col min-h-screen px-10 py-10 gap-8">
			<TimerBar timer={timer} />

			<div className="flex items-center justify-between mt-2">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					{label}
				</div>
				<div className="text-white/40 text-sm tabular-nums">
					{votedCount}/{eligibleVoterCount} voted
				</div>
			</div>

			<div className="bg-surface border border-border rounded-2xl px-8 py-6">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-3">
					The prompt
				</p>
				<p className="text-white text-3xl font-display font-bold leading-snug">
					{text}
				</p>
			</div>

			<div className="flex flex-col gap-4">
				{answers.map((answer, i) => (
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

			<div className="flex flex-wrap gap-3 pt-2">
				{Object.values(state.players)
					.filter((p) => !authorIds.includes(p.id))
					.map((p) => (
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
				{authorIds.map((id) => (
					<div
						key={id}
						className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-surface border border-border text-white/20"
					>
						<span className="w-1.5 h-1.5 rounded-full bg-white/10" />
						{getName(id)}
						<span className="text-white/20">(author)</span>
					</div>
				))}
			</div>
		</div>
	);
}

function AuthorWaitView() {
	const { state } = useWitzoneState();
	if (!state?.currentPrompt) return null;

	const { text, votedCount, eligibleVoterCount } = state.currentPrompt;

	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center">
			<div className="text-4xl">✍️</div>
			<div>
				<p className="text-white font-semibold text-lg mb-2">
					You wrote one of these
				</p>
				<p className="text-white/50 text-sm">
					Sit tight while everyone else votes.
				</p>
			</div>
			<div className="bg-surface border border-border rounded-2xl px-6 py-4">
				<p className="text-white/40 text-xs uppercase tracking-widest mb-1">
					Prompt
				</p>
				<p className="text-white font-medium">{text}</p>
			</div>
			<p className="text-white/30 text-xs tabular-nums">
				{votedCount}/{eligibleVoterCount} voted
			</p>
		</div>
	);
}

function VoterView() {
	const { state, playerId, timer, sendAction } = useWitzoneState();
	if (!state?.currentPrompt) return null;

	const { text, answers, votedCount, eligibleVoterCount } = state.currentPrompt;
	const hasVoted = state.players[playerId]?.hasVoted ?? false;
	const label = `${roundLabel(state.round)} · ${state.currentPromptIndex + 1} of ${state.totalPromptsThisRound}`;

	return (
		<div className="flex flex-col min-h-screen px-6 py-10">
			<TimerBar timer={timer} />

			<div className="flex items-center justify-between mt-4 mb-8">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					{label}
				</div>
				<div className="text-xs text-white/40 tabular-nums">
					{votedCount}/{eligibleVoterCount} voted
				</div>
			</div>

			<div className="bg-surface border border-border rounded-2xl px-6 py-5 mb-8">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
					Which one's funnier?
				</p>
				<p className="text-white text-xl font-medium leading-relaxed">{text}</p>
			</div>

			{!hasVoted ? (
				<div className="flex flex-col gap-3 flex-1">
					{answers.map((answer) => (
						<motion.button
							key={answer.id}
							whileTap={{ scale: 0.97 }}
							onClick={() =>
								sendAction({ type: "cast_vote", answerId: answer.id })
							}
							className="w-full px-6 py-5 rounded-2xl border border-border bg-surface text-left text-white font-medium text-base hover:border-white/30 hover:bg-white/5 transition-all active:scale-[0.97] cursor-pointer"
						>
							{answer.text}
						</motion.button>
					))}
				</div>
			) : (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					className="flex flex-col items-center gap-4 flex-1 justify-center"
				>
					<div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
						✓
					</div>
					<p className="text-white/50 text-sm">
						Vote cast. Waiting for others...
					</p>
					<div className="flex gap-2">
						{Object.values(state.players)
							.filter((p) => !state.currentPrompt!.authorIds.includes(p.id))
							.map((p) => (
								<div
									key={p.id}
									className={`w-2 h-2 rounded-full transition-colors duration-300 ${p.hasVoted ? "bg-white/80" : "bg-white/20"}`}
								/>
							))}
					</div>
				</motion.div>
			)}
		</div>
	);
}

export function VotingPrompt() {
	const { state, secret, role, playerId } = useWitzoneState();
	if (!state) return null;

	if (state.promptStage === "revealing") return <RevealView />;
	if (role === "host") return <HostVotingView />;
	if (!secret) return <Loading />;

	return state.currentPrompt?.authorIds.includes(playerId) ? (
		<AuthorWaitView />
	) : (
		<VoterView />
	);
}