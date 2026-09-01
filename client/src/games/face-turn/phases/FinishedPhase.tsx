// no own frame, PhaseScene provides it
import "../board.css";
import { useGameStore } from "../../../app/store";
import { useFaceturnState } from "../hooks/useFaceturnState";

// keys must stay in sync with the WinCondition union in shared types
const WIN_LABEL: Record<string, string> = {
	boss_hp_zero_execution: "Boss executed",
	boss_hp_zero_damage: "Boss defeated",
	void_assembly: "Void assembled",
	round_limit: "Round limit reached",
	draw: "Draw",
};

export function FinishedPhase() {
	const { ft, playerMap } = useFaceturnState();
	const leaveRoom = useGameStore((s) => s.leaveRoom);
	if (!ft || ft.phase !== "finished") return null;

	const winnerName = ft.winnerId
		? (playerMap[ft.winnerId]?.name ?? ft.winnerId)
		: null;

	return (
		<div className="flex flex-col items-center gap-4">
			<h2 className="ft-eyebrow text-4xl text-gold">Game Over</h2>
			{winnerName ? (
				<p className="text-xl font-black text-white">{winnerName} wins!</p>
			) : (
				<p className="text-xl font-black text-white/60">It's a draw</p>
			)}
			{ft.winCondition && (
				<p className="ft-eyebrow text-xs text-white/45">
					{WIN_LABEL[ft.winCondition] ?? ft.winCondition}
				</p>
			)}
			<button
				type="button"
				onClick={leaveRoom}
				className="ft-eyebrow ft-panel-ink mt-2 px-8 py-3 rounded-xl border border-white/15 hover:border-white/30 text-white/55 hover:text-white text-sm cursor-pointer transition-all active:scale-[0.98]"
			>
				Leave
			</button>
		</div>
	);
}