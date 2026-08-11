export type RoomPhase = "lobby" | "in_game" | "paused" | "ended";

export type PauseReason = "manual" | "host_disconnected";

// client-only
export type ConnectionStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "disconnected"
	| "error";

export interface Player {
	id: string;
	name: string;
	score: number;
	isConnected: boolean;
	isCpu: boolean;
}

export interface GameTimer {
	startsAt: number;
	duration: number;
}

export interface GameState {
	roomCode: string;
	gameId: string | null;
	phase: RoomPhase;
	players: Player[];
	timer: GameTimer | null;
	gamePayload: unknown; // typed per-game, cast where used
	configPayload: unknown;
	pauseReason?: PauseReason;
	hostReconnectDeadline?: number | null;
}