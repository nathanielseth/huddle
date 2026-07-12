import { AnimatePresence, m } from "motion/react";
import { useCybsecsState } from "./hooks/useCybsecsState";
import { RoleHud } from "./components/RoleHud";
import { RoleReveal } from "./phases/RoleReveal";
import { Talking } from "./phases/Talking";
import { Nominating } from "./phases/Nominating";
import { Voting } from "./phases/Voting";
import { Mission } from "./phases/Mission";
import { MissionResult } from "./phases/MissionResult";
import { Doxxing } from "./phases/Doxxing";
import { GameOver } from "./phases/GameOver";
import type { CybsecsPhase } from "@shared/games/cybersecs";
import type { FC } from "react";

const PHASES: Record<CybsecsPhase, FC> = {
	role_reveal: RoleReveal,
	talking: Talking,
	nominating: Nominating,
	voting: Voting,
	mission: Mission,
	mission_result: MissionResult,
	doxxing: Doxxing,
	game_over: GameOver,
};

const HIDE_HUD: Set<CybsecsPhase> = new Set(["role_reveal", "game_over"]);

export function Cybersecs() {
	const { game, role, secret, getName } = useCybsecsState();

	if (!game) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	const Component = PHASES[game.phase];

	const phaseKey =
		game.phase === "mission_result"
			? `mission_result-${game.missionIndex}`
			: game.phase;

	const showHud = role === "player" && !!secret && !HIDE_HUD.has(game.phase);

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

			{showHud && <RoleHud secret={secret} getName={getName} />}
		</div>
	);
}