import { useGameStore } from "../../../app/store";
import { socket } from "../../../lib/network/socket";
import type {
	BelievableLiesState,
	BelievableLiesAction,
} from "@shared/games/believable-lies/index";
import type { Player, GameTimer } from "@shared/core/room";

export interface BelievableLiesStateResult {
	state: BelievableLiesState | null;
	playerId: string;
	isHost: boolean;
	players: Player[];
	timer: GameTimer | null;
	myPlayer: BelievableLiesState["players"][string] | null;
	getName: (id: string) => string;
	sendAction: (action: BelievableLiesAction) => void;
}

function sendAction(action: BelievableLiesAction): void {
	if (useGameStore.getState().role === "host") return;
	socket.emit("player_action", action);
}

export function useBelievableLiesState(): BelievableLiesStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const state = useGameStore(
		(s) => s.gamePayload,
	) as BelievableLiesState | null;

	const isHost = role === "host";
	const myPlayer = isHost ? null : (state?.players[playerId] ?? null);

	const getName = (id: string) => players.find((p) => p.id === id)?.name ?? id;

	return {
		state,
		playerId,
		isHost,
		players,
		timer,
		myPlayer,
		getName,
		sendAction,
	};
}