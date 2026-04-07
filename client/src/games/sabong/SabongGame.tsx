import { useGameStore } from "../../store/useGameStore";
import { useSabongState } from "./useSabongState";
import { PreTournamentPlayer, PreTournamentHost } from "./phases/PreTournament";

export function SabongGame() {
	const role = useGameStore((s) => s.role);
	const { sabong } = useSabongState();

	if (!sabong) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	if (sabong.phase === "pre_tournament") {
		return role === "host" ? <PreTournamentHost /> : <PreTournamentPlayer />;
	}

	// betting, fighting, payout, finished - placeholders for now
	return (
		<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
			Phase: {sabong.phase}
		</div>
	);
}
