import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { Room, RoomPlayer } from "../../../room/registry";
import type { GameContext } from "../../../engine/GameEngine";
import { faceturnsEngine } from "../index";
import type { FaceturnServerState } from "../types";
import { cloneServerState } from "./determinize";

const SIM_TIMER_DURATION_MS = 30_000;

let cachedRoom: Room | null = null;
let cachedSeatsKey = "";

function seatIdsOf(state: FaceturnServerState): string[] {
	return [...state.players.keys()];
}

function getSimRoom(
	state: FaceturnServerState,
	seatIds: readonly string[],
): Room {
	const seatsKey = seatIds.join(",");
	if (cachedRoom && cachedSeatsKey === seatsKey) {
		cachedRoom.gamePayload = state;
		return cachedRoom;
	}

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

	cachedRoom = {
		code: "SIM",
		hostPlayerId: seatIds[0] ?? "",
		hostSocketId: "",
		players,
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
	cachedSeatsKey = seatsKey;
	return cachedRoom;
}

// applies action on a clone so callers can branch from the same parent state
export function applyAction(
	state: FaceturnServerState,
	seat: string,
	action: FaceturnsAction,
): FaceturnServerState {
	const working = cloneServerState(state);
	const room = getSimRoom(working, seatIdsOf(working));
	const ctx: GameContext = { room };

	const result = faceturnsEngine.onAction(ctx, seat, action);
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
	const room = getSimRoom(working, seatIdsOf(working));
	const ctx: GameContext = { room };

	const result = faceturnsEngine.onTimerExpired(ctx);
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