import { useGameStore } from "../../app/store";
import { usePokerState } from "./hooks/usePokerState";
import { PokerTableHost } from "./PokerTableHost";
import { PokerTablePlayer } from "./PokerTablePlayer";

export function Poker() {
	const role = useGameStore((s) => s.role);
	const { poker } = usePokerState();

	if (!poker) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	return role === "host" ? <PokerTableHost /> : <PokerTablePlayer />;
}