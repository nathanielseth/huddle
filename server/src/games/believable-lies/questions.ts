import type { BelievableLiesQuestion } from "./types";

export const QUESTION_BANK: BelievableLiesQuestion[] = [
	// ── History ────────────────────────────────────────────────────────────────
	{
		id: "h01",
		category: "History",
		prompt: "Napoleon Bonaparte was reportedly terrified of ______.",
		truth: "cats",
		alternate_truths: ["cat"],
		game_lies: ["heights", "clowns", "the sea", "horses"],
	},
	{
		id: "h02",
		category: "History",
		prompt: "Ancient Romans used ______ as a toothpaste ingredient.",
		truth: "urine",
		alternate_truths: ["pee", "human urine"],
		game_lies: ["chalk", "charcoal", "ash", "vinegar"],
	},
	{
		id: "h03",
		category: "History",
		prompt:
			"Cleopatra lived closer in time to the Moon landing than to the construction of ______.",
		truth: "the Great Pyramid",
		alternate_truths: [
			"the pyramids",
			"the great pyramid of giza",
			"pyramid of giza",
		],
		game_lies: [
			"the Colosseum",
			"Stonehenge",
			"the Parthenon",
			"the Great Wall",
		],
	},
	{
		id: "h04",
		category: "History",
		prompt: "The shortest war in history lasted approximately ______ minutes.",
		truth: "38",
		alternate_truths: ["thirty-eight", "thirty eight"],
		game_lies: ["12", "90", "45", "22"],
	},
	{
		id: "h05",
		category: "History",
		prompt: "Oxford University is older than the Aztec ______.",
		truth: "Empire",
		alternate_truths: ["empire", "civilization"],
		game_lies: ["calendar", "language", "religion", "alphabet"],
	},

	// ── Science & Nature ───────────────────────────────────────────────────────
	{
		id: "s01",
		category: "Science",
		prompt: "A day on Venus is longer than a ______ on Venus.",
		truth: "year",
		alternate_truths: [],
		game_lies: ["night", "season", "century", "decade"],
	},
	{
		id: "s02",
		category: "Science",
		prompt:
			"Honey never spoils. Edible honey was found in Egyptian tombs over ______ years old.",
		truth: "3000",
		alternate_truths: ["three thousand", "3,000"],
		game_lies: ["500", "1000", "800", "2000"],
	},
	{
		id: "s03",
		category: "Science",
		prompt: "A group of flamingos is called a ______.",
		truth: "flamboyance",
		alternate_truths: [],
		game_lies: ["colony", "flock", "bloom", "parade"],
	},
	{
		id: "s04",
		category: "Science",
		prompt: "Octopuses have three ______.",
		truth: "hearts",
		alternate_truths: ["heart"],
		game_lies: ["brains", "stomachs", "livers", "lungs"],
	},
	{
		id: "s05",
		category: "Science",
		prompt: "The mantis shrimp can punch with the force of a ______.",
		truth: "bullet",
		alternate_truths: ["gun", "gunshot"],
		game_lies: ["jackhammer", "car crash", "baseball bat", "hammer"],
	},
	{
		id: "s06",
		category: "Science",
		prompt: "Wombat droppings are shaped like ______.",
		truth: "cubes",
		alternate_truths: ["cube", "squares", "square"],
		game_lies: ["spirals", "pellets", "cylinders", "stars"],
	},

	// ── Food & Drink ───────────────────────────────────────────────────────────
	{
		id: "f01",
		category: "Food",
		prompt: "Ketchup was originally sold in the 1800s as ______.",
		truth: "medicine",
		alternate_truths: ["a medicine", "medication"],
		game_lies: ["hair dye", "a cleaning product", "ink", "fertilizer"],
	},
	{
		id: "f02",
		category: "Food",
		prompt: "Carrots were originally ______ before selective breeding.",
		truth: "purple",
		alternate_truths: [],
		game_lies: ["white", "yellow", "green", "red"],
	},
	{
		id: "f03",
		category: "Food",
		prompt: "A pineapple takes about ______ years to fully grow.",
		truth: "2",
		alternate_truths: ["two"],
		game_lies: ["5", "1", "3", "6 months"],
	},
	{
		id: "f04",
		category: "Food",
		prompt: "Cashews are related to ______ and poison ivy.",
		truth: "mangoes",
		alternate_truths: ["mango"],
		game_lies: ["pistachios", "almonds", "avocados", "peanuts"],
	},

	// ── Pop Culture ────────────────────────────────────────────────────────────
	{
		id: "p01",
		category: "Pop Culture",
		prompt: "The Game Boy was originally bundled with ______, not Super Mario.",
		truth: "Tetris",
		alternate_truths: [],
		game_lies: ["Donkey Kong", "Pac-Man", "Balloon Kid", "Metroid"],
	},
	{
		id: "p02",
		category: "Pop Culture",
		prompt: "The voice of Mickey Mouse married the voice of ______.",
		truth: "Minnie Mouse",
		alternate_truths: ["minnie"],
		game_lies: ["Snow White", "Cinderella", "Tinker Bell", "Sleeping Beauty"],
	},
	{
		id: "p03",
		category: "Pop Culture",
		prompt:
			"Sean Connery turned down the role of ______ in The Lord of the Rings.",
		truth: "Gandalf",
		alternate_truths: [],
		game_lies: ["Aragorn", "Saruman", "Frodo", "Boromir"],
	},

	// ── Filipino / Local ───────────────────────────────────────────────────────
	{
		id: "ph01",
		category: "Filipino",
		prompt: "The Philippines is the world's largest producer of ______.",
		truth: "coconuts",
		alternate_truths: ["coconut"],
		game_lies: ["bananas", "mangoes", "rice", "sugar cane"],
	},
	{
		id: "ph02",
		category: "Filipino",
		prompt:
			"Before Tagalog, the Philippine national language was briefly ______.",
		truth: "Spanish",
		alternate_truths: [],
		game_lies: ["English", "Cebuano", "Ilocano", "Kapampangan"],
	},
	{
		id: "ph03",
		category: "Filipino",
		prompt:
			"Jollibee was originally a ______ shop before pivoting to fast food.",
		truth: "ice cream",
		alternate_truths: ["ice cream parlor", "ice cream store"],
		game_lies: ["bakery", "coffee", "donut", "burger"],
	},
	{
		id: "ph04",
		category: "Filipino",
		prompt: "The Philippine Eagle's wingspan can reach up to ______ meters.",
		truth: "2",
		alternate_truths: ["two", "2.0"],
		game_lies: ["3", "1.5", "2.5", "1.2"],
	},

	// ── Weird Facts ────────────────────────────────────────────────────────────
	{
		id: "w01",
		category: "Weird",
		prompt:
			"There are more possible iterations of a game of chess than there are ______ in the observable universe.",
		truth: "atoms",
		alternate_truths: ["atom"],
		game_lies: ["stars", "grains of sand", "seconds", "molecules"],
	},
	{
		id: "w02",
		category: "Weird",
		prompt: "A bolt of lightning is five times hotter than the ______.",
		truth: "surface of the sun",
		alternate_truths: ["sun's surface", "the sun"],
		game_lies: [
			"Earth's core",
			"inside a volcano",
			"center of the Earth",
			"a nuclear bomb",
		],
	},
	{
		id: "w03",
		category: "Weird",
		prompt: "Humans share about 60% of their DNA with ______.",
		truth: "bananas",
		alternate_truths: ["a banana"],
		game_lies: ["sharks", "mushrooms", "dogs", "mice"],
	},
	{
		id: "w04",
		category: "Weird",
		prompt:
			"The inventor of the Frisbee was turned into a ______ after he died.",
		truth: "Frisbee",
		alternate_truths: ["a frisbee"],
		game_lies: ["statue", "action figure", "memorial coin", "urn"],
	},
];
