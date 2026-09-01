import { useState } from "react";
import { m } from "motion/react";
import { useBlankSlateState } from "../hooks/useBlankSlateState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { TimerBar } from "../../sabong/components/TimerBar";
import { Loading } from "./shared";
import { MAX_GUESS_LENGTH, roundLabel } from "../constants";

// The server broadcasts secretWord identically to every client, including
// the guesser — hiding it from the guesser is a client-side honor-system
// concern, same as the physical stand-cards in the board game this is
// based on. Never render the guesser's own screen with the word visible.
function CluesList({
	clues,
	emptyLabel,
}: {
	clues: readonly { playerId: string; text: string }[];
	emptyLabel: string;
}) {
	if (clues.length === 0) {
		return <p className="text-white/40 text-sm text-center py-6">{emptyLabel}</p>;
	}
	return (
		<div className="flex flex-col gap-2">
			{clues.map((clue, i) => (
				<m.div
					key={clue.playerId}
					initial={{ opacity: 0, x: -8 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ delay: i * 0.06 }}
					className="px-5 py-3 rounded-xl border border-border bg-surface text-white text-lg font-medium text-center"
				>
					{clue.text}
				</m.div>
			))}
		</div>
	);
}

function HostView() {
	const { state, timer, getName } = useBlankSlateState();
	if (!state) return null;

	const guesserName = getName(state.guesserPlayerId);

	return (
		<div className="flex flex-col min-h-screen px-10 py-10 gap-8">
			<TimerBar timer={timer} />

			<div className="text-center">
				<p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-1">
					{roundLabel(state.roundNumber, state.totalRounds)}
				</p>
				<h1 className="text-4xl font-display font-bold text-white mb-1">
					{guesserName} is guessing
				</h1>
				<p className="text-white/40 text-sm">Secret word</p>
				<p className="text-huddle text-3xl font-display font-bold tracking-wide mt-1">
					{state.secretWord}
				</p>
			</div>

			<div className="max-w-md w-full mx-auto flex-1">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-3 text-center">
					Surviving clues
				</p>
				<CluesList
					clues={state.survivingClues ?? []}
					emptyLabel="No clues survived — every clue was a duplicate."
				/>
			</div>
		</div>
	);
}

function GuesserView() {
	const { state, timer, sendAction } = useBlankSlateState();
	const [text, setText] = useState("");
	const guessLock = useActionLock(state?.phase);
	const skipLock = useActionLock(state?.phase);

	if (!state) return <Loading />;

	const clues = state.survivingClues ?? [];
	const trimmed = text.trim();
	const isOver = trimmed.length > MAX_GUESS_LENGTH;
	const canSubmit = trimmed.length > 0 && !isOver;
	const anyLocked = guessLock.locked || skipLock.locked;

	function handleGuess() {
		if (!canSubmit) return;
		guessLock.runLocked(() => {
			sendAction({ type: "submit_guess", text: trimmed });
		});
	}

	function handleSkip() {
		skipLock.runLocked(() => {
			sendAction({ type: "skip_guess" });
		});
	}

	return (
		<div className="flex flex-col min-h-screen px-6 py-10">
			<TimerBar timer={timer} />

			<div className="flex items-center justify-between mt-4 mb-6">
				<div className="text-xs font-semibold tracking-widest uppercase text-white/40">
					{roundLabel(state.roundNumber, state.totalRounds)} · your guess
				</div>
			</div>

			<div className="flex-1 flex flex-col gap-6">
				<div>
					<p className="text-xs uppercase tracking-widest text-white/40 mb-3 text-center">
						Clues from your team
					</p>
					<CluesList
						clues={clues}
						emptyLabel="Every clue was a duplicate — nothing survived. Take your best shot."
					/>
				</div>

				<div className="flex flex-col gap-3 mt-auto">
					{/* Fix: control-has-associated-label — aria-label describes the field */}
					<input
						type="text"
						value={text}
						onChange={(e) => { setText(e.target.value); }}
						onKeyDown={(e) => {
							if (e.key === "Enter") handleGuess();
						}}
						placeholder="Your guess..."
						maxLength={MAX_GUESS_LENGTH + 20}
						aria-label="Your guess for the secret word"
						className="w-full px-4 py-3 rounded-xl bg-bg border border-border text-white text-center text-lg placeholder:text-white/30 focus:outline-none focus:border-white/40 transition-colors"
					/>
					{isOver && (
						<p className="text-red-400 text-xs text-center">
							Too long — keep it under {MAX_GUESS_LENGTH} characters.
						</p>
					)}
					<button
						type="button"
						onClick={handleGuess}
						disabled={!canSubmit || anyLocked}
						className="w-full px-5 py-3 rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
					>
						Submit guess
					</button>
					<button
						type="button"
						onClick={handleSkip}
						disabled={anyLocked}
						className="w-full px-5 py-2.5 rounded-lg bg-transparent border border-border text-white/50 text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97] transition-all"
					>
						Skip this round
					</button>
				</div>
			</div>
		</div>
	);
}

function WriterWaitingView() {
	const { state, getName } = useBlankSlateState();
	if (!state) return null;

	const guesserName = getName(state.guesserPlayerId);
	const clues = state.survivingClues ?? [];

	return (
		<div className="flex flex-col items-center min-h-screen px-6 py-14 gap-8">
			<div className="text-center">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-2">
					{roundLabel(state.roundNumber, state.totalRounds)}
				</p>
				<h1 className="text-2xl font-display font-bold text-white">
					{guesserName} is guessing...
				</h1>
			</div>

			<div className="w-full max-w-sm">
				<p className="text-xs uppercase tracking-widest text-white/40 mb-3 text-center">
					Surviving clues
				</p>
				<CluesList
					clues={clues}
					emptyLabel="No clues survived — every clue was a duplicate."
				/>
			</div>
		</div>
	);
}

export function Guessing() {
	const { state, role, amGuesser } = useBlankSlateState();
	if (!state) return <Loading />;
	if (role === "host") return <HostView />;
	if (amGuesser) return <GuesserView />;
	return <WriterWaitingView />;
}
