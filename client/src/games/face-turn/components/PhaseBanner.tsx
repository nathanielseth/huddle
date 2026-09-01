import type { FaceturnsPhase } from "@shared/games/face-turn/types";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { PhaseTimer } from "./PhaseTimer";

// compile-time exhaustiveness check for new phases
const PHASE_LABEL: Record<FaceturnsPhase, string> = {
	drafting: "Drafting",
	mulligan: "Mulligan",
	rps: "Rock Paper Scissors",
	rps_reveal: "Rock Paper Scissors",
	rps_order_choice: "Rock Paper Scissors",
	active_turn: "Active Turn",
	move_chain_window: "Move Chain",
	challenge_window: "Challenge Window",
	defend_window: "Defend Window",
	defend_declared: "Defend Declared",
	defend_challenge_window: "Defend Challenge",
	finished: "Game Over",
};

export function PhaseBanner() {
	const { ft, playerMap } = useFaceturnState();
	if (!ft) return null;

	const activeName = ft.turn
		? (playerMap[ft.turn.activePlayerId]?.name ?? ft.turn.activePlayerId)
		: null;

	return (
		<div className="flex items-center justify-between px-4 py-1.5 border-b border-white/10">
			<div className="flex items-center gap-3">
				<span className="ft-eyebrow text-xs text-white/60">
					{PHASE_LABEL[ft.phase] ?? ft.phase}
				</span>
				{ft.turn && (
					<span className="ft-eyebrow text-[10px] text-white/30 tabular-nums">
						Turn {ft.turn.turnNumber} · Round {ft.roundNumber}
					</span>
				)}
			</div>
			<div className="flex items-center gap-3">
				{activeName && ft.phase === "active_turn" && (
					<span className="ft-eyebrow text-xs text-white/45">
						<span className="text-white/80">{activeName}</span>'s turn
					</span>
				)}
				<PhaseTimer />
			</div>
		</div>
	);
}