import { socket } from "../../lib/network/socket";
import type { FaceturnsAction } from "@shared/games/face-turn/schemas";

export type { FaceturnsAction };

// fire-and-forget, no ack
// server validates and may silently no-op
export function sendFaceturnAction(action: FaceturnsAction): void {
	socket.emit("player_action", action);
}