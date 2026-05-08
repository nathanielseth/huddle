import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { socket } from "../../../lib/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";

const Q_DISPLAY_MS = 7_000;

export function ThumbShotTask() {
	const { sussy, secret, isImpostor, timer } = useSussyState();
	const [qIndex, setQIndex] = useState(0);
	const [choices, setChoices] = useState<(boolean | null)[]>([
		null,
		null,
		null,
	]);
	const [done, setDone] = useState(false);

	const questions = Array.isArray(secret?.prompt) ? secret.prompt : null;
	const isHangout = sussy?.mode === "hangout";

	useEffect(() => {
		if (done || isHangout) return;
		const t = setTimeout(() => {
			advance(choices[qIndex] ?? false, qIndex, choices);
		}, Q_DISPLAY_MS);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [qIndex, done, isHangout]);

	function advance(choice: boolean, idx: number, prev: (boolean | null)[]) {
		const next = [...prev];
		next[idx] = choice;
		setChoices(next);
		if (idx < 2) {
			setQIndex(idx + 1);
		} else {
			setDone(true);
			socket.emit("player_action", {
				type: "submit_response",
				response: { type: "thumb_shot", choices: next.map((c) => c ?? false) },
			});
		}
	}

	function handleChoice(choice: boolean) {
		if (done) return;
		advance(choice, qIndex, choices);
	}

	if (!sussy) return null;

	// ── Hangout ───────────────────────────────────────────────────────────────
	if (isHangout) {
		return (
			<div className="flex flex-col min-h-screen px-5 py-10 gap-8">
				<div>
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
						Thumb Shot
					</p>
					<TimerBar timer={timer} />
				</div>
				{isImpostor ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center opacity-60">
						<span className="text-5xl">👍</span>
						<p className="text-white/50 text-sm">Watch and mimic the group</p>
					</div>
				) : (
					<div className="flex flex-col gap-4">
						{questions?.map((q, i) => (
							<div
								key={i}
								className="flex gap-4 px-5 py-4 rounded-2xl border border-border bg-surface"
							>
								<span className="text-xs font-bold text-white/30 shrink-0 mt-0.5">
									Q{i + 1}
								</span>
								<p className="text-sm text-white font-semibold leading-snug">
									{q}
								</p>
							</div>
						))}
					</div>
				)}
			</div>
		);
	}

	// ── Remote — done ─────────────────────────────────────────────────────────
	if (done) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8 text-center">
				<span className="text-5xl">✅</span>
				<p className="text-white/60 text-sm">
					All answered — waiting for others
				</p>
				<div className="flex gap-3 mt-2">
					{choices.map((c, i) => (
						<div key={i} className="flex flex-col items-center gap-1">
							<span className="text-2xl">{c ? "👍" : "👎"}</span>
							<span className="text-[10px] text-white/30">Q{i + 1}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	// ── Remote — impostor (blind) ─────────────────────────────────────────────
	if (isImpostor) {
		return (
			<div className="flex flex-col min-h-screen relative">
				<div className="absolute inset-0 bg-red-900/15 pointer-events-none" />
				<div className="relative flex flex-col min-h-screen px-5 py-8 gap-8">
					<div className="flex flex-col gap-1">
						<p className="text-xs font-bold tracking-[0.4em] uppercase text-red-400">
							Impostor
						</p>
						<h2 className="font-display text-2xl font-black uppercase text-white leading-tight">
							You Are the Impostor.
							<br />
							<span className="text-white/50">Blend in.</span>
						</h2>
					</div>
					<div className="flex-1 flex flex-col items-center justify-center gap-6">
						<p className="text-white/40 text-sm text-center">
							Question {qIndex + 1} of 3 · Pick something
						</p>
						<div className="flex gap-4 w-full max-w-xs">
							<ThumbBtn
								emoji="👍"
								label="Up"
								onClick={() => handleChoice(true)}
							/>
							<ThumbBtn
								emoji="👎"
								label="Down"
								onClick={() => handleChoice(false)}
							/>
						</div>
						<ProgressDots active={qIndex} />
					</div>
					<TimerBar timer={timer} />
				</div>
			</div>
		);
	}

	// ── Remote — crew ─────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-8">
			<div>
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
					Thumb Shot · {qIndex + 1} of 3
				</p>
				<TimerBar timer={timer} />
			</div>
			<div className="flex-1 flex flex-col items-center justify-center gap-8">
				<AnimatePresence mode="wait">
					<motion.p
						key={qIndex}
						className="text-2xl font-bold text-white text-center leading-snug px-2"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -12 }}
						transition={{ duration: 0.2 }}
					>
						{questions?.[qIndex]}
					</motion.p>
				</AnimatePresence>
				<div className="flex gap-4 w-full max-w-xs">
					<ThumbBtn emoji="👍" label="Up" onClick={() => handleChoice(true)} />
					<ThumbBtn
						emoji="👎"
						label="Down"
						onClick={() => handleChoice(false)}
					/>
				</div>
				<ProgressDots active={qIndex} />
			</div>
		</div>
	);
}

function ThumbBtn({
	emoji,
	label,
	onClick,
}: {
	emoji: string;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex-1 h-24 rounded-3xl border border-border bg-surface hover:bg-violet-500/15 hover:border-violet-500/40 active:scale-[0.96] transition-all cursor-pointer flex flex-col items-center justify-center gap-1"
		>
			<span className="text-4xl">{emoji}</span>
			<span className="text-xs font-bold text-white/50 uppercase tracking-widest">
				{label}
			</span>
		</button>
	);
}

function ProgressDots({ active }: { active: number }) {
	return (
		<div className="flex gap-2">
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					className={`w-2 h-2 rounded-full transition-all duration-300 ${
						i === active
							? "bg-violet-400 scale-125"
							: i < active
								? "bg-white/50"
								: "bg-white/15"
					}`}
				/>
			))}
		</div>
	);
}
