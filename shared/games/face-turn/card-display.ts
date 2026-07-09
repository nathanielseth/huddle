import type { CrewClass, MoveType } from "./types";

export interface BossCardDisplay {
	readonly id: string;
	readonly name: string;
	readonly effectText: {
		readonly faceTurn: string;
		readonly command: string;
		readonly passive: string;
	};
	readonly flavorText: string;
	readonly maxHp: number;
	readonly faceTurnCost: number;
	readonly draftable?: boolean;
	readonly hasCustomCommandLogic?: true;
	readonly artSrc?: string;
}

export interface CrewCardDisplay {
	readonly id: string;
	readonly name: string;
	readonly class: CrewClass;
	readonly effectText: {
		readonly turned?: string;
		readonly passive?: string;
	};
	readonly flavorText: string;
	readonly draftable?: boolean;
	readonly artSrc?: string;
}

export interface MoveCardDisplay {
	readonly id: string;
	readonly name: string;
	readonly baseCost: number;
	readonly moveType: MoveType;
	readonly effectText: string;
	readonly flavorText: string;
	readonly artSrc?: string;
}

// bosses

export const BOSS_DISPLAY: readonly BossCardDisplay[] = [
	{
		id: "the-watcher",
		name: "The Watcher",
		effectText: {
			faceTurn:
				"Pay 6 Cash: unblockable, unchallengeable strike against target enemy Crew. If they have no face-down Crew, executes their Boss instead.",
			command: "Look at target opponent's hand, then gain 2 Cash.",
			passive:
				"Whenever you win a challenge, you may turn one face-up ally Crew face-down.",
		},
		flavorText: "",
		maxHp: 100,
		faceTurnCost: 7,
	},
	{
		id: "the-dealer",
		name: "The Dealer",
		effectText: {
			faceTurn:
				"Pay 6 Cash: unblockable, unchallengeable strike against target enemy Crew. If they have no face-down Crew, executes their Boss instead.",
			command:
				"Replace one face-up ally Crew with your reserved Crew (drafted alongside your other two). The new Crew enters face-down.",
			passive: "Draw 2 cards at the start of your turn.",
		},
		flavorText: "",
		maxHp: 100,
		faceTurnCost: 7,
		hasCustomCommandLogic: true,
	},
	{
		id: "the-razor",
		name: "The Razor",
		effectText: {
			faceTurn:
				"Pay 6 Cash: unblockable, unchallengeable strike against target enemy Crew. If they have no face-down Crew, executes their Boss instead.",
			command:
				"Declare the class of one face-down enemy Crew. If correct, turn it face-up.",
			passive: "You deal 30% more damage.",
		},
		flavorText: "",
		maxHp: 100,
		faceTurnCost: 7,
		hasCustomCommandLogic: true,
	},
];

// crew

