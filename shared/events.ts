import type { GameState } from "./types";

export interface ServerToClientEvents {
	game_state: (state: GameState) => void;
	room_error: (message: string) => void;
}

export interface ClientToServerEvents {
	create_room: (payload: {
		gameId: string;
		playerName: string;
		playerId: string;
	}) => void;

	join_room: (payload: {
		code: string;
		name: string;
		playerId: string;
	}) => void;

	leave_room: () => void;
}
