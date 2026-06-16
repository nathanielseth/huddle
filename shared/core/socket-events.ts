import type { GameState } from "./room";

export interface ServerToClientEvents {
	game_state: (state: GameState) => void;
	room_error: (message: string) => void;
	room_closed: () => void;
	room_abandoned: (message: string) => void;
	kicked: () => void;
	rejoin_failed: () => void;
	player_secret: (payload: unknown) => void;
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
	start_game: () => void;
	player_action: (payload: unknown) => void;
	pause_game: () => void;
	resume_game: () => void;
	kick_player: (payload: { playerId: string }) => void;
}