import type { Server, Socket } from "socket.io";
import type {
	ServerToClientEvents,
	ClientToServerEvents,
} from "../../shared/events.js";
import {
	createRoom,
	addPlayer,
	rejoinPlayer,
	removePlayer,
	markDisconnected,
	findRoomBySocket,
	isHostSocket,
	generateCode,
	getPublicState,
	type Room,
} from "./rooms.js";
import {
	CreateRoomSchema,
	JoinRoomSchema,
	RejoinRoomSchema,
} from "./schemas.js";

type IO = Server<ClientToServerEvents, ServerToClientEvents>;
type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

function broadcast(io: IO, room: Room): void {
	io.to(room.code).emit("game_state", getPublicState(room));
}

function closeRoom(
	io: IO,
	rooms: Map<string, Room>,
	room: Room,
	reason: string,
): void {
	io.to(room.code).emit("room_closed");
	rooms.delete(room.code);
	console.log(`[room] ${room.code} closed — ${reason}`);
}

function handleIntentionalLeave(
	io: IO,
	socket: ClientSocket,
	rooms: Map<string, Room>,
): void {
	const room = findRoomBySocket(rooms, socket.id);
	if (!room) return;

	if (isHostSocket(room, socket.id)) {
		closeRoom(io, rooms, room, "host left");
		return;
	}

	removePlayer(room, socket.id);
	socket.leave(room.code);
	console.log(`[room] socket ${socket.id} left ${room.code}`);
	broadcast(io, room);
}

function handleDisconnect(
	io: IO,
	socket: ClientSocket,
	rooms: Map<string, Room>,
	reason: string,
): void {
	const room = findRoomBySocket(rooms, socket.id);
	if (!room) return;

	if (isHostSocket(room, socket.id)) {
		closeRoom(io, rooms, room, `host disconnected (${reason})`);
		return;
	}

	markDisconnected(room, socket.id);
	console.log(
		`[room] socket ${socket.id} disconnected from ${room.code} (${reason})`,
	);
	broadcast(io, room);
}

export function registerHandlers(
	io: IO,
	socket: ClientSocket,
	rooms: Map<string, Room>,
): void {
	socket.on("create_room", (payload) => {
		const result = CreateRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}
		const { gameId, playerId } = result.data;
		const code = generateCode(rooms);
		const room = createRoom(code, playerId, socket.id, gameId);
		rooms.set(code, room);
		socket.join(code);
		console.log(`[room] created ${code} — host ${socket.id}`);
		broadcast(io, room);
	});

	socket.on("join_room", (payload) => {
		const result = JoinRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}
		const { code, name, playerId } = result.data;
		const room = rooms.get(code);
		if (!room) {
			socket.emit("room_error", "Room not found.");
			return;
		}
		if (room.phase !== "lobby") {
			socket.emit("room_error", "Game already in progress.");
			return;
		}
		const outcome = addPlayer(room, playerId, socket.id, name);
		socket.join(code);
		console.log(`[room] ${name} ${outcome} ${code}`);
		broadcast(io, room);
	});

	socket.on("rejoin_room", (payload) => {
		const result = RejoinRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("rejoin_failed");
			return;
		}
		const { code, playerId, role } = result.data;
		const room = rooms.get(code);
		if (!room) {
			socket.emit("rejoin_failed");
			return;
		}
		if (role === "host") {
			if (room.hostPlayerId !== playerId) {
				socket.emit("rejoin_failed");
				return;
			}
			room.hostSocketId = socket.id;
			socket.join(code);
			console.log(`[room] host rejoined ${code}`);
			broadcast(io, room);
			return;
		}
		// player
		const ok = rejoinPlayer(room, playerId, socket.id);
		if (!ok) {
			socket.emit("rejoin_failed");
			return;
		}
		socket.join(code);
		console.log(`[room] player ${playerId} rejoined ${code}`);
		broadcast(io, room);
	});

	socket.on("leave_room", () => handleIntentionalLeave(io, socket, rooms));
	socket.on("disconnect", (reason) =>
		handleDisconnect(io, socket, rooms, reason),
	);
}