export const CREW_DISPLAY: readonly CrewCardDisplay[] = [
	// strikers
	{
		id: "pektus",
		name: "Pektus",
		class: "striker",
		effectText: { turned: "Deal 25 damage to target enemy Boss." },
		flavorText: "",
	},
	{
		id: "shrike",
		name: "Shrike",
		class: "striker",
		effectText: {
			turned:
				"Pay 3 Cash to strike target enemy Crew (unblockable). If they have no face-down Crew, this executes their Boss instead.",
		},
		flavorText: "",
	},
	{
		id: "g-rone",
		name: "G-Rone",
		class: "striker",
		effectText: {
			passive: "At the end of each round, deal 10 damage to target enemy Boss.",
		},
		flavorText: "",
	},
	{
		id: "monkey-man",
		name: "Monkey-Man",
		class: "striker",
		effectText: {
			turned:
				"Target opponent discards their entire hand. Deal 5 damage to target enemy Boss for each card discarded this way.",
		},
		flavorText: "",
	},
	{
		id: "berto-lopez",
		name: "Berto Lopez",
		class: "striker",
		effectText: {
			turned: "Deal 15 damage to target enemy Boss for each face-up ally Crew.",
		},
		flavorText: "",
	},
	{
		id: "hot-girl",
		name: "Hot Girl",
		class: "striker",
		effectText: {
			turned: "Deal damage equal to 30% of target enemy Boss's current HP.",
		},
		flavorText: "",
	},
	{
		id: "black-fist",
		name: "Black Fist",
		class: "striker",
		effectText: {
			turned:
				"Discard 3 cards from your hand. If you do, deal 35 damage to target enemy Boss.",
		},
		flavorText: "",
	},
	{
		id: "whisper",
		name: "Whisper",
		class: "striker",
		effectText: {
			turned:
				"Discard 5 cards from your hand, then strike target enemy Crew (unblockable; executes their Boss if they have no face-down Crew). If you have successfully called a bluff this game, discard 1 card instead.",
		},
		flavorText: "",
	},

	// blockers

	{
		id: "rilla-gorilla",
		name: "Rilla Gorilla",
		class: "blocker",
		effectText: { turned: "Give 40 Shield to target ally Boss." },
		flavorText: "",
	},
	{
		id: "frontline",
		name: "Frontline",
		class: "blocker",
		effectText: {
			turned:
				"Target ally Boss is immune to damage until the start of your next 2 turns.",
		},
		flavorText: "",
	},
	{
		id: "mama-mercy",
		name: "Mama Mercy",
		class: "blocker",
		effectText: {
			passive:
				"Whenever an enemy Striker turns face-up, give 50 Shield to target ally Boss.",
		},
		flavorText: "",
	},
	{
		id: "lighthouse",
		name: "Lighthouse",
		class: "blocker",
		effectText: {
			turned: "Disable 2 target Crew's Passives until each turns face-down.",
		},
		flavorText: "",
	},
	{
		id: "glob",
		name: "Glob",
		class: "blocker",
		effectText: {
			turned: "If target ally Boss has any Shield, give it 50 more Shield.",
		},
		flavorText: "",
	},
	{
		id: "silencer",
		name: "Silencer",
		class: "blocker",
		effectText: {
			passive:
				"Reduce all incoming damage to target ally Boss from enemy Moves by 40%.",
		},
		flavorText: "",
	},
	{
		id: "doctor-norman",
		name: "Doctor Norman",
		class: "blocker",
		effectText: {
			passive:
				"Whenever you discard your 4th card, heal target ally Boss to full HP.",
		},
		flavorText: "",
	},
	{
		id: "lotus",
		name: "Lotus",
		class: "blocker",
		effectText: { turned: "This Crew is also treated as a Striker." },
		flavorText: "",
	},

	// collectors

	{
		id: "mayumi",
		name: "Mayumi",
		class: "collector",
		effectText: { turned: "Gain 2 Cash and draw 1 card." },
		flavorText: "",
	},
	{
		id: "too-big",
		name: "Too Big",
		class: "collector",
		effectText: {
			turned: "Steal 1 Cash from target opponent.",
			passive:
				"Once per game, whenever you successfully call a bluff, you may turn this Crew face-down.",
		},
		flavorText: "",
	},
	{
		id: "claw-machine",
		name: "Claw Machine",
		class: "collector",
		effectText: { turned: "Draw 2 cards." },
		flavorText: "",
	},
	{
		id: "cristatella",
		name: "Cristatella",
		class: "collector",
		effectText: { turned: "This Crew is also treated as a Turner." },
		flavorText: "",
	},
	{
		id: "cool-guy",
		name: "Cool Guy",
		class: "collector",
		effectText: {
			passive: "Whenever you play a Move, heal target ally Boss for 5 HP.",
		},
		flavorText: "",
	},
	{
		id: "belladonna",
		name: "Belladonna",
		class: "collector",
		effectText: {
			turned: "Heal target ally Boss for 10 HP, gain 1 Cash, and draw 1 card.",
		},
		flavorText: "",
	},
	{
		id: "vanessa-de-vera",
		name: "Vanessa De Vera",
		class: "collector",
		effectText: {
			passive:
				"The first time your hand becomes empty each turn, draw 3 cards.",
		},
		flavorText: "",
	},
	{
		id: "bear-bones",
		name: "Bear Bones",
		class: "collector",
		effectText: {
			passive:
				"Whenever you successfully challenge an opponent, you may pay 1 Cash to strike one face-down enemy Crew.",
		},
		flavorText: "",
	},

	// turners

	{
		id: "handles",
		name: "Handles",
		class: "turner",
		effectText: {
			turned:
				"If your other ally Crew is face-up, you may turn one face-up ally Crew face-down.",
		},
		flavorText: "",
	},
	{
		id: "hider",
		name: "Hider",
		class: "turner",
		effectText: {
			turned: "If your other ally Crew is face-up, turn that Crew face-down.",
		},
		flavorText: "",
	},
	{
		id: "terminal",
		name: "Terminal",
		class: "turner",
		effectText: {
			passive:
				"Your Boss cannot be Striked (by Strike or Face Turn) while its HP is above 50.",
		},
		flavorText: "",
	},
	{
		id: "suplex",
		name: "Suplex",
		class: "turner",
		effectText: {
			turned:
				"If you have turned an ally Crew face-up this game, strike target enemy Crew (executes their Boss if they have no face-down Crew).",
		},
		flavorText: "",
	},
	{
		id: "wolfman",
		name: "Wolfman",
		class: "turner",
		effectText: {
			turned:
				"Full Moon costs 0. Search your deck for Full Moon, then shuffle your deck.",
		},
		flavorText: "",
	},
	{
		id: "jeremy",
		name: "Jeremy",
		class: "turner",
		effectText: {
			passive:
				"If this Crew transforms into The Berserker, the transformation is permanent.",
		},
		flavorText: "",
	},
	{
		id: "berserker",
		name: "The Berserker",
		class: "striker",
		effectText: { turned: "Deal 50 damage to target enemy Boss." },
		flavorText: "",
		draftable: false,
	},
];

