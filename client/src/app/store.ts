import { create } from "zustand";
import { socket } from "../lib/network/socket";
import {
	saveRoomSession,
	clearRoomSession,
	type RoomSession,
} from "../lib/network/session";
import type {
	Player,
	RoomPhase,
	GameState,
	ConnectionStatus,
	GameTimer,
	PauseReason,
} from "@shared/core/room";
import { generateUUID } from "../lib/utils/uuid";

interface GameStore {
	playerId: string;
	playerName: string;
	roomCode: string;
	role: "host" | "player" | null;
	status: ConnectionStatus;
	error: string | null;
	players: Player[];
	phase: RoomPhase;
	gameId: string | null;
	gamePayload: unknown;
	configPayload: unknown;
	timer: GameTimer | null;
	secret: unknown;
	pauseReason: PauseReason | null;
	hostReconnectDeadline: number | null;
	setPlayerName: (name: string) => void;
	connect: () => void;
	disconnect: () => void;
	createRoom: (gameId: string) => void;
	joinRoom: (code: string, name: string) => void;
	leaveRoom: () => void;
	clearError: () => void;
	updateConfig: (payload: unknown) => void;
	startGame: () => void;
	pauseGame: () => void;
	resumeGame: () => void;
	kickPlayer: (playerId: string) => void;
	addCpuSeat: () => void;
	removeCpuSeat: (playerId: string) => void;
	_syncState: (state: GameState) => void;
	_setStatus: (status: ConnectionStatus) => void;
	_setError: (message: string) => void;
	_closeRoom: () => void;
	_abandonRoom: (message: string) => void;
	_attemptRejoin: (session: RoomSession) => void;
	_setSecret: (payload: unknown) => void;
}

function getOrCreatePlayerId(): string {
	const existing = localStorage.getItem("huddle_pid");
	if (existing) return existing;
	const id = generateUUID();
	localStorage.setItem("huddle_pid", id);
	return id;
}

const ROOM_RESET = {
	roomCode: "",
	role: null,
	players: [],
	phase: "lobby",
	gameId: null,
	gamePayload: null,
	configPayload: null,
	timer: null,
	secret: null,
	error: null,
	pauseReason: null,
	hostReconnectDeadline: null,
} as const satisfies Partial<GameStore>;

let rejoinTimeoutId: ReturnType<typeof setTimeout> | null = null;

function clearRejoinTimeout(): void {
	if (rejoinTimeoutId !== null) {
		clearTimeout(rejoinTimeoutId);
		rejoinTimeoutId = null;
	}
}

