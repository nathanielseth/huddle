import type {
	GameState,
	Player,
	RoomPhase,
	GameTimer,
	PauseReason,
} from "../../../shared/core/room";

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
	phase: RoomPhase;
	gameId: string | null;
	createdAt: number;
	lastActiveAt: number;
	gamePayload: unknown;
	publicPayload: unknown;
	configPayload: unknown;
	gameConfig: unknown;
	timer: GameTimer | null;
	pausedTimerRemaining: number | null;
	pauseReason: PauseReason | null;
	hostReconnectDeadline: number | null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class RoomRegistry {
	private rooms = new Map<string, Room>();
	private socketToCode = new Map<string, string>();
	private socketToPlayerId = new Map<string, string>();

	get(code: string): Room | undefined {
		return this.rooms.get(code);
	}

	save(room: Room): void {
		this.rooms.set(room.code, room);
	}

	delete(code: string): void {
		const room = this.rooms.get(code);
		if (room) {
			this.socketToCode.delete(room.hostSocketId);
			this.socketToPlayerId.delete(room.hostSocketId);
			for (const p of room.players.values()) {
				this.socketToCode.delete(p.socketId);
				this.socketToPlayerId.delete(p.socketId);
			}
		}
		this.rooms.delete(code);
	}

	get size(): number {
		return this.rooms.size;
	}

	entries(): IterableIterator<[string, Room]> {
		return this.rooms.entries();
	}

	findBySocket(socketId: string): Room | null {
		const code = this.socketToCode.get(socketId);
		return code !== undefined ? (this.rooms.get(code) ?? null) : null;
	}

	findPlayerBySocket(
		socketId: string,
	): { room: Room; playerId: string } | null {
		const code = this.socketToCode.get(socketId);
		const playerId = this.socketToPlayerId.get(socketId);
		if (!code || !playerId) return null;
		const room = this.rooms.get(code);
		if (!room) return null;
		return { room, playerId };
	}

	trackSocket(socketId: string, roomCode: string, playerId?: string): void {
		this.socketToCode.set(socketId, roomCode);
		if (playerId) this.socketToPlayerId.set(socketId, playerId);
	}

	untrackSocket(socketId: string): void {
		this.socketToCode.delete(socketId);
		this.socketToPlayerId.delete(socketId);
	}

	generateCode(): string {
		let code: string;
		do {
			code = Array.from(
				{ length: 4 },
				() => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
			).join("");
		} while (this.rooms.has(code));
		return code;
	}
}

export function createRoom(
	code: string,
	hostPlayerId: string,
	hostSocketId: string,
	gameId: string,
): Room {
	const now = Date.now();
	return {
		code,
		hostPlayerId,
		hostSocketId,
		players: new Map(),
		phase: "lobby",
		gameId,
		createdAt: now,
		lastActiveAt: now,
		gamePayload: null,
		configPayload: null,
		gameConfig: null,
		publicPayload: null,
		timer: null,
		pausedTimerRemaining: null,
		pauseReason: null,
		hostReconnectDeadline: null,
	};
}

export function touchRoom(room: Room): void {
	room.lastActiveAt = Date.now();
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
		timer: room.timer,
		gamePayload: room.publicPayload,
		configPayload: room.configPayload,
		...(room.pauseReason !== null && { pauseReason: room.pauseReason }),
		...(room.hostReconnectDeadline !== null && {
			hostReconnectDeadline: room.hostReconnectDeadline,
		}),
	};
}

export function isExpired(room: Room): boolean {
	return Date.now() - room.lastActiveAt > 1000 * 60 * 15;
}