import { create } from "zustand";
import { socket } from "../lib/socket";
import {
	saveRoomSession,
	clearRoomSession,
	type RoomSession,
} from "../lib/session";
import type {
	Player,
	RoomPhase,
	GameState,
	ConnectionStatus,
	GameTimer,
} from "@shared/types";

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
	setPlayerName: (name: string) => void;
	connect: () => void;
	disconnect: () => void;
	createRoom: (gameId: string) => void;
	joinRoom: (code: string, name: string) => void;
	leaveRoom: () => void;
	clearError: () => void;
	startGame: () => void;
	_syncState: (state: GameState) => void;
	_setStatus: (status: ConnectionStatus) => void;
	_setError: (message: string) => void;
	_closeRoom: () => void;
	_attemptRejoin: (session: RoomSession) => void;
	_setSecret: (payload: unknown) => void;
}

// get or create persistent player id from localstorage
function getOrCreatePlayerId(): string {
	const existing = localStorage.getItem("huddle_pid");
	if (existing) return existing;
	const id = crypto.randomUUID();
	localStorage.setItem("huddle_pid", id);
	return id;
}

// reset values when leaving/disconnecting room
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
} as const satisfies Partial<GameStore>;

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
	setPlayerName: (name) => set({ playerName: name }),
	// connect to socket server if not already
	connect: () => {
		if (socket.connected || get().status === "connecting") return;
		set({ status: "connecting", error: null });
		socket.connect();
	},
	// disconnect and clear room session storage
	disconnect: () => {
		socket.disconnect();
		clearRoomSession();
		set({ status: "disconnected", ...ROOM_RESET });
	},
	// host creates new room
	createRoom: (gameId) => {
		const { playerId, status } = get();
		if (status !== "connected") return;
		set({ role: "host", gameId });
		socket.emit("create_room", { gameId, playerId });
	},
	// player joins existing room by code
	joinRoom: (code, name) => {
		const { playerId, status } = get();
		if (status !== "connected") return;
		set({ playerName: name, role: "player" });
		socket.emit("join_room", { code, name, playerId });
	},
	// leave current room and clear local state
	leaveRoom: () => {
		socket.emit("leave_room");
		clearRoomSession();
		set(ROOM_RESET);
	},
	clearError: () => set({ error: null }),
	startGame: () => {
		if (get().status !== "connected") return;
		socket.emit("start_game");
	},
	// sync room state from server, persist session if host/player
	_syncState: (state) => {
		const { role, playerName } = get();
		if (state.roomCode && role) {
			saveRoomSession({ roomCode: state.roomCode, role, playerName });
		}
		set({
			roomCode: state.roomCode,
			players: state.players,
			phase: state.phase,
			gameId: state.gameId,
			gamePayload: state.gamePayload,
			timer: state.timer,
		});
	},
	_setStatus: (status) => set({ status }),
	// set error, keep role if still in room
	_setError: (message) =>
		set((state) => ({
			error: message,
			role: state.roomCode ? state.role : null,
		})),
	// force close room from server (host left)
	_closeRoom: () => {
		clearRoomSession();
		set(ROOM_RESET);
	},
	// try to rejoin previous room on page refresh
	_attemptRejoin: (session) => {
		const { playerId } = get();
		set({
			roomCode: session.roomCode,
			role: session.role,
			playerName: session.playerName,
		});
		socket.emit("rejoin_room", {
			code: session.roomCode,
			playerId,
			role: session.role,
		});
	},
	_setSecret: (payload) => set({ secret: payload }),
}));
