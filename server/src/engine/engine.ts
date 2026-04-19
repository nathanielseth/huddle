import type { GameTimer, RoomPhase } from "../../../shared/types.js";
import type { Room } from "../room/rooms.js";

export interface GameContext {
	readonly room: Readonly<Room>;
}

// what the engine hands back after processing any event
export interface EngineResult {
	serverPayload: unknown; // stored in room.gamePayload
	publicPayload: unknown; // goes into broadcast
	timer: GameTimer | null;
	roomPhase?: RoomPhase;
	scoreDeltas?: Record<string, number>;
	privatePayloads?: Map<string, unknown>;
}

// the contract every game module must satisfy
export interface GameEngine {
	readonly gameId: string;

	// fresh game-specific state, before onstart is called.
	getInitialState(): unknown;

	onStart(ctx: GameContext): EngineResult;

	// a player acted
	onAction(ctx: GameContext, playerId: string, action: unknown): EngineResult;

	// the active timer expired
	onTimerExpired(ctx: GameContext): EngineResult;
}

export interface GameEngineWithSecrets extends GameEngine {
	getPlayerSecret(ctx: GameContext, playerId: string): unknown | null;
}
