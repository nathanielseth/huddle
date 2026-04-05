import { create } from "zustand";
import { socket } from "../lib/socket";
import type { Player, GamePhase, GameState, ConnectionStatus } from "@shared/types";

interface GameStore {
  playerId: string;

  // session
  playerName: string;
  roomCode: string;
  role: "host" | "player" | null;

  // connection
  status: ConnectionStatus;
  error: string | null;

  // room state
  players: Player[];
  phase: GamePhase;
  gameId: string | null;

  // public
  setPlayerName: (name: string) => void;
  connect: () => void;
  disconnect: () => void;
  createRoom: (gameId: string, playerName: string) => void;
  joinRoom: (code: string, name: string) => void;
  clearError: () => void;

  // internal
  _syncState: (state: GameState) => void;
  _setStatus: (status: ConnectionStatus) => void;
  _setError: (message: string) => void;
  _onRoomCreated: (code: string) => void;
}

// persistent player ID

function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem("huddle_pid");
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem("huddle_pid", id);
  return id;
}

// store

export const useGameStore = create<GameStore>((set, get) => ({
  playerId: getOrCreatePlayerId(),

  // session
  playerName: "",
  roomCode: "",
  role: null,

  // connection
  status: "idle",
  error: null,

  // room
  players: [],
  phase: "lobby",
  gameId: null,

  // public actions

  setPlayerName: (name) => set({ playerName: name }),

  connect: () => {
    if (socket.connected || get().status === "connecting") return;
    set({ status: "connecting", error: null });
    socket.connect();
  },

  disconnect: () => {
    socket.disconnect();
    set({
      status: "disconnected",
      roomCode: "",
      role: null,
      players: [],
      phase: "lobby",
      gameId: null,
      error: null,
    });
  },

  createRoom: (gameId, playerName) => {
    const { playerId, status } = get();
    if (status !== "connected") return;
    set({ playerName, role: "host", gameId });
    socket.emit("create_room", { gameId, playerName, playerId });
  },

  joinRoom: (code, name) => {
    const { playerId, status } = get();
    if (status !== "connected") return;
    set({ playerName: name, role: "player" });
    socket.emit("join_room", { code, name, playerId });
  },

  clearError: () => set({ error: null }),

  // internal - only socket listeners should call

  _syncState: (state) =>
    set({
      roomCode: state.roomCode,
      players: state.players,
      phase: state.phase,
      gameId: state.gameId,
    }),

  _setStatus: (status) => set({ status }),

  _setError: (message) => set({ error: message }),

  _onRoomCreated: (code) => set({ roomCode: code }),
}));

// socket listeners

socket.on("connect", () => {
  useGameStore.getState()._setStatus("connected");
});

socket.on("disconnect", () => {
  useGameStore.getState()._setStatus("disconnected");
});

socket.on("connect_error", () => {
  useGameStore.getState()._setStatus("error");
  useGameStore.getState()._setError("Could not connect to server.");
});

socket.on("game_state", (state) => {
  useGameStore.getState()._syncState(state);
});

socket.on("room_error", (message) => {
  useGameStore.getState()._setError(message);
});