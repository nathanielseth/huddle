import { AnimatePresence, m } from "motion/react";
import { useSquadoodleState } from "./hooks/useSquadoodleState";
import { PromptWriting } from "./phases/PromptWriting";
import { Drawing } from "./phases/Drawing";
import { Guessing } from "./phases/Guessing";
import { Reveal } from "./phases/Reveal";
import { Accolades } from "./phases/Accolades";
import type { SquadoodlePhase } from "@shared/games/squadoodle/index";
import type { FC } from "react";

const PHASES: Record<SquadoodlePhase, FC> = {
	prompt_writing: PromptWriting,
	drawing: Drawing,
	guessing: Guessing,
	reveal: Reveal,
	accolades: Accolades,
};

export function Squadoodle() {
	const { game } = useSquadoodleState();

	if (!game) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	const Component = PHASES[game.phase];

	// Key drawing/guessing phases per-step so the component fully remounts when
	// moving from drawing → guessing → drawing, resetting all local state
	// (canvas strokes, text input, submitted flag) cleanly.
	const phaseKey =
		game.phase === "drawing" || game.phase === "guessing"
			? `${game.phase}-${game.step}`
			: game.phase;

	return (
		<div className="relative w-full min-h-screen bg-bg overflow-hidden">
			<AnimatePresence mode="wait">
				<m.div
					key={phaseKey}
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
