import type { Server } from "socket.io";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../../shared/events.js";
import type { GameEngine, EngineResult, GameContext } from "./engine.js";
import type { RoomStore } from "../room/rooms.js";
import { type Room, getPublicState, touchRoom } from "../room/rooms.js";
import type { GameTimer } from "../../../shared/types.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export class EngineRunner {
	private readonly engines = new Map<string, GameEngine>();
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

	register(engine: GameEngine): void {
		this.engines.set(engine.gameId, engine);
		console.log(`[engine] registered ${engine.gameId}`);
	}

	startGame(room: Room, io: IO, store: RoomStore): boolean {
		const engine = this.resolveEngine(room.gameId);
		if (!engine) return false;

		room.gamePayload = engine.getInitialState();
		room.phase = "in_game";

		const result = engine.onStart({ room });
		this.applyResult(result, room, io, store);
		return true;
	}

	// called by player_action
	handleAction(
		room: Room,
		playerId: string,
		action: unknown,
		io: IO,
		store: RoomStore,
	): void {
		const engine = this.resolveEngine(room.gameId);
		if (!engine || room.phase !== "in_game") return;

		const result = engine.onAction({ room }, playerId, action);
		this.applyResult(result, room, io, store);
	}

	// cancel any live timer for a room
	cancelTimer(roomCode: string): void {
		const handle = this.timers.get(roomCode);
		if (handle !== undefined) {
			clearTimeout(handle);
			this.timers.delete(roomCode);
		}
	}

	// private helpers

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
		// Apply score changes first so the broadcast reflects them.
		if (result.scoreDeltas) {
			for (const [playerId, delta] of Object.entries(result.scoreDeltas)) {
				const player = room.players.get(playerId);
				if (player) player.score += delta;
			}
		}

		room.gamePayload = result.gamePayload;
		room.timer = result.timer;

		if (result.roomPhase) {
			room.phase = result.roomPhase;
		}

		this.cancelTimer(room.code);
		if (result.timer) {
			this.scheduleTimer(result.timer, room, io, store);
		}

		touchRoom(room);
		io.to(room.code).emit("game_state", getPublicState(room));
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
			if (!engine) return;

			// guard: room may have been deleted while timer was pending.
			if (!store.get(room.code)) return;

			const result = engine.onTimerExpired({ room });
			this.applyResult(result, room, io, store);
		}, delay);

		this.timers.set(room.code, handle);
	}
}
