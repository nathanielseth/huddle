import { useState, useRef, useEffect } from "react";
import { m } from "motion/react";
import { useSquadoodleState } from "../hooks/useSquadoodleState";
import { ProgressPips } from "../components/ProgressPips";
import { socket } from "../../../lib/network/socket";
import type { GameTimer } from "@shared/core/room";
import type { SquadoodleState } from "@shared/games/squadoodle/index";

// Reusing TimerBar from sabong — same interface, no game-specific logic.
import { TimerBar } from "../../sabong/components/TimerBar";

const MAX_LENGTH = 120;

export function PromptWriting() {
	const { game, role, timer } = useSquadoodleState();
	if (!game) return null;

	return role === "host" ? (
		<HostView game={game} timer={timer} />
	) : (
		<PlayerView timer={timer} />
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
	return (
		<div className="flex flex-col min-h-screen items-center justify-center gap-8 px-12 py-10">
			<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
				Round 1 of {game.totalSteps}
			</span>
			<h1 className="font-display text-7xl font-black uppercase text-white text-center">
				Write Your
				<br />
				Prompt
			</h1>
			<p className="text-white/40 text-center max-w-sm">
				Every player is writing a secret phrase. Keep it creative — it's about
				to get very lost in translation.
			</p>
			<ProgressPips submitted={game.submittedCount} total={game.totalCount} />
			<div className="w-full max-w-xs">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

// ─── Player ──────────────────────────────────────────────────────────────────

function PlayerView({ timer }: { timer: GameTimer | null }) {
	const [text, setText] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Focus the textarea after mount via ref+effect instead of autoFocus.
	// autoFocus is a static HTML attribute that fires before React commits —
	// it can steal focus from screen readers mid-page-read. useEffect gives
	// us intentional, post-commit focus management, which is the a11y-safe
	// pattern for situations (like this game phase) where focus must move on mount.
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	function submit() {
		const trimmed = text.trim();
		if (!trimmed || submitted) return;
		setSubmitted(true);
		socket.emit("player_action", { type: "submit_prompt", text: trimmed });
	}

	function handleKey(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div className="flex flex-col gap-1">
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Round 1
				</p>
				<h1 className="font-display text-4xl font-black uppercase text-white leading-none">
					Your Prompt
				</h1>
				<TimerBar timer={timer} />
			</div>

			{submitted ? (
				<div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
					<div className="w-16 h-16 rounded-full bg-indigo-400/15 border border-indigo-400/30 flex items-center justify-center text-2xl">
						✓
					</div>
					<p className="text-white/40 text-sm">Waiting for others…</p>
				</div>
			) : (
				<div className="flex flex-col gap-4 flex-1 justify-center">
					<p className="text-sm text-white/50">
						Write something that will be fun to draw — or impossible. Your
						choice.
					</p>
					<div className="relative">
						{/*
						  aria-label gives the textarea an accessible name that screen
						  readers announce on focus. Without it, a screen reader user
						  hears nothing — they can't tell if it's a search box, a chat
						  field, or a submit form. The placeholder is NOT a label:
						  many ATs don't read it, and it disappears once you type.
						*/}
						<textarea
							ref={textareaRef}
							aria-label="Your prompt"
							className="w-full h-28 rounded-2xl bg-white/5 border border-white/15 px-4 py-3 text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-indigo-400/50 text-base"
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
						Lock It In
					</m.button>
				</div>
			)}
		</div>
	);
}