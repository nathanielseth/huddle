export type GamePhase = "lobby" | "answering" | "voting" | "results" | "podium";

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
}

export interface GameState {
	roomCode: string;
	gameId: string | null;
	phase: GamePhase;
	players: Player[];
}
