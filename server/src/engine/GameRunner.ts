import type {
	GameEngine,
	GameEngineWithSecrets,
	EngineResult,
} from "./GameEngine";
import { getPublicState, touchRoom, type Room } from "../room/registry";
import type { RoomRegistry } from "../room/registry";
import type { GameTimer, PauseReason } from "../../../shared/core/room";
import type { IO } from "../types";
import { parseEngineResult, parsePlayerAction } from "./schemas";

export class GameRunner {
	private readonly engines = new Map<string, GameEngine>();
	private readonly timers = new Map<string, NodeJS.Timeout>();
	private readonly roomQueues = new Map<string, Promise<void>>();
	private readonly hostReconnectTimers = new Map<string, NodeJS.Timeout>();

	private static readonly HOST_RECONNECT_MS = 5 * 60 * 1_000;

	register(engine: GameEngine): void {
		this.engines.set(engine.gameId, engine);
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

	private executeSafely(
		roomCode: string,
		io: IO,
		store: RoomRegistry,
		task: () => Promise<EngineResult> | EngineResult,
		onSuccess: (result: EngineResult) => void,
	): void {
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

		void nextTask.finally(() => {
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
			(result) => { this.applyResult(result, engine.gameId, room, io, store); },
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
			(result) => { this.applyResult(result, engine.gameId, room, io, store); },
		);
	}

	cancelTimer(roomCode: string): void {
		const handle = this.timers.get(roomCode);
		if (handle) {
			clearTimeout(handle);
			this.timers.delete(roomCode);
		}
	}

	cancelHostReconnectTimer(roomCode: string): void {
		const handle = this.hostReconnectTimers.get(roomCode);
		if (handle) {
			clearTimeout(handle);
			this.hostReconnectTimers.delete(roomCode);
		}
	}

	pauseGame(room: Room, reason: PauseReason, io: IO): void {
		if (room.phase !== "in_game") return;
		this.pauseRoom(room, reason);
		touchRoom(room);
		io.to(room.code).emit("game_state", getPublicState(room));
	}

	resumeGame(room: Room, io: IO, store: RoomRegistry): void {
		if (room.phase !== "paused") return;
		this.resumeRoom(room, io, store);
		touchRoom(room);
		io.to(room.code).emit("game_state", getPublicState(room));
	}

	onHostDisconnect(room: Room, io: IO, store: RoomRegistry): void {
		if (room.phase === "in_game") {
			this.pauseRoom(room, "host_disconnected");
		} else if (room.phase === "paused") {
			room.pauseReason = "host_disconnected";
		} else {
			return;
		}

		room.hostReconnectDeadline = Date.now() + GameRunner.HOST_RECONNECT_MS;
		touchRoom(room);
		io.to(room.code).emit("game_state", getPublicState(room));

		const handle = setTimeout(() => {
			this.hostReconnectTimers.delete(room.code);
			if (!store.get(room.code)) return;
			io.to(room.code).emit(
				"room_abandoned",
				"Host failed to reconnect. The game has been abandoned.",
			);
			store.delete(room.code);
			console.log(`[room] ${room.code} abandoned — reconnect window expired`);
		}, GameRunner.HOST_RECONNECT_MS);

		this.hostReconnectTimers.set(room.code, handle);
	}

	onHostReconnect(room: Room, io: IO, store: RoomRegistry): void {
		this.cancelHostReconnectTimer(room.code);

		if (room.phase === "paused" && room.pauseReason === "host_disconnected") {
			this.resumeRoom(room, io, store);
		} else {
			room.hostReconnectDeadline = null;
		}

		touchRoom(room);
		io.to(room.code).emit("game_state", getPublicState(room));
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

	private pauseRoom(room: Room, reason: PauseReason): void {
		if (room.timer) {
			room.pausedTimerRemaining = Math.max(
				room.timer.startsAt + room.timer.duration - Date.now(),
				0,
			);
			this.cancelTimer(room.code);
			room.timer = null;
		}
		room.pauseReason = reason;
		room.phase = "paused";
	}

	private resumeRoom(room: Room, io: IO, store: RoomRegistry): void {
		room.phase = "in_game";
		room.pauseReason = null;
		room.hostReconnectDeadline = null;

		if (room.pausedTimerRemaining !== null) {
			const timer: GameTimer = {
				startsAt: Date.now(),
				duration: Math.max(room.pausedTimerRemaining, 500),
			};
			room.timer = timer;
			this.scheduleTimer(timer, room, io, store);
			room.pausedTimerRemaining = null;
		}
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

		// stale in-flight results must not disturb a paused room's phase or timers
		if (room.phase !== "paused") {
			if (validated.roomPhase) room.phase = validated.roomPhase;
			this.cancelTimer(room.code);
			room.timer = validated.timer;
			if (validated.timer) {
				this.scheduleTimer(validated.timer, room, io, store);
			}
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
				(result) => { this.applyResult(result, engine.gameId, room, io, store); },
			);
		}, delay);

		this.timers.set(room.code, handle);
	}
}