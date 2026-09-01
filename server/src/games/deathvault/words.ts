export const SCRAMBLE_WORDS: ReadonlyArray<{
	word: string;
	difficulty: 1 | 2 | 3;
	hint: string;
}> = [
	// easy
	{ word: "PLANET", difficulty: 1, hint: "Found in space" },
	{ word: "BRIDGE", difficulty: 1, hint: "Crosses a gap" },
	{ word: "CASTLE", difficulty: 1, hint: "Medieval fortress" },
	{ word: "JUNGLE", difficulty: 1, hint: "Dense tropical forest" },
	{ word: "MIRROR", difficulty: 1, hint: "Shows your reflection" },
	{ word: "POCKET", difficulty: 1, hint: "Stores small items" },
	{ word: "ROCKET", difficulty: 1, hint: "Goes to space" },
	{ word: "SILVER", difficulty: 1, hint: "Precious metal" },
	{ word: "TICKET", difficulty: 1, hint: "Grants entry" },
	{ word: "WINDOW", difficulty: 1, hint: "You see through it" },
	// medium
	{ word: "BLANKET", difficulty: 2, hint: "Keeps you warm" },
	{ word: "CABINET", difficulty: 2, hint: "Kitchen storage" },
	{ word: "CAPTAIN", difficulty: 2, hint: "Leads the crew" },
	{ word: "DIAMOND", difficulty: 2, hint: "Hardest natural material" },
	{ word: "FANTASY", difficulty: 2, hint: "Genre of imagination" },
	{ word: "GRAVITY", difficulty: 2, hint: "Keeps you grounded" },
	{ word: "HORIZON", difficulty: 2, hint: "Where sky meets earth" },
	{ word: "LANTERN", difficulty: 2, hint: "Portable light source" },
	{ word: "MYSTERY", difficulty: 2, hint: "Unsolved puzzle" },
	{ word: "NETWORK", difficulty: 2, hint: "Connected systems" },
	{ word: "TRIUMPH", difficulty: 2, hint: "Great victory" },
	{ word: "VOLTAGE", difficulty: 2, hint: "Electrical measurement" },
	// hard
	{ word: "ABSURDLY", difficulty: 3, hint: "Ridiculously" },
	{ word: "BLACKOUT", difficulty: 3, hint: "Power failure or memory gap" },
	{ word: "CALCULUS", difficulty: 3, hint: "Advanced mathematics" },
	{ word: "JEALOUSY", difficulty: 3, hint: "Green-eyed feeling" },
	{ word: "LABYRINTH", difficulty: 3, hint: "Complex maze" },
	{ word: "MONARCHY", difficulty: 3, hint: "Royal government" },
	{ word: "PHARMACY", difficulty: 3, hint: "Where you get medicine" },
	{ word: "QUANTITY", difficulty: 3, hint: "How much of something" },
	{ word: "SKELETON", difficulty: 3, hint: "Framework of bones" },
	{ word: "SYMPHONY", difficulty: 3, hint: "Orchestral composition" },
];