// moves

export const MOVE_DISPLAY: readonly MoveCardDisplay[] = [
	// active moves
	{
		id: "poison-breath",
		name: "Poison Breath",
		baseCost: 2,
		moveType: "active",
		effectText:
			"At the end of each round, deal 10 damage to target enemy Boss.",
		flavorText: "",
	},
	{
		id: "side-hustle",
		name: "Side Hustle",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of each of your future turns, gain 1 Cash.",
		flavorText: "",
	},
	{
		id: "dataminer",
		name: "Dataminer",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of each of your future turns, draw 1 card.",
		flavorText: "",
	},
	{
		id: "blood-money",
		name: "Blood Money",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an opponent plays a Move or performs a strike, gain 1 Cash.",
		flavorText: "",
	},
	{
		id: "background-check",
		name: "Background Check",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an opponent challenges you, before the challenge resolves, they must declare the class of one of your face-down Crew. If their guess is wrong, turn one of their Crew face-up.",
		flavorText: "",
	},
	{
		id: "prank-call",
		name: "Prank Call",
		baseCost: 1,
		moveType: "active",
		effectText:
			"The first time each round you bluff a Class Action, gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "void-arms",
		name: "The Iterated Void's Arms",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever an opponent would choose which of your face-down Crew to turn face-up, you make that choice instead.",
		flavorText: "",
	},
	{
		id: "void-legs",
		name: "The Iterated Void's Legs",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of each of your turns, you may discard 1 card to deal 5 damage to target enemy Boss.",
		flavorText: "",
	},
	{
		id: "void-torso",
		name: "The Iterated Void's Torso",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of each of your turns, give 5 Shield to target ally Boss.",
		flavorText: "",
	},
	{
		id: "big-voucher",
		name: "Big Voucher",
		baseCost: 2,
		moveType: "active",
		effectText: "Your Move costs are each reduced by 1.",
		flavorText: "",
	},
	{
		id: "command-center",
		name: "Command Center",
		baseCost: 3,
		moveType: "active",
		effectText:
			"At the start of each of your turns, draw 1 card and gain 1 Cash.",
		flavorText: "",
	},
	{
		id: "blackmail",
		name: "Blackmail",
		baseCost: 3,
		moveType: "active",
		effectText: "All Crew Passives are disabled.",
		flavorText: "",
	},
	{
		id: "supply-drop",
		name: "Supply Drop",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever a Collector action resolves, your team gains 1 additional Cash.",
		flavorText: "",
	},
	{
		id: "life-insurance",
		name: "Life Insurance",
		baseCost: 3,
		moveType: "active",
		effectText:
			"Whenever target ally Boss would be reduced to 0 HP for the first time, it survives with 1 HP instead. Then discard this Move.",
		flavorText: "",
	},
	{
		id: "false-flag-operation",
		name: "False Flag Operation",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever you would turn a Crew face-up from failing a challenge, prevent that effect and discard this Move instead.",
		flavorText: "",
	},
	{
		id: "bamboo-wall",
		name: "Bamboo Wall",
		baseCost: 1,
		moveType: "active",
		effectText:
			"If you have a face-up Blocker, at the start of each of your turns, give 15 Shield to target ally Boss.",
		flavorText: "",
	},
	{
		id: "trickle-down-economics",
		name: "Trickle-Down Economics",
		baseCost: 3,
		moveType: "active",
		effectText:
			"Whenever target opponent's Collector action resolves, gain the same amount of Cash they gained.",
		flavorText: "",
	},

	// burst moves
	{
		id: "deleb-i",
		name: "Deleb-i, The Iterated Void",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"If The Iterated Void's Arms, Legs, and Torso are all in your active zone, you win the game.",
		flavorText: "",
	},
	{
		id: "reload",
		name: "Reload",
		baseCost: 1,
		moveType: "burst",
		effectText: "Draw 2 cards.",
		flavorText: "",
	},
	{
		id: "drive-by",
		name: "Drive-By",
		baseCost: 3,
		moveType: "burst",
		effectText: "Deal 30 damage to target enemy Boss.",
		flavorText: "",
	},
	{
		id: "claim-the-bounty",
		name: "Claim The Bounty",
		baseCost: 4,
		moveType: "slow",
		effectText:
			"Deal 30 damage to target enemy Boss. If you have successfully called a bluff this game, this costs 0 Cash instead.",
		flavorText: "",
	},
	{
		id: "ambush",
		name: "Ambush",
		baseCost: 3,
		moveType: "slow",
		effectText:
			"Strike target enemy Crew — or execute their Boss if they have no face-down Crew. This strike can be blocked.",
		flavorText: "",
	},
	{
		id: "devastate",
		name: "Devastate",
		baseCost: 6,
		moveType: "burst",
		effectText: "Deal damage equal to 50% of target enemy Boss's current HP.",
		flavorText: "",
	},
	{
		id: "bulletproof-vest",
		name: "Bulletproof Vest",
		baseCost: 1,
		moveType: "burst",
		effectText: "Give 10 Shield to target ally Boss.",
		flavorText: "",
	},
	{
		id: "job-application",
		name: "Job Application",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Set your Cash and target opponent's Cash to 0. Then draw 3 cards.",
		flavorText: "",
	},
	{
		id: "full-moon",
		name: "Full Moon",
		baseCost: 10,
		moveType: "burst",
		effectText:
			"Return cards from your discard pile to your hand until your hand is full. Gain 10 Cash.",
		flavorText: "",
	},
	{
		id: "all-in",
		name: "All-In",
		baseCost: 4,
		moveType: "burst",
		effectText: "Set target ally Boss's HP to 1. Gain 7 Cash and draw 3 cards.",
		flavorText: "",
	},
	{
		id: "cheap-labor",
		name: "Cheap Labor",
		baseCost: 1,
		moveType: "burst",
		effectText: "Draw 1 card and gain 3 Cash.",
		flavorText: "",
	},
	{
		id: "coordinated-strike",
		name: "Coordinated Strike",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Deal 15 damage to target enemy Boss. If you have a face-up Striker, deal 25 damage instead.",
		flavorText: "",
	},
	{
		id: "ratatatat",
		name: "Ratatatat!",
		baseCost: 2,
		moveType: "slow",
		effectText:
			"Deal 20 damage to target enemy Boss. This damage ignores Shield.",
		flavorText: "",
	},
	{
		id: "dig-deep",
		name: "Dig Deep",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Look at the top 5 cards of your deck. Draw 2, then shuffle your deck.",
		flavorText: "",
	},
	{
		id: "reinforcements",
		name: "Reinforcements",
		baseCost: 2,
		moveType: "burst",
		effectText: "Give 20 Shield to target ally Boss and draw 1 card.",
		flavorText: "",
	},
	{
		id: "empty-the-clip",
		name: "Empty The Clip",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Discard any number of cards from your hand. Deal 10 damage to target enemy Boss for each card discarded this way.",
		flavorText: "",
	},
	{
		id: "fresh-start",
		name: "Fresh Start",
		baseCost: 1,
		moveType: "burst",
		effectText:
			"Draw 1 card. If you had no other cards in hand when you played this, draw 3 cards instead.",
		flavorText: "",
	},
	{
		id: "tactical-support",
		name: "Tactical Support",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Target ally gains 2 Cash. You may then turn one of their face-up Crew face-down.",
		flavorText: "",
	},
	{
		id: "rage-serum",
		name: "Rage Serum",
		baseCost: 1,
		moveType: "burst",
		effectText: "Transform Jeremy into The Berserker.",
		flavorText: "",
	},
	{
		id: "scorched-earth",
		name: "Scorched Earth",
		baseCost: 3,
		moveType: "burst",
		effectText: "Discard all Active Moves from all players' active zones.",
		flavorText: "",
	},
	{
		id: "triangle-of-trust",
		name: "Triangle of Trust",
		baseCost: 2,
		moveType: "burst",
		effectText: "Discard 1 card from your hand. If you do, draw 3 cards.",
		flavorText: "",
	},
	{
		id: "heel-turn",
		name: "Heel Turn",
		baseCost: 4,
		moveType: "burst",
		effectText: "Turn one ally Crew face-down.",
		flavorText: "",
	},
	{
		id: "first-aid",
		name: "First Aid",
		baseCost: 1,
		moveType: "burst",
		effectText: "Heal target ally Boss for 20 HP.",
		flavorText: "",
	},
	{
		id: "neetos-clock",
		name: "Neeto's Clock",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Discard 2 cards from your hand. If you do, reactivate a face-up ally Crew's Turned effect.",
		flavorText: "",
	},
	{
		id: "bailout",
		name: "Bailout",
		baseCost: 2,
		moveType: "burst",
		effectText: "Heal target ally Boss for 20 HP and gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "pull-counter",
		name: "Pull Counter",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Turn one face-up ally Crew face-down, then turn it face-up again.",
		flavorText: "",
	},
	{
		id: "cash-out",
		name: "Cash Out",
		baseCost: 0,
		moveType: "burst",
		effectText: "Discard 2 cards from your hand. If you do, gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "switch-up",
		name: "Switch Up",
		baseCost: 4,
		moveType: "burst",
		effectText:
			"Turn one ally Crew face-down and a different ally Crew face-up.",
		flavorText: "",
	},
	{
		id: "tag-out",
		name: "Tag Out",
		baseCost: 2,
		moveType: "burst",
		effectText: "Swap one of your Crew with one of target ally's Crew.",
		flavorText: "",
	},
	{
		id: "take-it-back",
		name: "Take It Back",
		baseCost: 1,
		moveType: "burst",
		effectText: "Return 1 card from your discard pile to your hand.",
		flavorText: "",
	},
	{
		id: "spare-change",
		name: "Spare Change",
		baseCost: 1,
		moveType: "burst",
		effectText: "Gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "paycheck",
		name: "Paycheck",
		baseCost: 2,
		moveType: "burst",
		effectText: "Gain 4 Cash.",
		flavorText: "",
	},
	{
		id: "sucker-punch",
		name: "Sucker Punch",
		baseCost: 1,
		moveType: "burst",
		effectText: "Deal 15 damage to target enemy Boss.",
		flavorText: "",
	},
	{
		id: "wolfblaster",
		name: "Wolfblaster",
		baseCost: 5,
		moveType: "burst",
		effectText: "Deal 40 damage to target enemy Boss.",
		flavorText: "",
	},
	{
		id: "dead-drop-retrieval",
		name: "Dead Drop Retrieval",
		baseCost: 2,
		moveType: "burst",
		effectText: "Draw 3 cards.",
		flavorText: "",
	},

	// slow moves
	{
		id: "cheap-shot",
		name: "Cheap Shot",
		baseCost: 1,
		moveType: "slow",
		effectText: "Deal 20 damage to target enemy Boss.",
		flavorText: "",
	},
	{
		id: "unfinished-business",
		name: "Unfinished Business",
		baseCost: 3,
		moveType: "slow",
		effectText:
			"If you or an ally has a face-up Collector, strike target enemy Crew (unblockable; executes their Boss if they have no face-down Crew).",
		flavorText: "",
	},
	{
		id: "kamikaze",
		name: "Kamikaze",
		baseCost: 0,
		moveType: "slow",
		effectText:
			"Turn one ally Crew face-up. If you do, deal 30 damage to target enemy Boss.",
		flavorText: "",
	},
	{
		id: "nope",
		name: "Nope!",
		baseCost: 1,
		moveType: "slow",
		effectText: "Stop an enemy Slow Move.",
		flavorText: "",
	},
	{
		id: "interrogation",
		name: "Interrogation",
		baseCost: 1,
		moveType: "slow",
		effectText:
			"Look at 2 random cards from target opponent's hand. You may discard 1 of them.",
		flavorText: "",
	},
	{
		id: "reverse-card",
		name: "Reverse Card",
		baseCost: 2,
		moveType: "slow",
		effectText:
			"Counter target enemy Slow Move that deals damage. That Move's damage is dealt to its controller instead.",
		flavorText: "",
	},
	{
		id: "pickpocket",
		name: "Pickpocket",
		baseCost: 0,
		moveType: "slow",
		effectText: "Steal 2 Cash from target opponent.",
		flavorText: "",
	},
	{
		id: "strip-em-down",
		name: "Strip 'Em Down",
		baseCost: 1,
		moveType: "slow",
		effectText: "Remove all Shield from target enemy Boss. Draw 1 card.",
		flavorText: "",
	},
	{
		id: "wheel-of-fortune",
		name: "Wheel Of Fortune",
		baseCost: 1,
		moveType: "slow",
		effectText:
			"You and target opponent each discard your hands, then each draw that many cards.",
		flavorText: "",
	},
	{
		id: "truth-serum",
		name: "Truth Serum",
		baseCost: 4,
		moveType: "slow",
		effectText:
			"Target opponent reveals the class of one of their face-down Crew.",
		flavorText: "",
	},
];

