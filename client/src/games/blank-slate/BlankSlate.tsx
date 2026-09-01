import { AnimatePresence, m } from "motion/react";
import { useBlankSlateState } from "./hooks/useBlankSlateState";
import { ClueWriting } from "./phases/ClueWriting";
import { Guessing } from "./phases/Guessing";
import { Result } from "./phases/Result";
import { Finished } from "./phases/Finished";
import type { BlankSlatePhase } from "@shared/games/blank-slate/index";
import type { FC } from "react";

const PHASES: Record<BlankSlatePhase, FC> = {
	clue_writing: ClueWriting,
	guessing: Guessing,
	result: Result,
	finished: Finished,
};

export function BlankSlate() {
	const { state } = useBlankSlateState();

	if (!state) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading...
			</div>
		);
	}

	const Component = PHASES[state.phase];
	// keyed per round so each round's phases remount fresh (guesser rotates,
	// local input state must not leak across rounds); phase name keeps
	// clue_writing/guessing/result distinct within the same round.
	const key = `${state.phase}-${state.roundNumber}`;

	return (
		<div className="relative w-full min-h-screen bg-bg overflow-hidden">
			<AnimatePresence mode="wait">
				<m.div
					key={key}
					className="w-full min-h-screen"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.18 }}
				>
					<Component />
				</m.div>
			</AnimatePresence>
		</div>
	);
}
