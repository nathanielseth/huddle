import { useGameStore } from "../../../app/store";
import type {
	PokerState,
	PokerPlayerView,
	PokerSecret,
} from "@shared/games/poker/index";
import type { GameTimer } from "@shared/core/room";

export interface PokerStateResult {
	poker: PokerState | null;
	myPlayer: PokerPlayerView | null;
	isMyTurn: boolean;
	/** Hole cards from the last player_secret event. Null between hands. */
	holeCards: PokerSecret["holeCards"] | null;
	playerId: string;
	/** Room players array — use for display names. */
	players: { id: string; name: string; score: number }[];
	/** Room players keyed by id for O(1) name lookup. */
	playerMap: Record<string, { id: string; name: string; score: number }>;
	timer: GameTimer | null;
}

export function usePokerState(): PokerStateResult {
	const gamePayload = useGameStore((s) => s.gamePayload);
	const playerId = useGameStore((s) => s.playerId);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const secret = useGameStore((s) => s.secret);

	const poker = gamePayload as PokerState | null;
	const myPlayer = poker?.players[playerId] ?? null;
	const isMyTurn = poker?.currentPlayerId === playerId;
	const holeCards = (secret as PokerSecret | null)?.holeCards ?? null;
	const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));

	return {
		poker,
		myPlayer,
		isMyTurn,
		holeCards,
		playerId,
		players,
		playerMap,
		timer,
	};
}