import { create } from "zustand";
import { socket } from "../lib/socket";
import type {
	Player,
	GamePhase,
	GameState,
	ConnectionStatus,
} from "@shared/types";

interface RoomSession {
	roomCode: string;
	role: "host" | "player";
	playerName: string;
}

// session persistence
function saveRoomSession(session: RoomSession): void {
	localStorage.setItem("huddle_room", JSON.stringify(session));
}

function clearRoomSession(): void {
	localStorage.removeItem("huddle_room");
}

function loadRoomSession(): RoomSession | null {
	try {
		const raw = localStorage.getItem("huddle_room");
		if (!raw) return null;
		return JSON.parse(raw) as RoomSession;
	} catch {
		return null;
	}
}

// store
interface GameStore {
	playerId: string;
	playerName: string;
	roomCode: string;
	role: "host" | "player" | null;
	status: ConnectionStatus;
	error: string | null;
	players: Player[];
	phase: GamePhase;
	gameId: string | null;
	setPlayerName: (name: string) => void;
	connect: () => void;
	disconnect: () => void;
	createRoom: (gameId: string) => void;
	joinRoom: (code: string, name: string) => void;
	leaveRoom: () => void;
	clearError: () => void;
	_syncState: (state: GameState) => void;
	_setStatus: (status: ConnectionStatus) => void;
	_setError: (message: string) => void;
	_closeRoom: () => void;
	_attemptRejoin: (session: RoomSession) => void;
}

function getOrCreatePlayerId(): string {
	const existing = localStorage.getItem("huddle_pid");
	if (existing) return existing;
	const id = crypto.randomUUID();
	localStorage.setItem("huddle_pid", id);
	return id;
}

const ROOM_RESET: Partial<GameStore> = {
	roomCode: "",
	role: null,
	players: [],
	phase: "lobby",
	gameId: null,
	error: null,
};

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

	setPlayerName: (name) => set({ playerName: name }),

	connect: () => {
		if (socket.connected || get().status === "connecting") return;
		set({ status: "connecting", error: null });
		socket.connect();
	},

	disconnect: () => {
		socket.disconnect();
		clearRoomSession();
		set({ status: "disconnected", ...ROOM_RESET });
	},

	createRoom: (gameId) => {
		const { playerId, status } = get();
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
		socket.emit("leave_room");
		clearRoomSession();
		set(ROOM_RESET);
	},

	clearError: () => set({ error: null }),

	_syncState: (state) => {
		const { role, playerName } = get();
		// persist session whenever we get valid room state
		if (state.roomCode && role) {
			saveRoomSession({ roomCode: state.roomCode, role, playerName });
		}
		set({
			roomCode: state.roomCode,
			players: state.players,
			phase: state.phase,
			gameId: state.gameId,
		});
	},

	_setStatus: (status) => set({ status }),
	_setError: (message) => set({ error: message }),

	_closeRoom: () => {
		clearRoomSession();
		set(ROOM_RESET);
	},

	_attemptRejoin: (session) => {
		const { playerId } = get();
		// optimistically restore session state
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
}));

// socket listeners

socket.on("connect", () => {
	useGameStore.getState()._setStatus("connected");
	// attempt rejoin on every connect
	const session = loadRoomSession();
	if (session) useGameStore.getState()._attemptRejoin(session);
});

socket.on("disconnect", () =>
	useGameStore.getState()._setStatus("disconnected"),
);

socket.on("connect_error", () => {
	useGameStore.getState()._setStatus("error");
	useGameStore.getState()._setError("Could not connect to server.");
});

socket.on("game_state", (state) => useGameStore.getState()._syncState(state));
socket.on("room_error", (message) =>
	useGameStore.getState()._setError(message),
);
socket.on("room_closed", () => useGameStore.getState()._closeRoom());

socket.on("rejoin_failed", () => {
	useGameStore.getState()._closeRoom();
});

useGameStore.getState().connect();
