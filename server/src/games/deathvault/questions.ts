// ─────────────────────────────────────────────────────────────────────────────
// server/src/games/deathvault/questions.ts
//
// Static question bank. Expand freely — the engine picks from this list
// without replacement each game. Choices are lettered A–D; correctChoiceId
// always references a choice id present in the choices array.
// ─────────────────────────────────────────────────────────────────────────────

import type { DeathvaultServerQuestion } from "./types";

// Stable auto-incrementing IDs — questions are module-level singletons so
// counters make logs easier to read than opaque hashes.
let _qid = 0;
function nextQid(): string {
	return `dv_q${(++_qid).toString().padStart(3, "0")}`;
}

const CHOICE_IDS = ["a", "b", "c", "d"] as const;
type ChoiceIndex = 0 | 1 | 2 | 3;

/** Compact question factory — correct answer is always index 0 in source order
 *  so we never have to touch correctChoiceId by hand. */
function q(
	category: string,
	difficulty: 1 | 2 | 3,
	prompt: string,
	// Tuple enforces exactly 4 choices at compile time
	[c0, c1, c2, c3]: [string, string, string, string],
	correctIndex: ChoiceIndex = 0,
): DeathvaultServerQuestion {
	return {
		id: nextQid(),
		category,
		difficulty,
		prompt,
		choices: [
			{ id: CHOICE_IDS[0], text: c0 },
			{ id: CHOICE_IDS[1], text: c1 },
			{ id: CHOICE_IDS[2], text: c2 },
			{ id: CHOICE_IDS[3], text: c3 },
		],
		correctChoiceId: CHOICE_IDS[correctIndex],
	};
}

