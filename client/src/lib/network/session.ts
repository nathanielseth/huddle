export interface RoomSession {
	roomCode: string;
	role: "host" | "player";
	playerName: string;
}

const SESSION_KEY = "huddle_room:v1";

export function saveRoomSession(session: RoomSession): void {
	localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearRoomSession(): void {
	localStorage.removeItem(SESSION_KEY);
}

export function loadRoomSession(): RoomSession | null {
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as RoomSession;
	} catch {
		return null;
	}
}