export interface RoomSession {
	roomCode: string;
	role: "host" | "player";
	playerName: string;
}

export function saveRoomSession(session: RoomSession): void {
	localStorage.setItem("huddle_room", JSON.stringify(session));
}

export function clearRoomSession(): void {
	localStorage.removeItem("huddle_room");
}

export function loadRoomSession(): RoomSession | null {
	try {
		const raw = localStorage.getItem("huddle_room");
		if (!raw) return null;
		return JSON.parse(raw) as RoomSession;
	} catch {
		return null;
	}
}
