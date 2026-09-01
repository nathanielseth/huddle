import { useReducer, useEffect, useRef } from "react";
import { m, AnimatePresence } from "motion/react";
import { socket } from "../../../lib/network/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const Q_DISPLAY_MS = 7_000;
const Q_COUNT = 3;

// ─────────────────────────────────────────────────────────────────────────────
// State Machine
// ─────────────────────────────────────────────────────────────────────────────

type GameState = {
	qIndex: number;
	choices: (boolean | null)[];
	done: boolean;
};

type GameAction = { type: "ANSWER"; choice: boolean } | { type: "TIMEOUT" };

const INITIAL_STATE: GameState = {
	qIndex: 0,
	choices: Array<null>(Q_COUNT).fill(null),
	done: false,
};

function gameReducer(state: GameState, action: GameAction): GameState {
	if (state.done) return state;

	const choice = action.type === "ANSWER" ? action.choice : false;

	const nextChoices = state.choices.map((c, i) =>
		i === state.qIndex ? choice : c,
	);
	const nextIndex = state.qIndex + 1;

	if (nextIndex >= Q_COUNT) {
		return { qIndex: nextIndex, choices: nextChoices, done: true };
	}

	return { qIndex: nextIndex, choices: nextChoices, done: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ThumbShotTask() {
	const { sussy, secret, isImpostor, timer } = useSussyState();
	const [{ qIndex, choices, done }, dispatch] = useReducer(
		gameReducer,
		INITIAL_STATE,
	);

	const questions = Array.isArray(secret?.prompt)
		? (secret.prompt as string[])
		: null;
	const isHangout = sussy?.mode === "hangout";

	useEffect(() => {
		if (done || isHangout) return;
		const t = setTimeout(() => { dispatch({ type: "TIMEOUT" }); }, Q_DISPLAY_MS);
		return () => { clearTimeout(t); };
	}, [qIndex, done, isHangout]);

	const emitted = useRef(false);
	useEffect(() => {
		if (!done || isHangout || emitted.current) return;
		emitted.current = true;
		socket.emit("player_action", {
			type: "submit_response",
			response: {
				type: "thumb_shot",
				choices: choices.map((c) => c ?? false),
			},
		});
	}, [done, isHangout, choices]);

	function handleChoice(choice: boolean) {
		if (done || isHangout) return;
		dispatch({ type: "ANSWER", choice });
	}

	if (!sussy) return null;

	// ── Hangout mode ─────────────────────────────────────────────────────────
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
							// Fix: no-array-index-as-key — questions are unique strings,
							// use the question text as the key.
							<div
								key={q}
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

	// ── Done screen ──────────────────────────────────────────────────────────
	if (done) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen gap-4 px-8 text-center">
				<span className="text-5xl">✅</span>
				<p className="text-white/60 text-sm">
					All answered — waiting for others
				</p>
				<div className="flex gap-3 mt-2">
					{choices.map((c, i) => (
						// Fix: no-array-index-as-key — choices are positional ordinals;
						// use a semantic prefix so the key is not a bare index.
						<div
							key={`choice-${i}`}
							className="flex flex-col items-center gap-1"
						>
							<span className="text-2xl">{c ? "👍" : "👎"}</span>
							<span className="text-[10px] text-white/30">Q{i + 1}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	// ── Impostor ─────────────────────────────────────────────────────────────
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
							Question {qIndex + 1} of {Q_COUNT} · Pick something
						</p>
						<div className="flex gap-4 w-full max-w-xs">
							<ThumbBtn
								emoji="👍"
								label="Up"
								onClick={() => { handleChoice(true); }}
							/>
							<ThumbBtn
								emoji="👎"
								label="Down"
								onClick={() => { handleChoice(false); }}
							/>
						</div>
						<ProgressDots active={qIndex} total={Q_COUNT} />
					</div>
					<TimerBar timer={timer} />
				</div>
			</div>
		);
	}

	// ── Crew ─────────────────────────────────────────────────────────────────
	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-8">
			<div>
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-violet-400 mb-1">
					Thumb Shot · {qIndex + 1} of {Q_COUNT}
				</p>
				<TimerBar timer={timer} />
			</div>
			<div className="flex-1 flex flex-col items-center justify-center gap-8">
				<AnimatePresence mode="wait">
					<m.p
						key={qIndex}
						className="text-2xl font-bold text-white text-center leading-snug px-2"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -12 }}
						transition={{ duration: 0.2 }}
					>
						{questions?.[qIndex]}
					</m.p>
				</AnimatePresence>
				<div className="flex gap-4 w-full max-w-xs">
					<ThumbBtn emoji="👍" label="Up" onClick={() => { handleChoice(true); }} />
					<ThumbBtn
						emoji="👎"
						label="Down"
						onClick={() => { handleChoice(false); }}
					/>
				</div>
				<ProgressDots active={qIndex} total={Q_COUNT} />
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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

function ProgressDots({ active, total }: { active: number; total: number }) {
	return (
		<div className="flex gap-2">
			{Array.from({ length: total }, (_, i) => (
				// Fix: no-array-index-as-key — progress dots are positional;
				// use a semantic prefix.
				<div
					key={`dot-${i}`}
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