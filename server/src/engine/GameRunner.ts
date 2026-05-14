import type {
	GameEngine,
	GameEngineWithSecrets,
	EngineResult,
} from "./GameEngine.js";
import { getPublicState, touchRoom, type Room } from "../room/registry.js";
import type { RoomRegistry } from "../room/registry.js";
import type { GameTimer } from "../../../shared/types.js";
import type { IO } from "../types.js";
import { parseEngineResult, parsePlayerAction } from "./schemas.js";

export class GameRunner {
	private readonly engines = new Map<string, GameEngine>();
	private readonly timers = new Map<string, NodeJS.Timeout>();
	private readonly roomQueues = new Map<string, Promise<void>>();

	register(engine: GameEngine): void {
		this.engines.set(engine.gameId, engine);
		console.log(`[engine] registered ${engine.gameId}`);
	}

	hasEngine(gameId: string | null): boolean {
		return gameId !== null && this.engines.has(gameId);
	}

	get timerCount(): number {
		return this.timers.size;
	}

	get queueSize(): number {
		return this.roomQueues.size;
	}

	clearQueue(roomCode: string): void {
		this.roomQueues.delete(roomCode);
	}

	private async executeSafely(
		roomCode: string,
		io: IO,
		store: RoomRegistry,
		task: () => Promise<EngineResult> | EngineResult,
		onSuccess: (result: EngineResult) => void,
	): Promise<void> {
		const previousTask = this.roomQueues.get(roomCode) ?? Promise.resolve();

		const nextTask = previousTask
			.then(async () => {
				if (!store.get(roomCode)) return;
				const result = await task();
				onSuccess(result);
			})
			.catch((error: unknown) => {
				console.error(`[engine] CRASH in room ${roomCode}:`, error);
				io.to(roomCode).emit(
					"room_error",
					"The game encountered an internal error.",
				);
			});

		this.roomQueues.set(roomCode, nextTask);

		nextTask.finally(() => {
			if (this.roomQueues.get(roomCode) === nextTask) {
				this.roomQueues.delete(roomCode);
			}
		});
	}

	startGame(room: Room, io: IO, store: RoomRegistry): void {
		const engine = this.resolveEngine(room.gameId);
		if (!engine) return;

		room.gamePayload = engine.getInitialState();
		room.phase = "in_game";

		this.executeSafely(
			room.code,
			io,
			store,
			() => engine.onStart({ room }),
			(result) => this.applyResult(result, engine.gameId, room, io, store),
		);
	}

	handleAction(
		room: Room,
		playerId: string,
		action: unknown,
		io: IO,
		store: RoomRegistry,
	): void {
		const engine = this.resolveEngine(room.gameId);
		if (!engine || room.phase !== "in_game") return;

		const validatedAction = engine.actionSchema
			? parsePlayerAction(engine.actionSchema, action, engine.gameId)
			: action;

		if (engine.actionSchema && validatedAction === null) return;

		this.executeSafely(
			room.code,
			io,
			store,
			() => engine.onAction({ room }, playerId, validatedAction),
			(result) => this.applyResult(result, engine.gameId, room, io, store),
		);
	}

	cancelTimer(roomCode: string): void {
		const handle = this.timers.get(roomCode);
		if (handle) {
			clearTimeout(handle);
			this.timers.delete(roomCode);
		}
	}

	async resendSecret(room: Room, playerId: string, io: IO): Promise<void> {
		const engine = this.resolveEngine(room.gameId);
		if (!engine || !("getPlayerSecret" in engine)) return;

		try {
			const secret = await (engine as GameEngineWithSecrets).getPlayerSecret(
				{ room },
				playerId,
			);
			if (!secret) return;

			const player = room.players.get(playerId);
			if (player?.socketId) {
				io.to(player.socketId).emit("player_secret", secret);
			}
		} catch (err) {
			console.error(`[engine] error fetching secret for ${playerId}:`, err);
		}
	}

	private resolveEngine(gameId: string | null): GameEngine | null {
		if (!gameId) return null;
		return this.engines.get(gameId) ?? null;
	}

	private applyResult(
		result: EngineResult,
		engineId: string,
		room: Room,
		io: IO,
		store: RoomRegistry,
	): void {
		const validated = parseEngineResult(result, engineId);

		if (validated.scoreDeltas) {
			for (const [playerId, delta] of Object.entries(validated.scoreDeltas)) {
				const player = room.players.get(playerId);
				if (player) player.score += delta;
			}
		}

		room.gamePayload = validated.serverPayload;
		room.publicPayload = validated.publicPayload;
		if (validated.roomPhase) room.phase = validated.roomPhase;

		this.cancelTimer(room.code);
		room.timer = validated.timer;

		if (validated.timer) {
			this.scheduleTimer(validated.timer, room, io, store);
		}

		touchRoom(room);
		io.to(room.code).emit("game_state", getPublicState(room));

		if (validated.privatePayloads) {
			for (const [playerId, secret] of validated.privatePayloads) {
				const player = room.players.get(playerId);
				if (player?.socketId) {
					io.to(player.socketId).emit("player_secret", secret);
				}
			}
		}
	}

	private scheduleTimer(
		timer: GameTimer,
		room: Room,
		io: IO,
		store: RoomRegistry,
	): void {
		const delay = Math.max(timer.startsAt + timer.duration - Date.now(), 0);

		const handle = setTimeout(() => {
			this.timers.delete(room.code);
			const engine = this.resolveEngine(room.gameId);
			if (!engine || !store.get(room.code)) return;

			this.executeSafely(
				room.code,
				io,
				store,
				() => engine.onTimerExpired({ room }),
				(result) => this.applyResult(result, engine.gameId, room, io, store),
			);
		}, delay);

		this.timers.set(room.code, handle);
	}
}
