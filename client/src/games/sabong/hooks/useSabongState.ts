import { useGameStore } from "../../../app/store";
import type {
	SabongState,
	SabongPrivateView,
	ManokView,
} from "@shared/games/sabong/index";

export function useSabongState() {
	const gamePayload = useGameStore((s) => s.gamePayload);
	const playerSecret = useGameStore((s) => s.secret);
	const playerId = useGameStore((s) => s.playerId);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);

	const sabong = gamePayload as SabongState | null;
	const privateData = playerSecret as SabongPrivateView | null;

	const myPlayer = sabong?.players[playerId] ?? null;
	const myBracketPickId =
		myPlayer?.bracketPickId ?? privateData?.myPendingBracketPick ?? null;
	const myBet = myPlayer?.currentBet ?? privateData?.myPendingBet ?? null;
	const slot = sabong ? sabong.bracket[sabong.currentMatchIndex] : null;

	const fighter1 = slot?.fighter1Id
		? (sabong?.manoks[slot.fighter1Id] ?? null)
		: null;
	const fighter2 = slot?.fighter2Id
		? (sabong?.manoks[slot.fighter2Id] ?? null)
		: null;

	const manokList: ManokView[] = sabong ? Object.values(sabong.manoks) : [];

	return {
		sabong,
		privateData,
		myPlayer,
		myBracketPickId,
		myBet,
		slot,
		fighter1,
		fighter2,
		manokList,
		playerId,
		players,
		timer,
	};
}