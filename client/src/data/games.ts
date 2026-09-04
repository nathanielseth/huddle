import type { Game } from "../types/game";

export const GAMES: Game[] = [
	// HANGOUT PACK 1: BLACKBOX
	{
		id: "breachpoint",
		packId: "pack-1",
		name: "Breachpoint",
		thumbnail: "/games/breachpoint.avif",
		placeholderColor: "#0ea5e9",
		description:
			"A social deduction game of hackers and cybersecurity agents. Propose teams, run missions, secure servers.",
		tags: ["deception", "strategy"],
		playerCount: [5, 10],
		duration: 20,
		beta: true,
	},
	{
		id: "super-sabong",
		packId: "pack-1",
		name: "Super Sabong",
		thumbnail: "/assets/images/super-sabong.avif",
		placeholderColor: "#f97316",
		description:
			"Bet on AI-powered manoks fighting it out. Read the odds, go all in, lose everything.",
		tags: ["betting", "social"],
		playerCount: [2, 8],
		duration: 15,
		beta: true,
	},
	{
		id: "believable-lies",
		packId: "pack-1",
		name: "Believable Lies",
		thumbnail: "/games/believable_lies.avif",
		placeholderColor: "#a855f7",
		description:
			"Everyone writes a fake answer. Everyone votes. The best liar wins.",
		tags: ["deception", "writing"],
		playerCount: [3, 8],
		duration: 25,
		beta: true,
	},
	{
		id: "witzone",
		packId: "pack-1",
		name: "WitZone",
		thumbnail: "/games/witzone.avif",
		placeholderColor: "#eab308",
		description:
			"Roast the prompt, outshine the room. Votes decide who's actually funny.",
		tags: ["writing", "social"],
		playerCount: [3, 8],
		duration: 30,
		beta: true,
	},
	{
		id: "sussy-impostors",
		packId: "pack-1",
		name: "Sussy Impostors",
		thumbnail: "/games/sussy_impostors.avif",
		placeholderColor: "#ef4444",
		description:
			"Everyone gets the same word except one player. Blend in, figure out the impostor, and don't give yourself away.",
		tags: ["deception", "social"],
		playerCount: [3, 6],
		duration: 20,
		beta: true,
	},
	{
		id: "squadoodle",
		packId: "pack-1",
		name: "Squadoodle",
		thumbnail: "/games/squadoodle.avif",
		placeholderColor: "#10b981",
		description:
			"Draw the prompt with zero artistic talent. Everyone guesses. Someone always nails it.",
		tags: ["drawing", "social"],
		playerCount: [4, 12],
		duration: 25,
		beta: true,
	},

	// HANGOUT PACK 2: HOUSE RULES
	{
		id: "poker",
		packId: "pack-2",
		name: "Poker Night",
		thumbnail: "/games/texas_holdem.avif",
		placeholderColor: "#16a34a",
		description:
			"No chips, no table needed. Real poker, real bluffing, right on your TV.",
		tags: ["strategy", "betting"],
		playerCount: [2, 8],
		duration: 30,
		beta: true,
		supportsCpuSeats: true,
	},
	{
		id: "face-turn",
		packId: "pack-2",
		name: "Face Turn",
		thumbnail: "/games/face_turn.avif",
		placeholderColor: "#1d4ed8",
		description:
			"A fast-paced bluffing card game about hidden crews, chained moves, and calling bluffs.",
		tags: ["strategy", "deception"],
		playerCount: [2, 6],
		duration: 20,
		beta: true,
		supportsCpuSeats: true,
	},
	{
		id: "blank-slate",
		packId: "pack-2",
		name: "Blank Slate",
		thumbnail: "/games/blank-slate.avif",
		placeholderColor: "#6366f1",
		description:
			"A word game where everyone gives a clue to the same answer. Matching clues cancel out, so weird answers are worth more.",
		tags: ["writing", "social"],
		playerCount: [3, 7],
		duration: 20,
		beta: true,
	},
];