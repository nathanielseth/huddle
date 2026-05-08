import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useSussyState } from "../hooks/useSussyState";
import { getTaskMeta } from "../constants";
import { cn } from "../../../utils/cn";

type Step = 0 | 1 | 2 | 3;
const STEP_MS: Record<Step, number> = { 0: 0, 1: 1800, 2: 3500, 3: 5200 };

export function RoundResult() {
	const { sussy, players } = useSussyState();
	const [step, setStep] = useState<Step>(0);

	useEffect(() => {
		const timers = ([1, 2, 3] as const).map((s) =>
			setTimeout(() => setStep(s), STEP_MS[s]),
		);
		return () => timers.forEach(clearTimeout);
	}, []);

	if (!sussy) return null;
	const result = sussy.lastRoundResult;
	if (!result) return null;

	const lastTask = result.taskResults[result.taskResults.length - 1];
	const wasCaught = lastTask?.wasCaught ?? false;
	const impostorName =
		players.find((p) => p.id === result.impostorId)?.name ?? "Unknown";
	const meta = getTaskMeta(result.taskType);

	// Find who got the majority vote (may not be the impostor)
	const voteBreakdown = lastTask?.voteBreakdown ?? {};
	const tally = new Map<string, number>();
	for (const targetId of Object.values(voteBreakdown)) {
		if (!targetId) continue;
		tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
	}
	const threshold = Math.floor(players.length / 2) + 1;
	let majorityId: string | null = null;
	for (const [id, count] of tally) {
		if (count >= threshold) {
			majorityId = id;
			break;
		}
	}
	const majorityName = players.find((p) => p.id === majorityId)?.name ?? null;
	const wrongPerson = majorityId !== null && majorityId !== result.impostorId;

	// Merge score deltas across all tasks in this round
	const roundDeltas: Record<string, number> = {};
	for (const tr of result.taskResults) {
		for (const [id, delta] of Object.entries(tr.scoreDeltas)) {
			roundDeltas[id] = (roundDeltas[id] ?? 0) + delta;
		}
	}

	// Verdict label
	const verdictLabel = wasCaught
		? "🎉 Caught!"
		: wrongPerson
			? `❌ ${majorityName} is not the Impostor`
			: "😈 Escaped!";
	const verdictColor = wasCaught
		? "border-green-500/40 bg-green-500/10 text-green-400"
		: wrongPerson
			? "border-orange-500/30 bg-orange-500/8 text-orange-300"
			: "border-red-500/30 bg-red-500/8 text-red-400";

	return (
		<div className="flex flex-col min-h-screen px-5 py-10 gap-6 overflow-y-auto">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					{meta.icon} {meta.label} · Round {result.roundNumber}
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Results
				</h1>
			</div>

			{/* Vote rows */}
			<div className="flex flex-col gap-2">
				{players.map((p, i) => {
					const sp = sussy.players[p.id];
					const target = players.find((t) => t.id === sp?.voteTargetId);
					const isCorrect = sp?.voteTargetId === result.impostorId;
					const delta = roundDeltas[p.id];

					return (
						<motion.div
							key={p.id}
							className={cn(
								"flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors duration-500",
								step >= 1 && isCorrect
									? "border-green-500/40 bg-green-500/8"
									: "border-border bg-surface",
							)}
							initial={{ opacity: 0, x: -12 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ delay: i * 0.06, duration: 0.22 }}
						>
							<span
								className={cn(
									"w-2 h-2 rounded-full shrink-0",
									p.isConnected ? "bg-green-400" : "bg-white/20",
								)}
							/>
							<span className="flex-1 text-sm font-semibold text-white truncate">
								{p.name}
							</span>
							{target && (
								<span
									className={cn(
										"text-xs font-bold shrink-0",
										step >= 1
											? isCorrect
												? "text-green-400"
												: "text-white/30"
											: "text-white/50",
									)}
								>
									→ {target.name}
								</span>
							)}
							<AnimatePresence>
								{step >= 3 && delta !== undefined && delta !== 0 && (
									<motion.span
										className={cn(
											"text-sm font-black tabular-nums shrink-0",
											delta > 0 ? "text-green-400" : "text-red-400",
										)}
										initial={{ opacity: 0, scale: 0.5 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ type: "spring", stiffness: 400, damping: 22 }}
									>
										{delta > 0 ? "+" : ""}
										{delta}
									</motion.span>
								)}
							</AnimatePresence>
						</motion.div>
					);
				})}
			</div>

			{/* Verdict — step 1 */}
			<AnimatePresence>
				{step >= 1 && (
					<motion.div
						className={cn(
							"px-6 py-5 rounded-2xl border text-center",
							verdictColor,
						)}
						initial={{ opacity: 0, y: 12, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						transition={{ duration: 0.3 }}
					>
						<p className="font-display text-2xl font-black uppercase">
							{verdictLabel}
						</p>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Impostor reveal + prompt — step 2 */}
			<AnimatePresence>
				{step >= 2 && (
					<motion.div
						className="flex flex-col gap-3"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3 }}
					>
						<p className="text-xs font-bold tracking-widest uppercase text-white/30">
							The Impostor was
						</p>
						<div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/8">
							<span className="text-2xl">🫵</span>
							<span className="font-display text-xl font-black uppercase text-red-300">
								{impostorName}
							</span>
						</div>
						{result.impostorPrompt ? (
							<div className="flex flex-col gap-2">
								<PromptCard
									label="Crew was asked"
									prompt={result.crewPrompt}
									color="violet"
								/>
								<PromptCard
									label="Impostor was asked"
									prompt={result.impostorPrompt}
									color="red"
								/>
							</div>
						) : (
							<PromptCard
								label="The prompt was"
								prompt={result.crewPrompt}
								color="violet"
							/>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function PromptCard({
	label,
	prompt,
	color,
}: {
	label: string;
	prompt: string | readonly string[];
	color: "violet" | "red";
}) {
	const items = Array.isArray(prompt) ? prompt : [prompt];
	const border =
		color === "violet"
			? "border-violet-500/30 bg-violet-500/5"
			: "border-red-500/20 bg-red-500/5";
	const labelCn = color === "violet" ? "text-violet-400" : "text-red-400";

	return (
		<div className={cn("px-4 py-3 rounded-xl border", border)}>
			<p
				className={cn(
					"text-[10px] font-bold tracking-widest uppercase mb-2",
					labelCn,
				)}
			>
				{label}
			</p>
			{items.map((q, i) => (
				<p key={i} className="text-sm text-white/70 leading-snug">
					{items.length > 1 && (
						<span className="text-white/30 mr-1">Q{i + 1}.</span>
					)}
					{q}
				</p>
			))}
		</div>
	);
}
