import { AnimatePresence, motion } from "motion/react";
import { useSussyState } from "./hooks/useSussyState";
import { CategorySelect } from "./phases/CategorySelect";
import { RoleReveal } from "./phases/RoleReveal";
import { TaskPerform } from "./phases/TaskPerform";
import { Voting } from "./phases/Voting";
import { RoundResult } from "./phases/RoundResult";
import { Finished } from "./phases/Finished";
import type { SussyPhase } from "@shared/sussy";
import type { FC } from "react";

const PHASES: Record<SussyPhase, FC> = {
	category_select: CategorySelect,
	role_reveal: RoleReveal,
	task_perform: TaskPerform,
	voting: Voting,
	round_result: RoundResult,
	finished: Finished,
};

export function SussyGame() {
	const { sussy } = useSussyState();

	if (!sussy) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	const Component = PHASES[sussy.phase];

	// Key strategy:
	// - Most phases key by phase name (remount on phase change)
	// - task_perform for glitch keys by taskNumber too (handled inside TaskPerform)
	// - round_result keys by roundNumber so RoundResult remounts fresh each round,
	//   allowing its useEffect timers to start from step 0 without a synchronous setState reset
	const phaseKey =
		sussy.phase === "round_result"
			? `round_result-${sussy.roundNumber}`
			: sussy.phase;

	return (
		<div className="relative w-full min-h-screen bg-bg overflow-hidden">
			<AnimatePresence mode="wait">
				<motion.div
					key={phaseKey}
					className="w-full min-h-screen"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -10 }}
					transition={{ duration: 0.18 }}
				>
					<Component />
				</motion.div>
			</AnimatePresence>
		</div>
	);
}
