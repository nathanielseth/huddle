import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

interface GameEntry {
	id: string;
	inGame: LazyExoticComponent<ComponentType>;
	config?: LazyExoticComponent<ComponentType>;
}

// named exports can't be passed to lazy() directly, so we wrap them in a helper
function lazyNamed<T extends Record<K, ComponentType>, K extends keyof T>(
	factory: () => Promise<T>,
	name: K,
): LazyExoticComponent<ComponentType> {
	return lazy(() => factory().then((m) => ({ default: m[name] })));
}

export const GAME_REGISTRY: GameEntry[] = [
	{
		id: "super-sabong",
		inGame: lazyNamed(() => import("@/games/sabong/Sabong"), "Sabong"),
	},
	{
		id: "sussy-impostors",
		inGame: lazyNamed(() => import("@/games/sussy/Sussy"), "Sussy"),
	},
	{
		id: "believable-lies",
		inGame: lazyNamed(
			() => import("@/games/believable-lies/BelievableLies"),
			"BelievableLies",
		),
	},
	{
		id: "witzone",
		inGame: lazyNamed(() => import("@/games/witzone/Witzone"), "Witzone"),
	},
	{
		id: "poker",
		inGame: lazyNamed(() => import("@/games/poker/Poker"), "Poker"),
	},
	{
		id: "breachpoint",
		inGame: lazyNamed(() => import("@/games/cybersecs/Cybersecs"), "Cybersecs"),
	},
	{
		id: "squadoodle",
		inGame: lazyNamed(
			() => import("@/games/squadoodle/Squadoodle"),
			"Squadoodle",
		),
	},
	{
		id: "face-turn",
		inGame: lazyNamed(() => import("@/games/face-turn/FaceTurn"), "FaceTurn"),
		config: lazyNamed(
			() => import("@/games/face-turn/FaceTurnConfig"),
			"FaceTurnConfig",
		),
	},
	{
		id: "blank-slate",
		inGame: lazyNamed(
			() => import("@/games/blank-slate/BlankSlate"),
			"BlankSlate",
		),
	},
	//
];