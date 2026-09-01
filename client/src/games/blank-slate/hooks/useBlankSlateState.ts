import { useGameStore } from "../../../app/store";
import { socket } from "../../../lib/network/socket";
import type {
	BlankSlateState,
	BlankSlateAction,
	BlankSlatePlayerView,
} from "@shared/games/blank-slate/index";
import type { Player, GameTimer } from "@shared/core/room";

export interface BlankSlateStateResult {
	state: BlankSlateState | null;
	playerId: string;
	role: "host" | "player" | null;
	players: Player[];
	timer: GameTimer | null;
	myView: BlankSlatePlayerView | null;
	amGuesser: boolean;
	getName: (id: string) => string;
	sendAction: (action: BlankSlateAction) => void;
}

// Hoisted: closes over nothing — socket is a module-level singleton.
function sendAction(action: BlankSlateAction): void {
	socket.emit("player_action", action);
}

export function useBlankSlateState(): BlankSlateStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const state = useGameStore((s) => s.gamePayload) as BlankSlateState | null;

	const myView = state?.players[playerId] ?? null;
	const amGuesser = state?.guesserPlayerId === playerId;

	// Cannot hoist — closes over `players` from the store subscription above.
	function getName(id: string) {
		return players.find((p) => p.id === id)?.name ?? id;
	}

	return { state, playerId, role, players, timer, myView, amGuesser, getName, sendAction };
}
