import { useState } from "react";
import { m } from "motion/react";
import { useSquadoodleState } from "../hooks/useSquadoodleState";
import { StrokeRenderer } from "../components/StrokeRenderer";
import { ProgressPips } from "../components/ProgressPips";
import { TimerBar } from "../../sabong/components/TimerBar";
import { socket } from "../../../lib/network/socket";
import type { Stroke, SquadoodleState } from "@shared/games/squadoodle/index";
import type { GameTimer } from "@shared/core/room";

const MAX_LENGTH = 120;

export function Guessing() {
	const { game, role, task, timer } = useSquadoodleState();
	if (!game) return null;

	return role === "host" ? (
		<HostView game={game} timer={timer} />
	) : (
		<PlayerView game={game} task={task} timer={timer} />
	);
}

// ─── Host ────────────────────────────────────────────────────────────────────

function HostView({
	game,
	timer,
}: {
	game: SquadoodleState;
	timer: GameTimer | null;
}) {
	const round = game.step + 1;
	return (
		<div className="flex flex-col min-h-screen items-center justify-center gap-8 px-12 py-10">
			<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Round {round} of {game.totalSteps}
			</span>
			<h1 className="font-display text-7xl font-black uppercase text-white text-center">
				Guessing
			</h1>
			<p className="text-white/40 text-center max-w-sm">
				Players are captioning each other's masterpieces. Good luck.
			</p>
			<ProgressPips submitted={game.submittedCount} total={game.totalCount} />
			<div className="w-full max-w-xs">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

// ─── Player ──────────────────────────────────────────────────────────────────

function PlayerView({
	game,
	task,
	timer,
}: {
	game: SquadoodleState;
	task: ReturnType<typeof useSquadoodleState>["task"];
	timer: GameTimer | null;
}) {
	const [text, setText] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const round = game.step + 1;

	function submit() {
		const trimmed = text.trim();
		if (!trimmed || submitted) return;
		setSubmitted(true);
		socket.emit("player_action", { type: "submit_guess", text: trimmed });
	}

	function handleKey(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	const strokes: readonly Stroke[] = task?.type === "guess" ? task.strokes : [];

	if (submitted || task?.type === "wait") {
		return (
			<div className="flex flex-col h-dvh px-5 py-8 gap-6">
				<div className="flex flex-col gap-1">
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						Round {round}
					</p>
					<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
						Guessing
					</h1>
					<TimerBar timer={timer} />
				</div>
				<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
					<div className="w-16 h-16 rounded-full bg-indigo-400/15 border border-indigo-400/30 flex items-center justify-center text-2xl">
						✓
					</div>
					<p className="text-white/40 text-sm">
						Submitted! Waiting for others…
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-dvh px-4 py-5 gap-4">
			<div className="flex flex-col gap-1 shrink-0">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Round {round} · Guess
				</p>
				<TimerBar timer={timer} />
			</div>

			{/* Drawing to caption — takes up roughly half the screen */}
			<div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-black/10 bg-white">
				<StrokeRenderer strokes={strokes} className="w-full h-full" />
			</div>

			{/* Guess input */}
			<div className="flex flex-col gap-3 shrink-0">
				<p className="text-xs font-bold tracking-[0.2em] uppercase text-white/30">
					What is this?
				</p>
				<div className="relative">
					<textarea
						aria-label="Your caption for this drawing"
						className="w-full h-20 rounded-2xl bg-white/5 border border-white/15 px-4 py-3 text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-indigo-400/50 text-base"
						placeholder="A confused penguin at a salsa class…"
						maxLength={MAX_LENGTH}
						value={text}
						onChange={(e) => { setText(e.target.value); }}
						onKeyDown={handleKey}
					/>
					<span className="absolute bottom-3 right-4 text-xs text-white/25 tabular-nums">
						{text.length}/{MAX_LENGTH}
					</span>
				</div>
				<m.button
					type="button"
					onClick={submit}
					disabled={!text.trim()}
					whileTap={{ scale: 0.97 }}
					className="w-full h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-display font-bold text-lg uppercase tracking-wide disabled:opacity-30 transition-all hover:bg-indigo-500/30 cursor-pointer"
				>
					That's Definitely It
				</m.button>
			</div>
		</div>
	);
}