import { z } from "zod";

export const CreateRoomSchema = z.object({
	gameId: z.string().min(1).max(50),
	playerId: z.uuid(),
});

export const JoinRoomSchema = z.object({
	code: z.string().length(4).toUpperCase(),
	name: z.string().min(1).max(10).trim(),
	playerId: z.uuid(),
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

export type CreateRoomPayload = z.infer<typeof CreateRoomSchema>;
export type JoinRoomPayload = z.infer<typeof JoinRoomSchema>;
export type RejoinRoomPayload = z.infer<typeof RejoinRoomSchema>;
export type KickPlayerPayload = z.infer<typeof KickPlayerSchema>;
export type RemoveCpuSeatPayload = z.infer<typeof RemoveCpuSeatSchema>;