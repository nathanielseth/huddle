import { useGameStore } from "../../../store/useGameStore";
import type { SabongState, ManokView } from "@shared/sabong";

export function useSabongState() {
	const gamePayload = useGameStore((s) => s.gamePayload);
	const playerId = useGameStore((s) => s.playerId);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);

	const sabong = gamePayload as SabongState | null;

	const myPlayer = sabong?.players[playerId] ?? null;
	const slot = sabong ? sabong.bracket[sabong.currentMatchIndex] : null;
	const fighter1 = slot?.fighter1Id
		? (sabong?.manoks[slot.fighter1Id] ?? null)
		: null;
	const fighter2 = slot?.fighter2Id
		? (sabong?.manoks[slot.fighter2Id] ?? null)
		: null;

	const manokList: ManokView[] = sabong ? Object.values(sabong.manoks) : [];

	const lockedCount = sabong
		? Object.values(sabong.players).filter(
				(p) => p.betLocked || p.bracketPickId,
			).length
		: 0;

	return {
		sabong,
		myPlayer,
		slot,
		fighter1,
		fighter2,
		manokList,
		lockedCount,
		playerId,
		players,
		timer,
	};
}
