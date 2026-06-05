import { useState } from "react";
import { motion } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { Loading, WaitingView } from "./shared";
import { MAX_ANSWER_LENGTH } from "../constants";

function HostView() {
	const { state, timer, getName } = useWitzoneState();
	if (!state) return null;

	const players = Object.values(state.players);

	return (
		<div className="flex flex-col min-h-screen px-10 py-10 gap-8">
			<TimerBar timer={timer} />

			<div className="flex items-end justify-between mt-2">
				<div>
					<p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-1">
						Final Round
					</p>
					<h1 className="text-4xl font-display font-bold text-white">
						Final Answering
					</h1>
				</div>
				<p className="text-white/40 text-lg tabular-nums">
					{state.answeredCount}/{state.totalPlayers} ready
				</p>
			</div>

			{state.finalPromptText && (
				<div className="bg-surface border border-border rounded-2xl px-8 py-6">
					<p className="text-xs uppercase tracking-widest text-white/40 mb-3">
						The prompt
					</p>
					<p className="text-white text-3xl font-display font-bold leading-snug">
						{state.finalPromptText}
					</p>
				</div>
			)}

			<div className="grid grid-cols-2 gap-3">
				{players.map((p) => (
					<div
						key={p.id}
						className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-300 ${
							p.hasAnswered
								? "border-white/30 bg-white/5"
								: "border-border bg-surface"
						}`}
					>
						<span
							className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300 ${p.hasAnswered ? "bg-white" : "bg-white/20"}`}
						/>
						<span
							className={`text-base transition-colors duration-300 ${p.hasAnswered ? "text-white font-medium" : "text-white/40"}`}
						>
							{getName(p.id)}
						</span>
						{p.hasAnswered && (
							<span className="ml-auto text-white/40 text-sm">✓</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

export function FinalAnswering() {
	const { state, secret, role, timer, sendAction } = useWitzoneState();
	const [input, setInput] = useState("");
	const [submitting, setSubmitting] = useState(false);

	if (!state) return null;
	if (role === "host") return <HostView />;
	if (!secret) return <Loading />;
	if (submitting)
		return <WaitingView message="Final answer locked. Waiting for others..." />;

	const promptText = secret.finalPrompt ?? state.finalPromptText ?? "";
	const charsLeft = MAX_ANSWER_LENGTH - input.length;
	const isOver = charsLeft < 0;

	function handleSubmit() {
		const text = input.trim();
		if (!text || isOver) return;
		setSubmitting(true);
		sendAction({ type: "submit_answer", promptIndex: 0, text });
	}

	return (
		<div className="flex flex-col min-h-screen px-6 py-10">
			<TimerBar timer={timer} />

			<div className="flex items-center justify-between mt-4 mb-8">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					Final Round
				</div>
				<div className="text-xs text-white/40">
					{state.answeredCount}/{state.totalPlayers} ready
				</div>
			</div>

			<div className="flex-1 flex flex-col justify-center gap-6">
				<div className="bg-surface border border-border rounded-2xl px-6 py-5">
					<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
						Final prompt — everyone answers this
					</p>
					<p className="text-white text-xl font-medium leading-relaxed">
						{promptText}
					</p>
				</div>

				<motion.div
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					className="flex flex-col gap-2"
				>
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleSubmit();
						}}
						placeholder="Your final answer..."
						maxLength={MAX_ANSWER_LENGTH + 10}
						autoFocus
						className="w-full px-4 py-3 rounded-xl bg-surface border border-border text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 text-base transition-colors"
					/>
					<div className="flex items-center justify-between">
						<span
							className={`text-xs ${isOver ? "text-red-400" : charsLeft <= 20 ? "text-white/60" : "text-transparent"}`}
						>
							{charsLeft} left
						</span>
						<button
							onClick={handleSubmit}
							disabled={!input.trim() || isOver}
							className="px-5 py-2 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
						>
							Lock in final answer
						</button>
					</div>
				</motion.div>
			</div>
		</div>
	);
}