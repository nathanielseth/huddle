import { z } from "zod";

export const CreateRoomSchema = z.object({
	gameId: z.string().min(1).max(50),
	playerId: z.string().uuid(),
});

export const JoinRoomSchema = z.object({
	code: z.string().length(4).toUpperCase(),
	name: z.string().min(1).max(10).trim(),
	playerId: z.string().uuid(),
});

export const RejoinRoomSchema = z.object({
	code: z.string().length(4).toUpperCase(),
	playerId: z.string().uuid(),
	role: z.enum(["host", "player"]),
});

export type CreateRoomPayload = z.infer<typeof CreateRoomSchema>;
export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type RejoinRoomPayload = z.infer<typeof RejoinRoomSchema>;
