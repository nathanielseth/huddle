import { randomUUID } from "node:crypto";
import {
	createRoom,
	addPlayer,
	addCpuSeat,
	addSpectator,
	removeSpectator,
	rejoinPlayer,
	removePlayer,
	removePlayerById,
	markDisconnected,
	isHostSocket,
	getPublicState,
	touchRoom,
	pushChatMessage,
	resolveChatSender,
	type Room,
	type RoomRegistry,
} from "./registry";
import {
	CreateRoomSchema,
	JoinRoomSchema,
	SpectateRoomSchema,
	RejoinRoomSchema,
	KickPlayerSchema,
	RemoveCpuSeatSchema,
	SendChatMessageSchema,
} from "./schemas";
import type { GameRunner } from "../engine/GameRunner";
import type { IO, ClientSocket } from "../types";
import { createCooldown, createBurstLimiter } from "../lib/rate-limit";
import { logger } from "../lib/logger";

const DEFAULT_MAX_SEATS = 8;

const HOST_GRACE_MS = 45_000;
const ACTION_RATE_LIMIT_MS = 100;
const ROOM_LIFECYCLE_RATE_LIMIT_MS = 1_000;
const MAX_ROOMS = 100;
const MAX_SPECTATORS_PER_ROOM = 10;

// chat rate limit looser than action, burst allows quick flurry without spam
const CHAT_RATE_LIMIT_MS = 300;
const CHAT_BURST_CAPACITY = 8;
const CHAT_BURST_WINDOW_MS = 10_000;

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
	runner.cancelHostReconnectTimer(room.code);
	runner.cancelCpuTurnTimer(room.code);
	runner.clearQueue(room.code);
	io.to(room.code).emit("room_closed");
	store.delete(room.code);
	logger.info("room closed", { roomCode: room.code, reason });
}

function joinAsSpectator(
	io: IO,
	socket: ClientSocket,
	store: RoomRegistry,
	room: Room,
	name: string,
	reason: "room_full" | "requested",
): void {
	addSpectator(room, socket.id, name);
	store.trackSpectatorSocket(socket.id, room.code);
	void socket.join(room.code);
	socket.emit("joined_as_spectator", { reason });
	if (room.chatHistory.length > 0)
		socket.emit("chat_history", room.chatHistory);
	broadcast(io, room);
}

function handleIntentionalLeave(
	io: IO,
	socket: ClientSocket,
	store: RoomRegistry,
	runner: GameRunner,
): void {
	const spectatorRoom = store.findSpectatorBySocket(socket.id);
	if (spectatorRoom) {
		store.untrackSpectatorSocket(socket.id);
		removeSpectator(spectatorRoom, socket.id);
		void socket.leave(spectatorRoom.code);
		broadcast(io, spectatorRoom);
		return;
	}

	const room = store.findBySocket(socket.id);
	if (!room) return;
	store.untrackSocket(socket.id);
	if (isHostSocket(room, socket.id)) {
		closeRoom(io, store, room, "host left", runner);
		return;
	}
	removePlayer(room, socket.id);
	void socket.leave(room.code);
	runner.notifyPlayerRemoved(room);
	broadcast(io, room);
}

