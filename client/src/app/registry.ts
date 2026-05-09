import { Sabong } from "@/games/sabong/Sabong";
import { Sussy } from "@/games/sussy/Sussy";
import { BelievableLies } from "@/games/believable-lies/BelievableLies";
import { Witzone } from "@/games/witzone/Witzone";
import type { ComponentType } from "react";

interface GameEntry {
	id: string;
	inGame: ComponentType;
	ended?: ComponentType;
}

export const GAME_REGISTRY: GameEntry[] = [
	{
		id: "super-sabong",
		inGame: Sabong,
		// fix ts l8r
	},
	{
		id: "sussy-impostors",
		inGame: Sussy,
		ended: Sussy,
	},
	{
		id: "believable-lies",
		inGame: BelievableLies,
		ended: BelievableLies,
	},
	{
		id: "witzone",
		inGame: Witzone,
		ended: Witzone,
	},
];
