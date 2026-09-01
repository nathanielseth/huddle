import { AnimatePresence, m } from "motion/react";
import { useBelievableLiesState } from "./hooks/useBelievableLiesState";
import { QuestionSelect } from "./phases/QuestionSelect";
import { LieInput } from "./phases/LieInput";
import { Picking } from "./phases/Picking";
import { Result } from "./phases/Result";
import { RoundEnd } from "./phases/RoundEnd";
import { Finished } from "./phases/Finished";
import type { BelievableLiesPhase } from "@shared/games/believable-lies/index";
import type { FC } from "react";

const PHASES: Record<BelievableLiesPhase, FC> = {
	question_select: QuestionSelect,
	lie_input: LieInput,
	picking: Picking,
	result: Result,
	round_end: RoundEnd,
	finished: Finished,
};

const QUESTION_SCOPED_PHASES = new Set<BelievableLiesPhase>([
	"lie_input",
	"picking",
	"result",
]);

export function BelievableLiesPlayer() {
	const { state } = useBelievableLiesState();

	if (!state) return null;

	const Component = PHASES[state.phase];

	const phaseKey = QUESTION_SCOPED_PHASES.has(state.phase)
		? `${state.phase}-r${state.roundNumber}-q${state.questionIndex}`
		: state.phase;

	return (
		<AnimatePresence mode="wait">
			<m.div
				key={phaseKey}
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: -10 }}
				transition={{ duration: 0.18 }}
			>
				<Component />
			</m.div>
		</AnimatePresence>
	);
}