function handleDisconnect(
	io: IO,
	socket: ClientSocket,
	store: RoomRegistry,
	reason: string,
	runner: GameRunner,
): void {
	const spectatorRoom = store.findSpectatorBySocket(socket.id);
	if (spectatorRoom) {
		store.untrackSpectatorSocket(socket.id);
		removeSpectator(spectatorRoom, socket.id);
		broadcast(io, spectatorRoom);
		return;
	}

	const room = store.findBySocket(socket.id);
	if (!room) return;
	store.untrackSocket(socket.id);

	if (isHostSocket(room, socket.id)) {
		if (room.phase === "in_game" || room.phase === "paused") {
			logger.info("host disconnected — pausing game", {
				roomCode: room.code,
				reason,
				reconnectWindowMs: HOST_GRACE_MS,
			});
			runner.onHostDisconnect(room, io, store);
		} else {
			logger.info("host disconnected — starting grace period", {
				roomCode: room.code,
				reason,
				graceMs: HOST_GRACE_MS,
			});
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
		}
		return;
	}

	const found = store.findPlayerBySocket(socket.id);
	if (!found) {
		logger.info("ignoring stale disconnect — player already rejoined", {
			socketId: socket.id,
			roomCode: room.code,
		});
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
	const actionCooldown = createCooldown(ACTION_RATE_LIMIT_MS);
	const createRoomCooldown = createCooldown(ROOM_LIFECYCLE_RATE_LIMIT_MS);
	const joinRoomCooldown = createCooldown(ROOM_LIFECYCLE_RATE_LIMIT_MS);
	const rejoinRoomCooldown = createCooldown(ROOM_LIFECYCLE_RATE_LIMIT_MS);
	const chatCooldown = createCooldown(CHAT_RATE_LIMIT_MS);
	const chatBurstLimiter = createBurstLimiter(
		CHAT_BURST_CAPACITY,
		CHAT_BURST_WINDOW_MS,
	);

	socket.on("create_room", (payload) => {
		if (!createRoomCooldown.ready()) return;

		const result = CreateRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}

		if (store.size >= MAX_ROOMS) {
			socket.emit("room_error", "Server is full right now. Try again later.");
			logger.warn("create_room rejected — at capacity", {
				maxRooms: MAX_ROOMS,
			});
			return;
		}

		const { gameId, playerId } = result.data;
		const code = store.generateCode();
		const room = createRoom(code, playerId, socket.id, gameId);
		store.save(room);
		store.trackSocket(socket.id, code);
		void socket.join(code);
		logger.info("room created", {
			roomCode: code,
			socketId: socket.id,
			gameId,
			roomCount: store.size,
			maxRooms: MAX_ROOMS,
		});
		broadcast(io, room);
	});

	socket.on("join_room", (payload) => {
		if (!joinRoomCooldown.ready()) return;

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

		const engine = runner.getEngine(room.gameId);
		const maxSeats =
			engine?.getMaxSeats?.(room.configPayload) ?? DEFAULT_MAX_SEATS;
		if (room.players.size >= maxSeats) {
			joinAsSpectator(io, socket, store, room, name, "room_full");
			console.log(`[room] ${name} joined ${code} as spectator (room full)`);
			return;
		}

		const outcome = addPlayer(room, playerId, socket.id, name);
		store.trackSocket(socket.id, code, playerId);
		void socket.join(code);
		touchRoom(room);
		logger.info("player " + outcome, { name, roomCode: code });
		if (room.chatHistory.length > 0)
			socket.emit("chat_history", room.chatHistory);
		broadcast(io, room);
	});

	socket.on("spectate_room", (payload) => {
		const result = SpectateRoomSchema.safeParse(payload);
		if (!result.success) {
			socket.emit("room_error", "Invalid payload.");
			return;
		}
		const { code } = result.data;
		const name = result.data.name?.trim() || "Spectator";

		if (
			store.findBySocket(socket.id) ||
			store.findSpectatorBySocket(socket.id)
		) {
			// socket already in a room as host/player/spectator
			socket.emit("room_error", "Already in a room.");
			return;
		}

		const room = store.get(code);
		if (!room) {
			socket.emit("room_error", "Room not found.");
			return;
		}
		if (room.spectators.size >= MAX_SPECTATORS_PER_ROOM) {
			socket.emit("room_error", "Too many spectators in this room.");
			return;
		}

		joinAsSpectator(io, socket, store, room, name, "requested");
		console.log(
			`[room] "${name}" spectating ${code} (${String(room.spectators.size)} watching)`,
		);
	});

	socket.on("rejoin_room", (payload) => {
		if (!rejoinRoomCooldown.ready()) return;

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
				logger.info("host rejoined within lobby grace period", {
					roomCode: room.code,
				});
			}

			store.untrackSocket(room.hostSocketId);
			room.hostSocketId = socket.id;
			store.trackSocket(socket.id, code);
			void socket.join(code);
			touchRoom(room);
			logger.info("host rejoined", { roomCode: code });

			if (room.chatHistory.length > 0)
				socket.emit("chat_history", room.chatHistory);

			if (room.phase === "paused" && room.pauseReason === "host_disconnected") {
				runner.onHostReconnect(room, io, store);
				logger.info("host reconnected — resuming", { roomCode: code });
			} else {
				broadcast(io, room);
			}

			if (room.phase === "in_game") {
				void runner.resendSecret(room, playerId, io);
			}
			return;
		}

		const existing = room.players.get(playerId);
		if (existing?.socketId !== null && existing !== undefined) {
			store.untrackSocket(existing.socketId);
		}

		const ok = rejoinPlayer(room, playerId, socket.id);
		if (!ok) {
			socket.emit("rejoin_failed");
			return;
		}
		store.trackSocket(socket.id, code, playerId);
		void socket.join(code);
		touchRoom(room);
		logger.info("player rejoined", { playerId, roomCode: code });
		if (room.chatHistory.length > 0)
			socket.emit("chat_history", room.chatHistory);
		broadcast(io, room);
		if (room.phase === "in_game") {
			void runner.resendSecret(room, playerId, io);
		}
	});

	socket.on("kick_player", (payload) => {
		const result = KickPlayerSchema.safeParse(payload);
		if (!result.success) return;

		const room = store.findBySocket(socket.id);
		if (!room || !isHostSocket(room, socket.id) || room.phase !== "lobby")
			return;

		const target = room.players.get(result.data.playerId);
		if (!target) return;

		const partyLeaderId = room.players.keys().next().value;
		if (result.data.playerId === partyLeaderId) return;

		if (target.socketId !== null) {
			io.to(target.socketId).emit("kicked");
			io.in(target.socketId).socketsLeave(room.code);
			store.untrackSocket(target.socketId);
		}
		removePlayerById(room, target.playerId);
		runner.notifyPlayerRemoved(room);
		broadcast(io, room);
	});

	socket.on("add_cpu_seat", () => {
		const room = store.findBySocket(socket.id);
		if (!room || !isHostSocket(room, socket.id) || room.phase !== "lobby")
			return;
		// need at least one human (party leader) for cpu seat
		if (room.players.size === 0) return;

		const engine = runner.getEngine(room.gameId);
		if (!engine?.supportsCpuSeats) return;

		const maxSeats =
			engine.getMaxSeats?.(room.configPayload) ?? DEFAULT_MAX_SEATS;
		if (room.players.size >= maxSeats) {
			socket.emit("room_error", "Room is full.");
			return;
		}

		addCpuSeat(room);
		touchRoom(room);
		broadcast(io, room);
	});

	socket.on("remove_cpu_seat", (payload) => {
		const result = RemoveCpuSeatSchema.safeParse(payload);
		if (!result.success) return;

		const room = store.findBySocket(socket.id);
		if (!room || !isHostSocket(room, socket.id) || room.phase !== "lobby")
			return;

		const target = room.players.get(result.data.playerId);
		if (!target?.isCpu) return;

		removePlayerById(room, target.playerId);
		runner.notifyPlayerRemoved(room);
		broadcast(io, room);
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
		const validationError = runner.validateStart(room);
		if (validationError) {
			socket.emit("room_error", validationError);
			return;
		}
		runner.startGame(room, io, store);
	});

	socket.on("player_action", (payload) => {
		if (!actionCooldown.ready()) return;

		const found = store.findPlayerBySocket(socket.id);
		if (!found) return;
		const { room, playerId } = found;

		if (room.phase === "lobby") {
			const isHost = isHostSocket(room, socket.id);
			runner.handleConfigUpdate(room, playerId, isHost, payload, io);
			return;
		}

		runner.handleAction(room, playerId, payload, io, store);
	});

	// chat not routed through game engine; available in every phase including lobby
	socket.on("send_chat_message", (payload) => {
		// cheap checks first
		if (!chatCooldown.ready() || !chatBurstLimiter.ready()) return;

		const result = SendChatMessageSchema.safeParse(payload);
		if (!result.success) return;

		const room =
			store.findBySocket(socket.id) ?? store.findSpectatorBySocket(socket.id);
		if (!room) return;

		// server derives identity from room records, not payload
		const sender = resolveChatSender(room, socket.id);
		if (!sender) return;

		const message = {
			id: randomUUID(),
			playerId: sender.playerId,
			name: sender.name,
			role: sender.role,
			text: result.data.text,
			sentAt: Date.now(),
		};

		pushChatMessage(room, message);
		touchRoom(room);
		// broadcast chat_message only, not game_state, to avoid bandwidth and unrelated UI updates
		io.to(room.code).emit("chat_message", message);
	});

	socket.on("pause_game", () => {
		const room = store.findBySocket(socket.id);
		if (!room || !isHostSocket(room, socket.id) || room.phase !== "in_game")
			return;
		runner.pauseGame(room, "manual", io);
	});

	socket.on("resume_game", () => {
		const room = store.findBySocket(socket.id);
		if (
			!room ||
			!isHostSocket(room, socket.id) ||
			room.phase !== "paused" ||
			room.pauseReason !== "manual"
		)
			return;
		runner.resumeGame(room, io, store);
	});

	socket.on("leave_room", () => {
		handleIntentionalLeave(io, socket, store, runner);
	});
	socket.on("disconnect", (reason) => {
		handleDisconnect(io, socket, store, reason, runner);
	});
}