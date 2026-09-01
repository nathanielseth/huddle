import { AnimatePresence, m } from "motion/react";
import { useWitzoneState } from "./hooks/useWitzoneState";
import { Answering } from "./phases/Answering";
import { VotingPrompt } from "./phases/VotingPrompt";
import { RoundEnd } from "./phases/RoundEnd";
import { FinalAnswering } from "./phases/FinalAnswering";
import { FinalVoting } from "./phases/FinalVoting";
import { Finished } from "./phases/Finished";
import type { WitzonePhase } from "@shared/games/witzone/index";
import type { FC } from "react";

const PHASES: Record<WitzonePhase, FC> = {
	answering: Answering,
	voting_prompt: VotingPrompt,
	round_end: RoundEnd,
	final_answering: FinalAnswering,
	final_voting: FinalVoting,
	finished: Finished,
};

// answering phases key per round, voting_prompt keys per round+prompt+stage, everything else by phase name
function phaseKey(
	phase: WitzonePhase,
	round: number,
	promptIndex: number,
	promptStage: string,
): string {
	if (phase === "answering" || phase === "final_answering")
		return `${phase}-${round}`;
	if (phase === "voting_prompt")
		return `${phase}-${round}-${promptIndex}-${promptStage}`;
	return phase;
}

export function Witzone() {
	const { state } = useWitzoneState();

	if (!state) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading...
			</div>
		);
	}

	const Component = PHASES[state.phase];
	const key = phaseKey(
		state.phase,
		state.round,
		state.currentPromptIndex,
		state.promptStage,
	);

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