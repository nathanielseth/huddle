import { z } from "zod";
import { MAX_CHAT_MESSAGE_LENGTH } from "../../../shared/core/chat";

export const CreateRoomSchema = z.object({
	gameId: z.string().min(1).max(50),
	playerId: z.uuid(),
});

export const JoinRoomSchema = z.object({
	code: z.string().length(4).toUpperCase(),
	name: z.string().min(1).max(10).trim(),
	playerId: z.uuid(),
});

export const SpectateRoomSchema = z.object({
	code: z.string().length(4).toUpperCase(),
	name: z.string().min(1).max(10).trim().optional(),
});

export const RejoinRoomSchema = z.object({
	code: z.string().length(4).toUpperCase(),
	playerId: z.uuid(),
	role: z.enum(["host", "player"]),
});

export const KickPlayerSchema = z.object({
	playerId: z.string(),
});

export const RemoveCpuSeatSchema = z.object({
	playerId: z.string(),
});

export const SendChatMessageSchema = z.object({
	text: z.string().trim().min(1).max(MAX_CHAT_MESSAGE_LENGTH),
});

export type CreateRoomPayload = z.infer<typeof CreateRoomSchema>;
export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type SpectateRoomPayload = z.infer<typeof SpectateRoomSchema>;
export type RejoinRoomPayload = z.infer<typeof RejoinRoomSchema>;
export type KickPlayerPayload = z.infer<typeof KickPlayerSchema>;
export type RemoveCpuSeatPayload = z.infer<typeof RemoveCpuSeatSchema>;
export type SendChatMessagePayload = z.infer<typeof SendChatMessageSchema>;