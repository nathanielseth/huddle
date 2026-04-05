import type { GamePhase, GameState, Player } from "../../shared/types.js";

export interface RoomPlayer {
	playerId: string;
	socketId: string;
	name: string;
	score: number;
	isConnected: boolean;
}

export interface Room {
	code: string;
	hostPlayerId: string;
	hostSocketId: string;
	players: Map<string, RoomPlayer>;
	phase: GamePhase;
	gameId: string | null;
	createdAt: number;
}

export function generateCode(rooms: Map<string, Room>): string {
	let code: string;
	do {
		code = Math.random().toString(36).substring(2, 6).toUpperCase();
	} while (rooms.has(code));
	return code;
}

export function createRoom(
	code: string,
	hostPlayerId: string,
	hostSocketId: string,
	gameId: string,
): Room {
	return {
		code,
		hostPlayerId,
		hostSocketId,
		players: new Map(),
		phase: "lobby",
		gameId,
		createdAt: Date.now(),
	};
}

export function addPlayer(
	room: Room,
	playerId: string,
	socketId: string,
	name: string,
): "joined" | "reconnected" {
	const existing = room.players.get(playerId);
	if (existing) {
		existing.socketId = socketId;
		existing.isConnected = true;
		return "reconnected";
	}
	room.players.set(playerId, {
		playerId,
		socketId,
		name,
		score: 0,
		isConnected: true,
	});
	return "joined";
}

// only reconnects existing players
export function rejoinPlayer(
	room: Room,
	playerId: string,
	socketId: string,
): boolean {
	const existing = room.players.get(playerId);
	if (!existing) return false;
	existing.socketId = socketId;
	existing.isConnected = true;
	return true;
}

export function removePlayer(room: Room, socketId: string): void {
	for (const [playerId, player] of room.players) {
		if (player.socketId === socketId) {
			room.players.delete(playerId);
			return;
		}
	}
}

export function markDisconnected(room: Room, socketId: string): void {
	for (const player of room.players.values()) {
		if (player.socketId === socketId) {
			player.isConnected = false;
			return;
		}
	}
}

export function findPlayerBySocket(
	room: Room,
	socketId: string,
): RoomPlayer | null {
	for (const player of room.players.values()) {
		if (player.socketId === socketId) return player;
	}
	return null;
}

export function findRoomBySocket(
	rooms: Map<string, Room>,
	socketId: string,
): Room | null {
	for (const room of rooms.values()) {
		if (room.hostSocketId === socketId) return room;
		for (const player of room.players.values()) {
			if (player.socketId === socketId) return room;
		}
	}
	return null;
}

export function isHostSocket(room: Room, socketId: string): boolean {
	return room.hostSocketId === socketId;
}

export function getPublicState(room: Room): GameState {
	const players: Player[] = Array.from(room.players.values()).map((p) => ({
		id: p.playerId,
		name: p.name,
		score: p.score,
		isConnected: p.isConnected,
	}));
	return {
		roomCode: room.code,
		gameId: room.gameId,
		phase: room.phase,
		players,
	};
}

export function isExpired(room: Room): boolean {
	return Date.now() - room.createdAt > 1000 * 60 * 120;
}
