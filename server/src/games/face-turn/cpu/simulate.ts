import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { Room, RoomPlayer, RoomSpectator } from "../../../room/registry";
import type { GameContext } from "../../../engine/GameEngine";
import { faceturnsEngine } from "../index";
import type { FaceturnServerState } from "../types";
import { cloneServerState } from "./determinize";
import { runInSimulationMode } from "../state-builders";

const SIM_TIMER_DURATION_MS = 30_000;

const roomPlayersCache = new Map<string, ReadonlyMap<string, RoomPlayer>>();
const ROOM_PLAYERS_CACHE_MAX = 256;
const EMPTY_SPECTATORS = new Map<string, RoomSpectator>();

function roomPlayersFor(
	seatIds: readonly string[],
): ReadonlyMap<string, RoomPlayer> {
	const key = seatIds.join(",");
	const cached = roomPlayersCache.get(key);
	if (cached) return cached;

	const players = new Map<string, RoomPlayer>();
	for (const seatId of seatIds) {
		players.set(seatId, {
			playerId: seatId,
			socketId: "",
			name: seatId,
			score: 0,
			isConnected: true,
			isCpu: false,
		});
	}
	if (roomPlayersCache.size >= ROOM_PLAYERS_CACHE_MAX) {
		// evict the oldest entry (Map preserves insertion order)
		const oldestKey = roomPlayersCache.keys().next().value;
		if (oldestKey !== undefined) roomPlayersCache.delete(oldestKey);
	}
	roomPlayersCache.set(key, players);
	return players;
}

// builds a throwaway Room/GameContext for one engine call
function makeSimRoom(state: FaceturnServerState): Room {
	const seatIds = [...state.players.keys()];
	return {
		code: "SIM",
		hostPlayerId: seatIds[0] ?? "",
		hostSocketId: "",
		players: roomPlayersFor(seatIds) as Map<string, RoomPlayer>,
		spectators: EMPTY_SPECTATORS,
		phase: "in_game",
		gameId: faceturnsEngine.gameId,
		createdAt: 0,
		lastActiveAt: 0,
		gamePayload: state,
		publicPayload: null,
		configPayload: null,
		gameConfig: null,
		timer: { startsAt: Date.now(), duration: SIM_TIMER_DURATION_MS },
		pausedTimerRemaining: null,
		pauseReason: null,
		hostReconnectDeadline: null,
	};
}

// applies action on a clone so callers can branch from the same parent state
export function applyAction(
	state: FaceturnServerState,
	seat: string,
	action: FaceturnsAction,
): FaceturnServerState {
	const working = cloneServerState(state);
	const ctx: GameContext = { room: makeSimRoom(working) };

	const result = runInSimulationMode(() =>
		faceturnsEngine.onAction(ctx, seat, action),
	);
	// ismcts needs thousands of sync calls; the engine must stay synchronous
	// fail loudly if it ever becomes async
	if (result instanceof Promise) {
		throw new Error(
			"[face-turn cpu] faceturnsEngine.onAction returned a Promise — " +
				"simulate.ts requires a synchronous engine for ISMCTS performance.",
		);
	}

	return result.serverPayload as FaceturnServerState;
}

// drives timer expiry on a clone; used when the search determines no one will respond
export function applyTimerExpired(
	state: FaceturnServerState,
): FaceturnServerState {
	const working = cloneServerState(state);
	const ctx: GameContext = { room: makeSimRoom(working) };

	const result = runInSimulationMode(() => faceturnsEngine.onTimerExpired(ctx));
	if (result instanceof Promise) {
		throw new Error(
			"[face-turn cpu] faceturnsEngine.onTimerExpired returned a Promise — " +
				"simulate.ts requires a synchronous engine for ISMCTS performance.",
		);
	}

	return result.serverPayload as FaceturnServerState;
}

// terminal when phase is "finished"; the engine sets this after checkWinConditions, not roomPhase
export function isTerminal(state: FaceturnServerState): boolean {
	return state.phase === "finished";
}