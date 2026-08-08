import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import type { Room, RoomPlayer } from "../../../room/registry";
import type { GameContext } from "../../../engine/GameEngine";
import { faceturnsEngine } from "../index";
import type { FaceturnServerState } from "../types";
import { cloneServerState } from "./determinize";

const SIM_TIMER_DURATION_MS = 30_000;

// builds a throwaway Room with every field populated
// if a future engine reads a new field, this will fail loudly instead of simulating wrong
function buildSimRoom(
	state: FaceturnServerState,
	seatIds: readonly string[],
): Room {
	const players = new Map<string, RoomPlayer>();
	for (const seatId of seatIds) {
		players.set(seatId, {
			playerId: seatId,
			socketId: "",
			name: seatId,
			score: 0,
			isConnected: true,
		});
	}

	return {
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
}

function seatIdsOf(state: FaceturnServerState): string[] {
	return [...state.players.keys()];
}

// applies action on a clone so callers (ismcts) can branch from the same parent state
export function applyAction(
	state: FaceturnServerState,
	seat: string,
	action: FaceturnsAction,
): FaceturnServerState {
	const working = cloneServerState(state);
	const room = buildSimRoom(working, seatIdsOf(working));
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
	const room = buildSimRoom(working, seatIdsOf(working));
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