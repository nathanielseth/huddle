import type { GameState } from "./room";
import type { ChatMessage } from "./chat";

export interface ServerToClientEvents {
	game_state: (state: GameState) => void;
	room_error: (message: string) => void;
	room_closed: () => void;
	room_abandoned: (message: string) => void;
	kicked: () => void;
	rejoin_failed: () => void;
	player_secret: (payload: unknown) => void;
	// per-player rejection for their own game action, distinct from room_error
	action_rejected: (message: string) => void;
	joined_as_spectator: (payload: { reason: "room_full" | "requested" }) => void;
	// room chat, outside game engine, never routed through it
	chat_message: (message: ChatMessage) => void;
	// sent once to the newly joined socket for scrollback
	chat_history: (messages: ChatMessage[]) => void;
}

export interface ClientToServerEvents {
	create_room: (payload: { gameId: string; playerId: string }) => void;
	join_room: (payload: {
		code: string;
		name: string;
		playerId: string;
	}) => void;
	spectate_room: (payload: { code: string; name?: string }) => void;
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
	add_cpu_seat: () => void;
	remove_cpu_seat: (payload: { playerId: string }) => void;
	send_chat_message: (payload: { text: string }) => void;
}