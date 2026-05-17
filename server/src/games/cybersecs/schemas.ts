import { z } from "zod";
import { C } from "./constants.js";

const MAX_TEAM_SIZE = Math.max(...Object.values(C.MISSION_TEAM_SIZES).flat());
const playerId = z.string().trim().min(1);

export const CybsecsActionSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("skip_vote"),
		skip: z.boolean(),
	}),
	z.object({
		type: z.literal("nominate"),
		team: z.array(playerId).min(1).max(MAX_TEAM_SIZE),
	}),
	z.object({
		type: z.literal("pass"),
	}),
	z.object({
		type: z.literal("vote"),
		choice: z.enum(["approve", "reject"]),
	}),
	z.object({
		type: z.literal("mission_action"),
		action: z.enum(["secure", "hack"]),
	}),
	z.object({
		type: z.literal("doxx"),
		targetId: playerId,
	}),
	z.object({
		type: z.literal("toggle_obfuscate"),
		active: z.boolean(),
	}),
]);
