export type RoomPhase = "lobby" | "in_game" | "ended";


// client-only
export type ConnectionStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "disconnected"
	| "error";

// room-level player
export interface Player {
	id: string;
	name: string;
	score: number;
	isConnected: boolean;
}

export interface GameTimer {
	startsAt: number; // server timestamp when phase began
	duration: number; // ms
}

// broadcast on every change
export interface GameState {
	roomCode: string;
	gameId: string | null;
	phase: RoomPhase;
	players: Player[];
	timer: GameTimer | null;
	gamePayload: unknown; // typed per-game, cast where used
}
