import type { z } from "zod";
import type { GameTimer, RoomPhase } from "../../../shared/core/room";
import type { Room } from "../room/registry";

export type Awaitable<T> = T | Promise<T>;

export interface GameContext {
	readonly room: Readonly<Room>;
}

export interface EngineResult {
	serverPayload: unknown;
	publicPayload: unknown;
	timer: GameTimer | null;
	roomPhase?: RoomPhase;
	scoreDeltas?: Record<string, number>;
	privatePayloads?: Map<string, unknown>;
}

export interface GameEngine {
	readonly gameId: string;
	readonly actionSchema?: z.ZodTypeAny;
	readonly configActionSchema?: z.ZodTypeAny;
	readonly applyConfigAction?: (
		currentPayload: unknown,
		action: unknown,
		senderPlayerId: string,
		senderIsHost: boolean,
	) => unknown;
	readonly buildGameConfig?: (
		configPayload: unknown,
		playerIds: string[],
	) => unknown;
	readonly supportsCpuSeats?: boolean;
	readonly getMaxSeats?: (configPayload: unknown) => number;
	readonly validateStart?: (
		configPayload: unknown,
		playerIds: string[],
	) => string | null;

	readonly onPlayerRemoved?: (
		configPayload: unknown,
		remainingPlayerIds: string[],
	) => unknown;
	getInitialState(): unknown;
	onAction(
		ctx: GameContext,
		playerId: string,
		action: unknown,
	): Awaitable<EngineResult>;
	onTimerExpired(ctx: GameContext): Awaitable<EngineResult>;
	onStart(ctx: GameContext): Awaitable<EngineResult>;
}

export interface GameEngineWithSecrets extends GameEngine {
	getPlayerSecret(ctx: GameContext, playerId: string): Awaitable<unknown>;
}

export interface GameEngineWithCpuSeats extends GameEngine {
	isCpuSeat(ctx: GameContext, playerId: string): boolean;
	getCpuSeatToAct(ctx: GameContext): string | null;
	actForCpuSeat(ctx: GameContext, playerId: string): Awaitable<EngineResult>;
}

export function hasCpuSeats(
	engine: GameEngine,
): engine is GameEngineWithCpuSeats {
	return (
		"getCpuSeatToAct" in engine &&
		typeof (engine as GameEngineWithCpuSeats).getCpuSeatToAct === "function"
	);
}