export const useGameStore = create<GameStore>((set, get) => ({
	playerId: getOrCreatePlayerId(),
	playerName: "",
	roomCode: "",
	role: null,
	status: "idle",
	error: null,
	players: [],
	phase: "lobby",
	gameId: null,
	gamePayload: null,
	configPayload: null,
	secret: null,
	timer: null,
	pauseReason: null,
	hostReconnectDeadline: null,

	setPlayerName: (name) => {
		set({ playerName: name });
	},

	connect: () => {
		if (socket.connected) return;
		set({ status: "connecting", error: null });
		socket.connect();
	},

	disconnect: () => {
		clearRejoinTimeout();
		socket.disconnect();
		clearRoomSession();
		set({ status: "disconnected", ...ROOM_RESET });
	},

	createRoom: (gameId) => {
		const { playerId, status } = get();
		console.log("[createRoom] status:", status, "gameId:", gameId);
		if (status !== "connected") return;
		set({ role: "host", gameId });
		socket.emit("create_room", { gameId, playerId });
	},

	joinRoom: (code, name) => {
		const { playerId, status } = get();
		if (status !== "connected") return;
		set({ playerName: name, role: "player" });
		socket.emit("join_room", { code, name, playerId });
	},

	leaveRoom: () => {
		clearRejoinTimeout();
		socket.emit("leave_room");
		clearRoomSession();
		set(ROOM_RESET);
	},

	clearError: () => {
		set({ error: null });
	},

	updateConfig: (payload) => {
		if (get().status !== "connected") return;
		socket.emit("player_action", payload);
	},

	startGame: () => {
		if (get().status !== "connected") return;
		socket.emit("start_game");
	},

	pauseGame: () => {
		if (get().status !== "connected") return;
		socket.emit("pause_game");
	},

	resumeGame: () => {
		if (get().status !== "connected") return;
		socket.emit("resume_game");
	},

	kickPlayer: (playerId) => {
		if (get().status !== "connected") return;
		socket.emit("kick_player", { playerId });
	},

	addCpuSeat: () => {
		if (get().status !== "connected") return;
		socket.emit("add_cpu_seat");
	},

	removeCpuSeat: (playerId) => {
		if (get().status !== "connected") return;
		socket.emit("remove_cpu_seat", { playerId });
	},

	_syncState: (state) => {
		clearRejoinTimeout();

		const { role, playerId, playerName } = get();

		const resolvedName =
			state.players.find((p) => p.id === playerId)?.name ?? playerName;

		if (state.roomCode && role) {
			saveRoomSession({
				roomCode: state.roomCode,
				role,
				playerName: resolvedName,
			});
		}

		// game_state and player_secret are two separate socket events for
		// what the server treats as one logical update (see applyResult in
		// GameRunner.ts, which emits game_state then player_secret,
		// back-to-back, off the same EngineResult). Each is now applied to
		// the store independently and immediately as it arrives (see
		// _setSecret) rather than synchronized into one combined set()
		// call — game_state always arrives first, so gamePayload is never
		// left pointing at a newer secret than itself; the reverse (secret
		// briefly one tick behind a freshly-applied gamePayload) is a real
		// but sub-render-frame gap that hasn't shown up as a visible bug,
		// versus the previous stash-and-wait approach which could leave a
		// secret-only update (e.g. a draft pick) unapplied indefinitely.
		set({
			roomCode: state.roomCode,
			players: state.players,
			phase: state.phase,
			gameId: state.gameId,
			gamePayload: state.gamePayload,
			configPayload: state.configPayload,
			timer: state.timer,
			playerName: resolvedName,
			pauseReason: state.pauseReason ?? null,
			hostReconnectDeadline: state.hostReconnectDeadline ?? null,
		});
	},

	_setStatus: (status) => {
		set({ status });
	},

	_setError: (message) => {
		set((state) => ({
			error: message,
			role: state.roomCode ? state.role : null,
		}));
	},

	_closeRoom: () => {
		clearRejoinTimeout();
		clearRoomSession();
		set(ROOM_RESET);
	},

	_abandonRoom: (message) => {
		clearRejoinTimeout();
		clearRoomSession();
		set({ ...ROOM_RESET, error: message });
	},

	_attemptRejoin: (session) => {
		const { playerId } = get();
		set({
			roomCode: session.roomCode,
			role: session.role,
			playerName: session.playerName ?? "",
		});

		clearRejoinTimeout();
		rejoinTimeoutId = setTimeout(() => {
			rejoinTimeoutId = null;
			const { roomCode, players } = get();
			if (roomCode === session.roomCode && players.length === 0) {
				console.warn("[rejoin] timed out — clearing stale session");
				clearRoomSession();
				set({
					...ROOM_RESET,
					error: "Could not rejoin, the room may have closed.",
				});
			}
		}, 8_000);

		socket.emit("rejoin_room", {
			code: session.roomCode,
			playerId,
			role: session.role,
		});
	},

	// game_state always arrives before its paired player_secret (see
	// GameRunner.applyResult: game_state is emitted first, player_secret
	// second, same tick, same EngineResult). By the time player_secret
	// lands here, gamePayload has therefore already been applied via
	// _syncState — so the correct action is to apply this secret
	// immediately, not stash it waiting for a game_state that already
	// happened. The stash-and-wait version of this function assumed the
	// opposite arrival order, which meant a secret-only update (e.g. a
	// draft pick, which doesn't change the public gamePayload at all)
	// could sit unapplied until some later, unrelated game_state event
	// happened to flush it — surfacing as picks/selections needing an
	// extra click, or a click's effect only appearing after a subsequent
	// action.
	_setSecret: (payload) => {
		set({ secret: payload });
	},
}));