const QUESTION_BANK: readonly DeathvaultServerQuestion[] = [
	// ── Science ─────────────────────────────────────────────────────────────
	q("Science", 1, "What is the chemical symbol for gold?", [
		"Au",
		"Ag",
		"Gd",
		"Go",
	]),
	q("Science", 1, "How many bones are in the adult human body?", [
		"206",
		"198",
		"214",
		"212",
	]),
	q("Science", 1, "What planet is known as the Red Planet?", [
		"Mars",
		"Venus",
		"Jupiter",
		"Saturn",
	]),
	q("Science", 2, "What is the powerhouse of the cell?", [
		"Mitochondria",
		"Nucleus",
		"Ribosome",
		"Golgi body",
	]),
	q(
		"Science",
		2,
		"At what temperature do Celsius and Fahrenheit scales coincide?",
		["-40°", "0°", "32°", "-20°"],
	),
	q("Science", 2, "What is the most abundant gas in Earth's atmosphere?", [
		"Nitrogen",
		"Oxygen",
		"Carbon dioxide",
		"Argon",
	]),
	q("Science", 3, "Which subatomic particle has no electric charge?", [
		"Neutron",
		"Proton",
		"Electron",
		"Positron",
	]),
	q("Science", 3, "What is the half-life of Carbon-14?", [
		"5,730 years",
		"1,600 years",
		"14,000 years",
		"710 years",
	]),
	q(
		"Science",
		3,
		"Which enzyme unwinds the DNA double helix during replication?",
		["Helicase", "Polymerase", "Ligase", "Topoisomerase"],
	),

	// ── History ─────────────────────────────────────────────────────────────
	q("History", 1, "In what year did World War II end?", [
		"1945",
		"1943",
		"1947",
		"1944",
	]),
	q("History", 1, "Who was the first President of the United States?", [
		"George Washington",
		"John Adams",
		"Thomas Jefferson",
		"Benjamin Franklin",
	]),
	q("History", 2, "The Berlin Wall fell in which year?", [
		"1989",
		"1991",
		"1987",
		"1985",
	]),
	q("History", 2, "Which empire built Machu Picchu?", [
		"Inca",
		"Aztec",
		"Maya",
		"Olmec",
	]),
	q("History", 2, "Who delivered the 'I Have a Dream' speech?", [
		"Martin Luther King Jr.",
		"Malcolm X",
		"Medgar Evers",
		"John Lewis",
	]),
	q(
		"History",
		3,
		"The Battle of Thermopylae was fought between which two forces?",
		[
			"Greeks and Persians",
			"Romans and Carthaginians",
			"Greeks and Romans",
			"Spartans and Athenians",
		],
	),
	q("History", 3, "Which ancient city was known as 'The Eternal City'?", [
		"Rome",
		"Athens",
		"Alexandria",
		"Constantinople",
	]),
	q(
		"History",
		3,
		"What was the name of the ship Charles Darwin sailed on during his voyage?",
		["HMS Beagle", "HMS Endeavour", "HMS Victory", "HMS Discovery"],
	),

	// ── Pop Culture ──────────────────────────────────────────────────────────
	q("Pop Culture", 1, "Who played Iron Man in the Marvel Cinematic Universe?", [
		"Robert Downey Jr.",
		"Chris Evans",
		"Chris Hemsworth",
		"Mark Ruffalo",
	]),
	q("Pop Culture", 1, "Which band performed 'Bohemian Rhapsody'?", [
		"Queen",
		"The Beatles",
		"Led Zeppelin",
		"Pink Floyd",
	]),
	q(
		"Pop Culture",
		1,
		"What is the name of the fictional kingdom in 'Frozen'?",
		["Arendelle", "Corona", "Agrabah", "Zootopia"],
	),
	q(
		"Pop Culture",
		2,
		"In 'Breaking Bad', what is Walter White's street alias?",
		["Heisenberg", "The Cook", "Mr. White", "Danger"],
	),
	q("Pop Culture", 2, "Which video game franchise features Master Chief?", [
		"Halo",
		"Call of Duty",
		"Gears of War",
		"Destiny",
	]),
	q(
		"Pop Culture",
		2,
		"What is the highest-grossing film of all time (unadjusted)?",
		["Avatar", "Avengers: Endgame", "Titanic", "Star Wars: The Force Awakens"],
	),
	q("Pop Culture", 3, "What year was the first iPhone released?", [
		"2007",
		"2005",
		"2008",
		"2006",
	]),
	q("Pop Culture", 3, "Which artist holds the record for most Grammy wins?", [
		"Beyoncé",
		"Taylor Swift",
		"Adele",
		"Jay-Z",
	]),

	// ── Geography ───────────────────────────────────────────────────────────
	q("Geography", 1, "What is the capital of Australia?", [
		"Canberra",
		"Sydney",
		"Melbourne",
		"Brisbane",
	]),
	q("Geography", 1, "Which is the longest river in the world?", [
		"Nile",
		"Amazon",
		"Yangtze",
		"Mississippi",
	]),
	q("Geography", 2, "Which country has the most natural lakes?", [
		"Canada",
		"Russia",
		"USA",
		"Brazil",
	]),
	q("Geography", 2, "What is the smallest country in the world by area?", [
		"Vatican City",
		"Monaco",
		"San Marino",
		"Liechtenstein",
	]),
	q("Geography", 2, "The Strait of Gibraltar separates which two continents?", [
		"Europe and Africa",
		"Europe and Asia",
		"Asia and Africa",
		"North and South America",
	]),
	q("Geography", 3, "What is the only sea without any coasts?", [
		"Sargasso Sea",
		"Dead Sea",
		"Caspian Sea",
		"Aral Sea",
	]),
	q("Geography", 3, "Which mountain range separates Europe from Asia?", [
		"Ural Mountains",
		"Caucasus Mountains",
		"Alps",
		"Carpathians",
	]),

	// ── Sports ──────────────────────────────────────────────────────────────
	q("Sports", 1, "How many players are on a standard soccer team?", [
		"11",
		"9",
		"10",
		"12",
	]),
	q("Sports", 1, "In which sport do players score a 'birdie'?", [
		"Golf",
		"Tennis",
		"Badminton",
		"Cricket",
	]),
	q("Sports", 2, "How many rings are on the Olympic flag?", [
		"5",
		"4",
		"6",
		"7",
	]),
	q("Sports", 2, "Which country has won the most FIFA World Cups?", [
		"Brazil",
		"Germany",
		"Italy",
		"Argentina",
	]),
	q(
		"Sports",
		3,
		"Who holds the record for most Grand Slam tennis singles titles?",
		["Novak Djokovic", "Rafael Nadal", "Roger Federer", "Pete Sampras"],
	),

	// ── Food & Drink ─────────────────────────────────────────────────────────
	q("Food & Drink", 1, "What fruit is used to make guacamole?", [
		"Avocado",
		"Lime",
		"Mango",
		"Tomato",
	]),
	q("Food & Drink", 1, "Sushi originates from which country?", [
		"Japan",
		"China",
		"Korea",
		"Thailand",
	]),
	q(
		"Food & Drink",
		2,
		"What is the main ingredient in a traditional French bouillabaisse?",
		["Seafood", "Beef", "Chicken", "Vegetables"],
	),
	q("Food & Drink", 2, "Which spice is derived from the Crocus flower?", [
		"Saffron",
		"Turmeric",
		"Paprika",
		"Cardamom",
	]),
	q(
		"Food & Drink",
		3,
		"What is the process called when bread dough rises due to yeast?",
		["Fermentation", "Osmosis", "Oxidation", "Hydration"],
	),
	q("Food & Drink", 3, "Which country produces the most coffee in the world?", [
		"Brazil",
		"Colombia",
		"Vietnam",
		"Ethiopia",
	]),

	// ── Tech ─────────────────────────────────────────────────────────────────
	q("Tech", 1, "What does 'HTTP' stand for?", [
		"HyperText Transfer Protocol",
		"High Transfer Text Protocol",
		"HyperText Transit Protocol",
		"Hybrid Text Transfer Protocol",
	]),
	q("Tech", 2, "What year was the World Wide Web publicly introduced?", [
		"1991",
		"1989",
		"1995",
		"1993",
	]),
	q(
		"Tech",
		2,
		"Which programming language is known as the 'mother of all languages'?",
		["C", "Assembly", "FORTRAN", "COBOL"],
	),
	q("Tech", 3, "What does 'SQL' stand for?", [
		"Structured Query Language",
		"Simple Query Language",
		"Standard Query List",
		"Sequential Query Logic",
	]),
	q("Tech", 3, "Who is credited with inventing the World Wide Web?", [
		"Tim Berners-Lee",
		"Vint Cerf",
		"Bob Kahn",
		"Marc Andreessen",
	]),
];

/** Subset of questions per difficulty for weighted round selection */
export function getQuestionsByDifficulty(
	difficulty: 1 | 2 | 3,
): DeathvaultServerQuestion[] {
	return QUESTION_BANK.filter((entry) => entry.difficulty === difficulty);
}