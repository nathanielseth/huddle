import type { Server, Socket } from "socket.io";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../../shared/events.js";
import {
	createRoom,
	addPlayer,
	rejoinPlayer,
	removePlayer,
	markDisconnected,
	isHostSocket,
	getPublicState,
	touchRoom,
	findPlayerBySocket,
	type Room,
	type RoomStore,
} from "./rooms.js";
import {
	CreateRoomSchema,
	JoinRoomSchema,
	RejoinRoomSchema,
} from "./schemas.js";
import { EngineRunner } from "../engine/engineRunner.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// send fresh game state to all in room
function broadcast(io: IO, room: Room): void {
	touchRoom(room);
	io.to(room.code).emit("game_state", getPublicState(room));
}

// delete room and notify players
function closeRoom(
	io: IO,
	store: RoomStore,
	room: Room,
	reason: string,
	runner: EngineRunner,
): void {
	runner.cancelTimer(room.code);
	io.to(room.code).emit("room_closed");
	store.delete(room.code);
	console.log(`[room] ${room.code} closed — ${reason}`);
}

// player clicked leave button (not accidental disconnect)
function handleIntentionalLeave(
	io: IO,
	socket: ClientSocket,
	store: RoomStore,
	runner: EngineRunner,
): void {
	const room = store.findBySocket(socket.id);
	if (!room) return;
	store.untrackSocket(socket.id);
	if (isHostSocket(room, socket.id)) {
		closeRoom(io, store, room, "host left", runner);
		return;
	}
	removePlayer(room, socket.id);
	socket.leave(room.code);
	broadcast(io, room);
}

// socket lost connection (network, tab closed, etc)
function handleDisconnect(
	io: IO,
	socket: ClientSocket,
	store: RoomStore,
	reason: string,
	runner: EngineRunner,
): void {
	const room = store.findBySocket(socket.id);
	if (!room) return;
	store.untrackSocket(socket.id);
	if (isHostSocket(room, socket.id)) {
		closeRoom(io, store, room, `host disconnected (${reason})`, runner);
		return;
	}
	markDisconnected(room, socket.id);
	broadcast(io, room);
}

export function registerHandlers(
	io: IO,
	socket: ClientSocket,
	store: RoomStore,
	runner: EngineRunner,
): void {
	// host creates new game room
	socket.on("create_room", (payload) => {
		const result = CreateRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}
		const { gameId, playerId } = result.data;
		const code = store.generateCode();
		const room = createRoom(code, playerId, socket.id, gameId);
		store.save(room);
		store.trackSocket(socket.id, code);
		socket.join(code);
		console.log(`[room] created ${code} — host ${socket.id}`);
		broadcast(io, room);
	});

	// player joins existing room by code
	socket.on("join_room", (payload) => {
		const result = JoinRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}
		const { code, name, playerId } = result.data;
		const room = store.get(code);
		if (!room) {
			socket.emit("room_error", "Room not found.");
			return;
		}
		if (room.phase !== "lobby") {
			socket.emit("room_error", "Game already in progress.");
			return;
		}
		const outcome = addPlayer(room, playerId, socket.id, name);
		store.trackSocket(socket.id, code);
		socket.join(code);
		touchRoom(room);
		console.log(`[room] ${name} ${outcome} ${code}`);
		broadcast(io, room);
	});

	// client reconnects to existing room (page refresh)
	socket.on("rejoin_room", (payload) => {
		const result = RejoinRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("rejoin_failed");
			return;
		}
		const { code, playerId, role } = result.data;
		const room = store.get(code);
		if (!room) {
			socket.emit("rejoin_failed");
			return;
		}

		if (role === "host") {
			if (room.hostPlayerId !== playerId) {
				socket.emit("rejoin_failed");
				return;
			}
			// replace stale host socket
			store.untrackSocket(room.hostSocketId);
			room.hostSocketId = socket.id;
			store.trackSocket(socket.id, code);
			socket.join(code);
			touchRoom(room);
			console.log(`[room] host rejoined ${code}`);
			broadcast(io, room);
			return;
		}

		// replace stale player socket
		const existing = room.players.get(playerId);
		if (existing) store.untrackSocket(existing.socketId);

		const ok = rejoinPlayer(room, playerId, socket.id);
		if (!ok) {
			socket.emit("rejoin_failed");
			return;
		}
		store.trackSocket(socket.id, code);
		socket.join(code);
		touchRoom(room);
		console.log(`[room] player ${playerId} rejoined ${code}`);
		broadcast(io, room);
	});

	socket.on("start_game", () => {
		const room = store.findBySocket(socket.id);
		if (!room) return;
		if (!isHostSocket(room, socket.id)) return; // only host can start
		if (room.phase !== "lobby") return; // can't restart mid-game

		const ok = runner.startGame(room, io, store);
		if (!ok) {
			socket.emit("room_error", "Unknown game.");
		}
	});

	socket.on("player_action", (payload) => {
		const room = store.findBySocket(socket.id);
		if (!room) return;
		const player = findPlayerBySocket(room, socket.id);
		if (!player) return; // host can't submit player actions

		runner.handleAction(room, player.playerId, payload, io, store);
	});

	socket.on("leave_room", () =>
		handleIntentionalLeave(io, socket, store, runner),
	);
	socket.on("disconnect", (reason) =>
		handleDisconnect(io, socket, store, reason, runner),
	);
}