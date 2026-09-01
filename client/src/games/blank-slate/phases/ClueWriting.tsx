import { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "motion/react";
import { useBlankSlateState } from "../hooks/useBlankSlateState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { TimerBar } from "../../sabong/components/TimerBar";
import { Loading } from "./shared";
import { MAX_CLUE_LENGTH, roundLabel } from "../constants";

function HostView() {
	const { state, timer, getName } = useBlankSlateState();
	if (!state) return null;

	const guesserName = getName(state.guesserPlayerId);
	const writers = Object.values(state.players).filter((p) => !p.isGuesser);

	return (
		<div className="flex flex-col min-h-screen px-10 py-10 gap-8">
			<TimerBar timer={timer} />

			<div className="flex items-end justify-between mt-2">
				<div>
					<p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-1">
						{roundLabel(state.roundNumber, state.totalRounds)}
					</p>
					<h1 className="text-4xl font-display font-bold text-white">
						Writing clues for {guesserName}
					</h1>
				</div>
				<p className="text-white/40 text-lg tabular-nums">
					{state.cluesSubmittedCount}/{state.cluesExpectedCount} ready
				</p>
			</div>

			<div className="rounded-2xl border border-huddle/30 bg-huddle/5 px-6 py-5 text-center">
				<p className="text-xs uppercase tracking-widest text-huddle/70 mb-2">
					{guesserName} must look away
				</p>
				<p className="text-white/50 text-sm">
					Everyone else, write a one-word clue that points to the secret word —
					without using the word itself.
				</p>
			</div>

			<div className="grid grid-cols-2 gap-3">
				{writers.map((p) => (
					<div
						key={p.playerId}
						className={`flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-300 ${
							p.hasSubmittedClue
								? "border-white/30 bg-white/5"
								: "border-border bg-surface"
						}`}
					>
						<span
							className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300 ${p.hasSubmittedClue ? "bg-white" : "bg-white/20"}`}
						/>
						<span
							className={`text-base transition-colors duration-300 ${p.hasSubmittedClue ? "text-white font-medium" : "text-white/40"}`}
						>
							{getName(p.playerId)}
						</span>
						{p.hasSubmittedClue && (
							<span className="ml-auto text-white/40 text-sm">✓</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

function GuesserView() {
	const { state, getName } = useBlankSlateState();
	if (!state) return null;

	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6 text-center">
			<m.div
				initial={{ scale: 0.85, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 20 }}
				className="w-16 h-16 rounded-full bg-huddle/15 flex items-center justify-center text-3xl"
			>
				🙈
			</m.div>
			<div>
				<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
					{roundLabel(state.roundNumber, state.totalRounds)} · you're guessing
				</p>
				<h1 className="text-2xl font-display font-bold text-white mb-2">
					Don't peek at the screen
				</h1>
				<p className="text-white/50 text-sm max-w-xs">
					Everyone else can see the secret word and is writing you a clue.
					Look away until it's your turn to guess.
				</p>
			</div>
			<div className="flex gap-2 flex-wrap justify-center mt-2">
				{Object.values(state.players)
					.filter((p) => !p.isGuesser)
					.map((p) => (
						<div
							key={p.playerId}
							className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
								p.hasSubmittedClue ? "bg-white/80" : "bg-white/20"
							}`}
							title={getName(p.playerId)}
						/>
					))}
			</div>
		</div>
	);
}

function WriterView() {
	const { state, myView, timer, sendAction } = useBlankSlateState();
	const [text, setText] = useState("");
	const { locked, runLocked } = useActionLock(myView?.hasSubmittedClue);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	if (!state || !myView) return <Loading />;

	const submitted = myView.hasSubmittedClue;
	const trimmed = text.trim();
	const isOver = trimmed.length > MAX_CLUE_LENGTH;
	const isMultiWord = /\s/.test(trimmed);
	const canSubmit = trimmed.length > 0 && !isOver && !isMultiWord;

	function handleSubmit() {
		if (!canSubmit) return;
		runLocked(() => {
			sendAction({ type: "submit_clue", text: trimmed });
		});
	}

	return (
		<div className="flex flex-col min-h-screen px-6 py-10">
			<TimerBar timer={timer} />

			<div className="flex items-center justify-between mt-4 mb-8">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					{roundLabel(state.roundNumber, state.totalRounds)}
				</div>
				<div className="text-xs text-white/40">
					{state.cluesSubmittedCount}/{state.cluesExpectedCount} ready
				</div>
			</div>

			<div className="flex flex-col items-center justify-center flex-1 gap-6">
				<AnimatePresence mode="wait">
					{submitted ? (
						<m.div
							key="done"
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							className="flex flex-col items-center gap-3 text-center"
						>
							<span className="text-3xl">✓</span>
							<p className="text-white/60 text-sm">
								Clue locked in. Waiting for the others...
							</p>
						</m.div>
					) : (
						<m.div
							key="input"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							className="w-full max-w-sm flex flex-col gap-4"
						>
							<p className="text-white/50 text-sm text-center">
								Write a one-word clue for the secret word. Duplicate clues
								cancel each other out.
							</p>
							{/*
							 * Fix: control-has-associated-label — aria-label names the field
							 * Fix: no-autofocus — ref-based focus only, no autoFocus prop
							 */}
							<input
								ref={inputRef}
								type="text"
								value={text}
								onChange={(e) => { setText(e.target.value); }}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSubmit();
								}}
								placeholder="One word..."
								maxLength={MAX_CLUE_LENGTH + 20}
								aria-label="Your one-word clue"
								className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-white text-center text-lg placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
							/>
							{isMultiWord && (
								<p className="text-red-400 text-xs text-center">
									One word only — no spaces.
								</p>
							)}
							{isOver && !isMultiWord && (
								<p className="text-red-400 text-xs text-center">
									Too long — keep it under {MAX_CLUE_LENGTH} characters.
								</p>
							)}
							<button
								type="button"
								onClick={handleSubmit}
								disabled={!canSubmit || locked}
								className="w-full px-5 py-3 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
							>
								Lock in
							</button>
						</m.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}

export function ClueWriting() {
	const { state, role, amGuesser } = useBlankSlateState();
	if (!state) return <Loading />;
	if (role === "host") return <HostView />;
	if (amGuesser) return <GuesserView />;
	return <WriterView />;
}
