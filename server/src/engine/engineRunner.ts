import type { Server } from "socket.io";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../../shared/events.js";
import type {
	GameEngine,
	EngineResult,
	GameEngineWithSecrets,
} from "./engine.js";
import type { RoomStore } from "../room/rooms.js";
import { type Room, getPublicState, touchRoom } from "../room/rooms.js";
import type { GameTimer } from "../../../shared/types.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export class EngineRunner {
	private readonly engines = new Map<string, GameEngine>();
	private readonly timers = new Map<string, NodeJS.Timeout>();

	// prevents async race conditions per room
	private readonly roomQueues = new Map<string, Promise<void>>();

	register(engine: GameEngine): void {
		this.engines.set(engine.gameId, engine);
		console.log(`[engine] registered ${engine.gameId}`);
	}

	hasEngine(gameId: string | null): boolean {
		return gameId !== null && this.engines.has(gameId);
	}

	// wraps room execution in sequential queue with error boundary
	private async executeSafely(
		roomCode: string,
		io: IO,
		task: () => Promise<EngineResult> | EngineResult,
		onSuccess: (result: EngineResult) => void,
	): Promise<void> {
		const previousTask = this.roomQueues.get(roomCode) || Promise.resolve();

		const nextTask = previousTask
			.then(async () => {
				const result = await task();
				onSuccess(result);
			})
			.catch((error) => {
				// engine crashed but server survives
				console.error(`[engine] CRASH in room ${roomCode}:`, error);
				io.to(roomCode).emit(
					"room_error",
					"The game encountered an internal error.",
				);
			});

		this.roomQueues.set(roomCode, nextTask);

		// prevents memory leaks for dead rooms
		nextTask.finally(() => {
			if (this.roomQueues.get(roomCode) === nextTask) {
				this.roomQueues.delete(roomCode);
			}
		});
	}

	startGame(room: Room, io: IO, store: RoomStore): void {
		const engine = this.resolveEngine(room.gameId);
		if (!engine) return;

		room.gamePayload = engine.getInitialState();
		room.phase = "in_game";

		this.executeSafely(
			room.code,
			io,
			() => engine.onStart({ room }),
			(result) => this.applyResult(result, room, io, store),
		);
	}

	handleAction(
		room: Room,
		playerId: string,
		action: unknown,
		io: IO,
		store: RoomStore,
	): void {
		const engine = this.resolveEngine(room.gameId);
		if (!engine || room.phase !== "in_game") return;

		this.executeSafely(
			room.code,
			io,
			() => engine.onAction({ room }, playerId, action),
			(result) => this.applyResult(result, room, io, store),
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
			console.error(`[engine] Error fetching secret for ${playerId}:`, err);
		}
	}

	private resolveEngine(gameId: string | null): GameEngine | null {
		if (!gameId) return null;
		return this.engines.get(gameId) ?? null;
	}

	private applyResult(
		result: EngineResult,
		room: Room,
		io: IO,
		store: RoomStore,
	): void {
		// apply score changes
		if (result.scoreDeltas) {
			for (const [playerId, delta] of Object.entries(result.scoreDeltas)) {
				const player = room.players.get(playerId);
				if (player) player.score += delta;
			}
		}

		// update payloads
		room.gamePayload = result.serverPayload;
		room.publicPayload = result.publicPayload;
		if (result.roomPhase) room.phase = result.roomPhase;

		// handle timers cleanly
		this.cancelTimer(room.code);
		room.timer = result.timer;

		if (result.timer) {
			this.scheduleTimer(result.timer, room, io, store);
		}

		// broadcast updated state
		touchRoom(room);
		io.to(room.code).emit("game_state", getPublicState(room));

		// send private secrets to specific players
		if (result.privatePayloads) {
			for (const [playerId, secret] of result.privatePayloads) {
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
		store: RoomStore,
	): void {
		const delay = Math.max(timer.startsAt + timer.duration - Date.now(), 0);

		const handle = setTimeout(() => {
			this.timers.delete(room.code);
			const engine = this.resolveEngine(room.gameId);
			if (!engine || !store.get(room.code)) return;

			this.executeSafely(
				room.code,
				io,
				() => engine.onTimerExpired({ room }),
				(result) => this.applyResult(result, room, io, store),
			);
		}, delay);

		this.timers.set(room.code, handle);
	}
}
