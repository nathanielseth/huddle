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
	startGame: () => void;
	pauseGame: () => void;
	resumeGame: () => void;
	kickPlayer: (playerId: string) => void;
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
	secret: null,
	timer: null,
	pauseReason: null,
	hostReconnectDeadline: null,

	setPlayerName: (name) => set({ playerName: name }),

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

	clearError: () => set({ error: null }),

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

		set({
			roomCode: state.roomCode,
			players: state.players,
			phase: state.phase,
			gameId: state.gameId,
			gamePayload: state.gamePayload,
			timer: state.timer,
			playerName: resolvedName,
			pauseReason: state.pauseReason ?? null,
			hostReconnectDeadline: state.hostReconnectDeadline ?? null,
		});
	},

	_setStatus: (status) => set({ status }),

	_setError: (message) =>
		set((state) => ({
			error: message,
			role: state.roomCode ? state.role : null,
		})),

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

	_setSecret: (payload) => set({ secret: payload }),
}));