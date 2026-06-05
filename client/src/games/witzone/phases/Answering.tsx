import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { Loading, WaitingView } from "./shared";
import { MAX_ANSWER_LENGTH, roundLabel } from "../constants";

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
						{roundLabel(state.round)}
					</p>
					<h1 className="text-4xl font-display font-bold text-white">
						Answering
					</h1>
				</div>
				<p className="text-white/40 text-lg tabular-nums">
					{state.answeredCount}/{state.totalPlayers} ready
				</p>
			</div>

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

export function Answering() {
	const { state, secret, role, timer, sendAction } = useWitzoneState();
	const [inputs, setInputs] = useState<Record<number, string>>({});
	const [submitting, setSubmitting] = useState<Record<number, boolean>>({});

	if (!state) return null;
	if (role === "host") return <HostView />;
	if (!secret) return <Loading />;

	const prompts = secret.assignedPrompts;

	// server-authoritative: all prompts confirmed submitted
	if (prompts.every((p) => p.submitted)) {
		return <WaitingView message="Answers locked in. Waiting for others..." />;
	}

	function handleSubmit(promptIndex: number) {
		if (submitting[promptIndex]) return;
		const text = (inputs[promptIndex] ?? "").trim();
		if (!text || text.length > MAX_ANSWER_LENGTH) return;
		setSubmitting((prev) => ({ ...prev, [promptIndex]: true }));
		sendAction({ type: "submit_answer", promptIndex, text });
	}

	return (
		<div className="flex flex-col min-h-screen px-6 py-10">
			<TimerBar timer={timer} />

			<div className="flex items-center justify-between mt-4 mb-8">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					{roundLabel(state.round)}
				</div>
				<div className="text-xs text-white/40">
					{state.answeredCount}/{state.totalPlayers} ready
				</div>
			</div>

			<div className="flex flex-col gap-6 flex-1">
				{prompts.map((prompt, idx) => {
					// optimistic local flag OR server confirmation
					const isDone = prompt.submitted || submitting[prompt.promptIndex];
					const text = inputs[prompt.promptIndex] ?? "";
					const charsLeft = MAX_ANSWER_LENGTH - text.length;
					const isOver = charsLeft < 0;

					return (
						<div
							key={prompt.promptIndex}
							className="bg-surface border border-border rounded-2xl px-6 py-5"
						>
							<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
								Prompt {idx + 1} of {prompts.length}
							</p>
							<p className="text-white text-lg font-medium leading-relaxed mb-4">
								{prompt.text}
							</p>

							<AnimatePresence mode="wait">
								{isDone ? (
									<motion.div
										key="done"
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										className="flex items-center gap-2"
									>
										<span className="text-white/40 text-sm">✓</span>
										<span className="text-white/60 text-sm italic">
											{prompt.answer ??
												inputs[prompt.promptIndex] ??
												"Submitted"}
										</span>
									</motion.div>
								) : (
									<motion.div
										key="input"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										className="flex flex-col gap-2"
									>
										<input
											type="text"
											value={text}
											onChange={(e) =>
												setInputs((prev) => ({
													...prev,
													[prompt.promptIndex]: e.target.value,
												}))
											}
											onKeyDown={(e) => {
												if (e.key === "Enter") handleSubmit(prompt.promptIndex);
											}}
											placeholder="Your answer..."
											maxLength={MAX_ANSWER_LENGTH + 10}
											autoFocus={idx === 0}
											className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-white placeholder:text-white/30 focus:outline-none focus:border-white/40 text-base transition-colors"
										/>
										<div className="flex items-center justify-between">
											<span
												className={`text-xs ${isOver ? "text-red-400" : charsLeft <= 20 ? "text-white/60" : "text-transparent"}`}
											>
												{charsLeft} left
											</span>
											<button
												onClick={() => handleSubmit(prompt.promptIndex)}
												disabled={!text.trim() || isOver}
												className="px-5 py-2 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
											>
												Lock in
											</button>
										</div>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					);
				})}
			</div>
		</div>
	);
}