export const SELF_CREW_SLOT_MOVE_IDS = new Set<string>([
	"kamikaze",
	"heel-turn",
	"pull-counter",
]);

export function needsSelfCrewSlot(move: MoveCardDisplay): boolean {
	return SELF_CREW_SLOT_MOVE_IDS.has(move.id);
}

export const MOVE_TARGET_SCOPE: Readonly<Record<string, "ally" | "ally_self">> = {
	"tag-out": "ally",
	"life-insurance": "ally_self",
	"tactical-support": "ally_self",
	"trickle-down-economics": "ally_self",
};

export function getMoveTargetScope(moveId: string): "enemy" | "ally" | "ally_self" {
	return MOVE_TARGET_SCOPE[moveId] ?? "enemy";
}

// lookup maps — display-only, safe for client use

export const BOSS_DISPLAY_MAP = new Map(BOSS_DISPLAY.map((b) => [b.id, b]));
export const CREW_DISPLAY_MAP = new Map(CREW_DISPLAY.map((c) => [c.id, c]));
export const MOVE_DISPLAY_MAP = new Map(MOVE_DISPLAY.map((m) => [m.id, m]));

export function getBossDisplay(id: string): BossCardDisplay {
	const card = BOSS_DISPLAY_MAP.get(id);
	if (!card) throw new Error(`[face-turn] unknown boss: "${id}"`);
	return card;
}

export function getCrewDisplay(id: string): CrewCardDisplay {
	const card = CREW_DISPLAY_MAP.get(id);
	if (!card) throw new Error(`[face-turn] unknown crew: "${id}"`);
	return card;
}

export function getMoveDisplay(id: string): MoveCardDisplay {
	const card = MOVE_DISPLAY_MAP.get(id);
	if (!card) throw new Error(`[face-turn] unknown move: "${id}"`);
	return card;
}

export function isDraftable(crew: CrewCardDisplay): boolean {
	return crew.draftable !== false;
}