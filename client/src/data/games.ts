import type { Game } from "../types/game";

export const GAMES: Game[] = [
	{
		id: "flip-cards",
		name: "Flip Cards",
		placeholderColor: "#0ea5e9",
		description:
			"A fast-paced card game where bluffing beats luck. Play your hand, call out liars, survive.",
		tags: ["deception", "strategy"],
		playerCount: [2, 8],
		duration: 20,
	},
	{
		id: "super-sabong",
		name: "Super Sabong",
		thumbnail: "/games/super_sabong.avif",
		placeholderColor: "#f97316",
		description:
			"Bet on AI-powered manoks fighting it out. Read the odds, go all in, lose everything.",
		tags: ["betting", "social"],
		playerCount: [2, 10],
		duration: 15,
	},
	{
		id: "believable-lies",
		name: "Believable Lies",
		placeholderColor: "#a855f7",
		description:
			"Everyone writes a fake answer. Everyone votes. The best liar wins.",
		tags: ["deception", "writing"],
		playerCount: [3, 8],
		duration: 25,
	},
	{
		id: "wit-showdown",
		name: "WitZone",
		thumbnail: "/games/witzone.avif",
		placeholderColor: "#eab308",
		description:
			"Roast the prompt, outshine the room. Votes decide who's actually funny.",
		tags: ["writing", "social"],
		playerCount: [3, 10],
		duration: 30,
	},
	{
		id: "sussy-impostor",
		name: "Sussy Impostor",
		placeholderColor: "#ef4444",
		description:
			"One player doesn't have the word. Blend in. Don't get caught. Chaos guaranteed.",
		tags: ["deception", "social"],
		playerCount: [4, 10],
		duration: 20,
	},
	{
		id: "art-school",
		name: "Art School",
		placeholderColor: "#10b981",
		description:
			"Draw the prompt with zero artistic talent. Everyone guesses. Someone always nails it.",
		tags: ["drawing", "social"],
		playerCount: [3, 8],
		duration: 25,
	},
];
