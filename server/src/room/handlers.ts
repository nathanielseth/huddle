import {
	createRoom,
	addPlayer,
	rejoinPlayer,
	removePlayer,
	markDisconnected,
	isHostSocket,
	getPublicState,
	touchRoom,
	type Room,
	type RoomRegistry,
} from "./registry.js";
import {
	CreateRoomSchema,
	JoinRoomSchema,
	RejoinRoomSchema,
} from "./schemas.js";
import type { GameRunner } from "../engine/GameRunner.js";
import type { IO, ClientSocket } from "../types.js";

const HOST_GRACE_MS = 45_000;
const ACTION_RATE_LIMIT_MS = 100;
const MAX_ROOMS = 100; // hard cap — emit room_error if reached

const hostGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearHostGrace(roomCode: string): void {
	const t = hostGraceTimers.get(roomCode);
	if (t !== undefined) {
		clearTimeout(t);
		hostGraceTimers.delete(roomCode);
	}
}

function broadcast(io: IO, room: Room): void {
	touchRoom(room);
	io.to(room.code).emit("game_state", getPublicState(room));
}

function closeRoom(
	io: IO,
	store: RoomRegistry,
	room: Room,
	reason: string,
	runner: GameRunner,
): void {
	clearHostGrace(room.code);
	runner.cancelTimer(room.code);
	runner.clearQueue(room.code);
	io.to(room.code).emit("room_closed");
	store.delete(room.code);
	console.log(`[room] ${room.code} closed — ${reason}`);
}

function handleIntentionalLeave(
	io: IO,
	socket: ClientSocket,
	store: RoomRegistry,
	runner: GameRunner,
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

function handleDisconnect(
	io: IO,
	socket: ClientSocket,
	store: RoomRegistry,
	reason: string,
	runner: GameRunner,
): void {
	const room = store.findBySocket(socket.id);
	if (!room) return;
	store.untrackSocket(socket.id);

	if (isHostSocket(room, socket.id)) {
		console.log(
			`[room] host disconnected from ${room.code} (${reason}) — starting ${HOST_GRACE_MS / 1000}s grace period`,
		);
		io.to(room.code).emit(
			"room_error",
			"Host disconnected. Waiting for them to reconnect…",
		);

		const timer = setTimeout(() => {
			hostGraceTimers.delete(room.code);
			if (!store.get(room.code)) return;
			closeRoom(io, store, room, `host never rejoined (${reason})`, runner);
		}, HOST_GRACE_MS);
		hostGraceTimers.set(room.code, timer);
		return;
	}

	const found = store.findPlayerBySocket(socket.id);
	if (!found) {
		console.log(
			`[room] ignoring stale disconnect for ${socket.id} in ${room.code} — player already rejoined`,
		);
		return;
	}

	markDisconnected(room, socket.id);
	broadcast(io, room);
}

export function registerHandlers(
	io: IO,
	socket: ClientSocket,
	store: RoomRegistry,
	runner: GameRunner,
): void {
	let lastActionAt = 0;

	socket.on("create_room", (payload) => {
		const result = CreateRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}

		// Hard cap — prevents runaway room accumulation
		if (store.size >= MAX_ROOMS) {
			socket.emit("room_error", "Server is full right now. Try again later.");
			console.log(`[room] create_room rejected — at capacity (${MAX_ROOMS})`);
			return;
		}

		const { gameId, playerId } = result.data;
		const code = store.generateCode();
		const room = createRoom(code, playerId, socket.id, gameId);
		store.save(room);
		store.trackSocket(socket.id, code);
		socket.join(code);
		console.log(
			`[room] created ${code} — host ${socket.id} (${store.size}/${MAX_ROOMS} rooms)`,
		);
		broadcast(io, room);
	});

	socket.on("join_room", (payload) => {
		const result = JoinRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}
		const { code, playerId } = result.data;
		const name = result.data.name.trim();
		const room = store.get(code);
		if (!room) {
			socket.emit("room_error", "Room not found.");
			return;
		}
		if (room.phase !== "lobby") {
			socket.emit("room_error", "Game already in progress.");
			return;
		}
		const nameLower = name.toLowerCase();
		const nameTaken = Array.from(room.players.values()).some(
			(p) => p.isConnected && p.name.toLowerCase() === nameLower,
		);
		if (nameTaken) {
			socket.emit("room_error", "That name is already taken in this room.");
			return;
		}
		const outcome = addPlayer(room, playerId, socket.id, name);
		store.trackSocket(socket.id, code, playerId);
		socket.join(code);
		touchRoom(room);
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
			if (hostGraceTimers.has(room.code)) {
				clearHostGrace(room.code);
				console.log(`[room] host rejoined ${room.code} within grace period`);
			}
			store.untrackSocket(room.hostSocketId);
			room.hostSocketId = socket.id;
			store.trackSocket(socket.id, code);
			socket.join(code);
			touchRoom(room);
			console.log(`[room] host rejoined ${code}`);
			broadcast(io, room);
			if (room.phase === "in_game") {
				runner.resendSecret(room, playerId, io);
			}
			return;
		}

		const existing = room.players.get(playerId);
		if (existing) store.untrackSocket(existing.socketId);

		const ok = rejoinPlayer(room, playerId, socket.id);
		if (!ok) {
			socket.emit("rejoin_failed");
			return;
		}
		store.trackSocket(socket.id, code, playerId);
		socket.join(code);
		touchRoom(room);
		console.log(`[room] player ${playerId} rejoined ${code}`);
		broadcast(io, room);
		if (room.phase === "in_game") {
			runner.resendSecret(room, playerId, io);
		}
	});

	socket.on("start_game", () => {
		const room = store.findBySocket(socket.id);
		if (!room) return;
		if (room.phase !== "lobby") return;
		const isHost = isHostSocket(room, socket.id);
		const firstPlayer = [...room.players.values()][0];
		const isPartyLeader = firstPlayer?.socketId === socket.id;
		if (!isHost && !isPartyLeader) return;
		if (!runner.hasEngine(room.gameId)) {
			socket.emit("room_error", "Unknown game.");
			return;
		}
		runner.startGame(room, io, store);
	});

	socket.on("player_action", (payload) => {
		const now = Date.now();
		if (now - lastActionAt < ACTION_RATE_LIMIT_MS) return;
		lastActionAt = now;

		const found = store.findPlayerBySocket(socket.id);
		if (!found) return;
		runner.handleAction(found.room, found.playerId, payload, io, store);
	});

	socket.on("leave_room", () =>
		handleIntentionalLeave(io, socket, store, runner),
	);
	socket.on("disconnect", (reason) =>
		handleDisconnect(io, socket, store, reason, runner),
	);
}
