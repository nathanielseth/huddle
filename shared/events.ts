import type { GameState } from "./types";

export interface ServerToClientEvents {
	game_state: (state: GameState) => void;
	room_error: (message: string) => void;
	room_closed: () => void;
	rejoin_failed: () => void;
}

export interface ClientToServerEvents {
	create_room: (payload: { gameId: string; playerId: string }) => void;

	join_room: (payload: {
		code: string;
		name: string;
		playerId: string;
	}) => void;

	rejoin_room: (payload: {
		code: string;
		playerId: string;
		role: "host" | "player";
	}) => void;

	leave_room: () => void;
}
