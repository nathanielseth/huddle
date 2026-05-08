import { useState, useRef } from "react";
import { socket } from "../../../lib/socket";
import { useSussyState } from "../hooks/useSussyState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { motion } from "motion/react";

/**
 * Rendered once per taskNumber. TaskPerform passes key={sussy.taskNumber}
 * so the component remounts fresh on each question — no useEffect needed.
 */
export function GlitchInTheChatTask() {
	const { sussy, myPlayer, currentPrompt, timer } = useSussyState();
	const [answer, setAnswer] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	if (!sussy) return null;

	const isDone = submitted || myPlayer?.hasResponded;
	const canSubmit = answer.trim().length > 0;

	function submit() {
		if (!canSubmit || isDone) return;
		socket.emit("player_action", {
			type: "submit_response",
			response: { type: "glitch_in_the_chat", answers: [answer.trim()] },
		});
		setSubmitted(true);
	}

	function handleKey(e: React.KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			submit();
		}
	}

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div>
				<div className="flex items-center gap-2 mb-1">
					<p className="text-xs font-bold tracking-[0.3em] uppercase text-amber-400">
						Glitch in the Chat
					</p>
					<span className="text-xs text-white/30">
						· Question {sussy.taskNumber} of 3
					</span>
				</div>
				<TimerBar timer={timer} />
			</div>

			<motion.div
				className="px-5 py-6 rounded-2xl border border-amber-500/20 bg-amber-500/5"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.2 }}
			>
				<p className="text-xl font-bold text-white leading-snug">
					{currentPrompt}
				</p>
			</motion.div>

			{isDone ? (
				<div className="flex flex-col gap-3 flex-1">
					<p className="text-xs font-bold tracking-widest uppercase text-white/30">
						Your answer
					</p>
					<div className="px-4 py-3 rounded-xl border border-border bg-surface text-white/60 text-sm">
						{answer || "—"}
					</div>
					<p className="text-xs text-white/30 text-center mt-2">
						Waiting for others…
					</p>
				</div>
			) : (
				<div className="flex flex-col gap-3 flex-1">
					<p className="text-xs font-bold tracking-widest uppercase text-white/30">
						Your answer
					</p>
					<textarea
						ref={inputRef}
						autoFocus
						value={answer}
						onChange={(e) => setAnswer(e.target.value)}
						onKeyDown={handleKey}
						placeholder="Type something honest…"
						rows={4}
						className="flex-1 px-4 py-3 rounded-xl border border-border bg-surface text-white placeholder:text-white/20 text-sm resize-none focus:outline-none focus:border-amber-500/50 transition-colors"
					/>
					<button
						type="button"
						onClick={submit}
						disabled={!canSubmit}
						className={`h-12 rounded-xl text-sm font-bold tracking-widest uppercase transition-all ${
							canSubmit
								? "bg-amber-500 text-white cursor-pointer hover:bg-amber-400 active:scale-[0.98]"
								: "bg-white/5 text-white/20 cursor-not-allowed"
						}`}
					>
						Submit Answer
					</button>
					<p className="text-[10px] text-white/20 text-center">
						Enter to submit · Shift+Enter for new line
					</p>
				</div>
			)}
		</div>
	);
}
