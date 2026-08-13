import type {
	GameState,
	Player,
	RoomPhase,
	GameTimer,
	PauseReason,
} from "../../../shared/core/room";

export interface RoomPlayer {
	playerId: string;
	socketId: string | null;
	name: string;
	score: number;
	isConnected: boolean;
	isCpu: boolean;
}

export interface RoomSpectator {
	socketId: string;
	name: string;
	joinedAt: number;
}

export interface Room {
	code: string;
	hostPlayerId: string;
	hostSocketId: string;
	players: Map<string, RoomPlayer>;
	spectators: Map<string, RoomSpectator>; // keyed by socketId
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
	private socketToSpectatorCode = new Map<string, string>();

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
				if (p.socketId === null) continue; // CPU seat: never tracked
				this.socketToCode.delete(p.socketId);
				this.socketToPlayerId.delete(p.socketId);
			}
			for (const s of room.spectators.values()) {
				this.socketToSpectatorCode.delete(s.socketId);
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

	trackSpectatorSocket(socketId: string, roomCode: string): void {
		this.socketToSpectatorCode.set(socketId, roomCode);
	}

	untrackSpectatorSocket(socketId: string): void {
		this.socketToSpectatorCode.delete(socketId);
	}

	findSpectatorBySocket(socketId: string): Room | null {
		const code = this.socketToSpectatorCode.get(socketId);
		return code !== undefined ? (this.rooms.get(code) ?? null) : null;
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
		spectators: new Map(),
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
		isCpu: false,
	});
	return "joined";
}

const CPU_ID_PREFIX = "cpu::";

const CPU_NAMES = [
	"Bot Dre",
	"Bot Nate",
	"Bot Waks",
	"Bot Cze",
	"Bot Arman",
	"Bot Jaen",
] as const;

function getRandomCpuName(room: Room): string {
	const usedNames = new Set(
		[...room.players.values()]
			.filter((player) => player.isCpu)
			.map((player) => player.name),
	);

	const availableNames = CPU_NAMES.filter((name) => !usedNames.has(name));

	const names = availableNames.length > 0 ? availableNames : CPU_NAMES;
	const index = Math.floor(Math.random() * names.length);

	return names[index]!;
}

export function isCpuPlayerId(playerId: string): boolean {
	return playerId.startsWith(CPU_ID_PREFIX);
}

export function addCpuSeat(room: Room, name?: string): string {
	let n = 0;
	let playerId = `${CPU_ID_PREFIX}${n}`;

	while (room.players.has(playerId)) {
		n++;
		playerId = `${CPU_ID_PREFIX}${n}`;
	}

	const displayName = name ?? getRandomCpuName(room);

	room.players.set(playerId, {
		playerId,
		socketId: null,
		name: displayName,
		score: 0,
		isConnected: true,
		isCpu: true,
	});

	return playerId;
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

export function removePlayerById(room: Room, playerId: string): void {
	room.players.delete(playerId);
}

export function addSpectator(room: Room, socketId: string, name: string): void {
	room.spectators.set(socketId, { socketId, name, joinedAt: Date.now() });
}

export function removeSpectator(room: Room, socketId: string): void {
	room.spectators.delete(socketId);
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
		isCpu: p.isCpu,
	}));
	return {
		roomCode: room.code,
		gameId: room.gameId,
		phase: room.phase,
		players,
		spectatorCount: room.spectators.size,
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