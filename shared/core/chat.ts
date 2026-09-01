// room chat, outside game action pipeline, ephemeral buffer capped by MAX_CHAT_HISTORY
export const MAX_CHAT_MESSAGE_LENGTH = 300;

// recent messages kept per room for late joiners, not durable history
export const MAX_CHAT_HISTORY = 50;

export type ChatSenderRole = "player" | "spectator";

export interface ChatMessage {
	id: string;
	playerId: string; // room player key or synthetic spectator id
	name: string;
	role: ChatSenderRole;
	text: string;
	sentAt: number;
}