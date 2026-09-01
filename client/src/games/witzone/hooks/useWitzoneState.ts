import { useGameStore } from "../../../app/store";
import { socket } from "../../../lib/network/socket";
import type {
	WitzoneState,
	WitzoneAction,
	WitzonePlayerSecret,
} from "@shared/games/witzone/index";
import type { Player, GameTimer } from "@shared/core/room";

export interface WitzoneStateResult {
	state: WitzoneState | null;
	playerId: string;
	role: "host" | "player" | null;
	players: Player[];
	timer: GameTimer | null;
	secret: WitzonePlayerSecret | null;
	getName: (id: string) => string;
	sendAction: (action: WitzoneAction) => void;
}

// Hoisted: closes over nothing — socket is a module-level singleton.
function sendAction(action: WitzoneAction): void {
	socket.emit("player_action", action);
}

export function useWitzoneState(): WitzoneStateResult {
	const playerId = useGameStore((s) => s.playerId);
	const role = useGameStore((s) => s.role);
	const players = useGameStore((s) => s.players);
	const timer = useGameStore((s) => s.timer);
	const state = useGameStore((s) => s.gamePayload) as WitzoneState | null;
	const secret = useGameStore((s) => s.secret) as WitzonePlayerSecret | null;

	// Cannot hoist — closes over `players` from the store subscription above.
	function getName(id: string) {
		return players.find((p) => p.id === id)?.name ?? id;
	}

	return { state, playerId, role, players, timer, secret, getName, sendAction };
}