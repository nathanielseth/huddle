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
			faceTurn: "I deliver an unblockable, unchallengeable strike.",
			command:
				"Take 1 random card from an enemy's hand, then steal 3 Cash from them.",
			passive:
				"Whenever you win a challenge, you may turn one of your face-up Crew face-down.",
		},
		flavorText: "",
		maxHp: 100,
	},
	{
		id: "the-dealer",
		name: "The Dealer",
		effectText: {
			faceTurn: "I deliver an unblockable, unchallengeable strike.",
			command:
				"Replace one of your face-up Crew with your reserved Crew, face-down.",
			passive: "If you have no face-up Crew, draw 1 at the start of your turn.",
		},
		flavorText: "",
		maxHp: 100,
		hasCustomCommandLogic: true,
	},
	{
		id: "the-razor",
		name: "The Razor",
		effectText: {
			faceTurn: "I deliver an unblockable, unchallengeable strike.",
			command:
				"Guess the class of one face-down enemy Crew. If correct, turn it face-up.",
			passive: "Damage you deal is increased by 5.",
		},
		flavorText: "",
		maxHp: 100,
		hasCustomCommandLogic: true,
	},
	{
		id: "the-bastion",
		name: "The Bastion",
		effectText: {
			faceTurn: "I deliver an unblockable, unchallengeable strike.",
			command:
				"I gain 15 Shield, then deal damage to an enemy Boss equal to my current Shield. My Shield is then emptied.",
			passive: "Whenever I take damage, you gain 1 Cash. (Once per turn.)",
		},
		flavorText: "",
		maxHp: 100,
	},
];

// crew

export const CREW_DISPLAY: readonly CrewCardDisplay[] = [
	// strikers
	{
		id: "pektus",
		name: "Pektus",
		class: "striker",
		effectText: { turned: "I deal 25 damage to the enemy Boss." },
		flavorText: "",
	},
	{
		id: "shrike",
		name: "Shrike",
		class: "striker",
		effectText: {
			turned: "I Strike an enemy Crew.",
		},
		flavorText: "",
	},
	{
		id: "g-rone",
		name: "G-Rone",
		class: "striker",
		effectText: {
			passive: "At the end of each round, I deal 10 damage to an enemy Boss.",
		},
		flavorText: "",
	},
	{
		id: "monkey-man",
		name: "Monkey-Man",
		class: "striker",
		effectText: {
			turned:
				"An enemy discards their hand. I deal 5 damage to their Boss for each card discarded this way.",
		},
		flavorText: "",
	},
	{
		id: "berto-lopez",
		name: "Berto Lopez",
		class: "striker",
		effectText: {
			turned:
				"I deal 15 damage to an enemy Boss. If my partner Crew is face-up, deal 35 damage instead.",
		},
		flavorText: "",
	},
	{
		id: "hot-girl",
		name: "Hot Girl",
		class: "striker",
		effectText: {
			turned: "I deal damage equal to 35% of an enemy Boss's current HP.",
		},
		flavorText: "",
	},
	{
		id: "black-fist",
		name: "Black Fist",
		class: "striker",
		effectText: {
			turned: "Discard 2 cards. If you do, I deal 35 damage to an enemy Boss.",
		},
		flavorText: "",
	},
	{
		id: "whisper",
		name: "Whisper",
		class: "striker",
		effectText: {
			turned:
				"Discard 3 cards. If you do, I do an unblockable Strike on an enemy Crew. If you have successfully called a bluff this game, discard 1 instead.",
		},
		flavorText: "",
	},

	{
		id: "wolfman",
		name: "Wolfman",
		class: "striker",
		effectText: { turned: "I deal 50 damage to an enemy Boss." },
		flavorText: "",
		draftable: false,
	},

	// blockers

	{
		id: "rilla-gorilla",
		name: "Rilla Gorilla",
		class: "blocker",
		effectText: {
			turned:
				"I give 30 Shield to my Boss, then deal 10 damage to an enemy Boss.",
		},
		flavorText: "",
	},
	{
		id: "frontline",
		name: "Frontline",
		class: "blocker",
		effectText: {
			turned: "My Boss cannot be damaged or struck for 2 turns.",
		},
		flavorText: "",
	},
	{
		id: "mama-mercy",
		name: "Mama Mercy",
		class: "blocker",
		effectText: {
			passive:
				"Whenever the team turns a Crew face-up or face-down, I give my Boss 20 Shield.",
		},
		flavorText: "",
	},
	{
		id: "lighthouse",
		name: "Lighthouse",
		class: "blocker",
		effectText: {
			turned: "I deal 10 damage to all enemy Bosses.",
			passive: "All enemy Turned Effects are disabled.",
		},
		flavorText: "",
	},
	{
		id: "glob",
		name: "Glob",
		class: "blocker",
		effectText: {
			turned:
				"If my Boss has any Shield, I give it 40 more Shield. If my Boss has no Shield, I steal 1 Cash from an enemy instead.",
		},
		flavorText: "",
	},
	{
		id: "silencer",
		name: "Silencer",
		class: "blocker",
		effectText: {
			turned: "I give 10 Shield to all allied Bosses.",
			passive: "All enemy Crew Passives are disabled.",
		},
		flavorText: "",
	},
	{
		id: "doctor-norman",
		name: "Doctor Norman",
		class: "blocker",
		effectText: {
			passive:
				"Whenever you discard, I give my Boss 10 Shield for each card discarded.",
		},
		flavorText: "",
	},
	{
		id: "lotus",
		name: "Lotus",
		class: "blocker",
		effectText: {
			passive: "I can also perform Strike actions.",
		},
		flavorText: "",
	},

	// collectors

	{
		id: "mayumi",
		name: "Mayumi",
		class: "collector",
		effectText: { turned: "You gain 1 Cash and draw 1 card." },
		flavorText: "",
	},
	{
		id: "too-big",
		name: "Too Big",
		class: "collector",
		effectText: {
			turned: "You steal 1 Cash from an enemy.",
		},
		flavorText: "",
	},
	{
		id: "claw-machine",
		name: "Claw Machine",
		class: "collector",
		effectText: { turned: "You draw 2 cards." },
		flavorText: "",
	},
	{
		id: "cristatella",
		name: "Cristatella",
		class: "collector",
		effectText: {
			passive: "I can also perform Block actions.",
		},
		flavorText: "",
	},
	{
		id: "cool-guy",
		name: "Cool Guy",
		class: "collector",
		effectText: {
			passive:
				"Whenever you play a Move, I deal 3 damage to a random enemy Boss.",
		},
		flavorText: "",
	},
	{
		id: "belladonna",
		name: "Belladonna",
		class: "collector",
		effectText: {
			turned: "I heal my Boss for 20 HP.",
		},
		flavorText: "",
	},
	{
		id: "rat-queen",
		name: "Rat Queen",
		class: "collector",
		effectText: {
			passive:
				"The first time your hand becomes empty each turn, you draw 2 cards.",
		},
		flavorText: "",
	},
	{
		id: "bear-bones",
		name: "Bear Bones",
		class: "collector",
		effectText: {
			passive:
				"Whenever you successfully challenge an enemy, you may pay 3 Cash to Strike one of their face-down Crew.",
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
				"If my partner Crew is face-up, turn me face-down and deal 10 damage to my Boss.",
		},
		flavorText: "",
	},
	{
		id: "hider",
		name: "Hider",
		class: "turner",
		effectText: {
			turned: "If my partner crew is face-up, I turn it face-down.",
		},
		flavorText: "",
	},
	{
		id: "terminal",
		name: "Terminal",
		class: "turner",
		effectText: {
			passive: "My Boss cannot be Striked while its HP is greater than 60.",
		},
		flavorText: "",
	},
	{
		id: "suplex",
		name: "Suplex",
		class: "turner",
		effectText: {
			passive:
				"Whenever the team turns a Crew face-up or face-down, I Strike an enemy Crew.",
		},
		flavorText: "",
	},
	{
		id: "retro",
		name: "Retro",
		class: "turner",
		effectText: {
			turned:
				"Chronotrix costs 3. Search your deck for Chronotrix, then shuffle your deck.",
		},
		flavorText: "",
	},
	{
		id: "andrew",
		name: "Andrew",
		class: "turner",
		effectText: {
			passive: "Draw 1 card at the start of your turn.",
		},
		flavorText: "",
	},
	{
		id: "zednem",
		name: "Zednem",
		class: "turner",
		effectText: {
			turned: "Draw 1 card.",
			passive: "Your Burst Moves cost 1 less Cash.",
		},
		flavorText: "",
	},
	{
		id: "keeper",
		name: "Keeper",
		class: "turner",
		effectText: {
			turned: "Take 1 random card from an enemy's hand.",
			passive: "Enemy Moves cost 1 more Cash.",
		},
		flavorText: "",
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
		effectText: "At the end of each round, deal 10 damage to an enemy Boss.",
		flavorText: "",
	},
	{
		id: "side-hustle",
		name: "Side Hustle",
		baseCost: 2,
		moveType: "active",
		effectText: "At the start of your turn, gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "equalizer",
		name: "Equalizer",
		baseCost: 2,
		moveType: "active",
		effectText:
			"At the start of your turn, if an enemy has more Cash than you, gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "dataminer",
		name: "Dataminer",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of your turn, draw 1 card.",
		flavorText: "",
	},
	{
		id: "blood-money",
		name: "Blood Money",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an enemy plays a Move or performs a Strike, gain 1 Cash.",
		flavorText: "",
	},
	{
		id: "background-check",
		name: "Background Check",
		baseCost: 1,
		moveType: "active",
		effectText:
			"When an enemy challenges you, they guess the class of one of your face-down Crew. If wrong, you turn one of their Crew face-up.",
		flavorText: "",
	},
	{
		id: "prank-call",
		name: "Prank Call",
		baseCost: 1,
		moveType: "active",
		effectText:
			"The first time each round you bluff a Class Action, gain 3 Cash.",
		flavorText: "",
	},
	{
		id: "void-arms",
		name: "The Iterated Void's Arms",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever an enemy would choose which of your face-down Crew to turn face-up, you make that choice instead.",
		flavorText: "",
	},
	{
		id: "void-legs",
		name: "The Iterated Void's Legs",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of your turn, you may discard 1 card. If you do, deal 5 damage to an enemy Boss.",
		flavorText: "",
	},
	{
		id: "void-torso",
		name: "The Iterated Void's Torso",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of your turn, give 5 Shield to your Boss.",
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
		effectText: "At the start your turn, draw 1 card and gain 1 Cash.",
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
			"Whenever your team performs a Collector action, gain 1 additional Cash.",
		flavorText: "",
	},
	{
		id: "life-insurance",
		name: "Life Insurance",
		baseCost: 3,
		moveType: "active",
		effectText:
			"Whenever an allied Boss would die for the first time, it survives with 1 HP instead. Then discard this Move.",
		flavorText: "",
	},
	{
		id: "false-flag-operation",
		name: "False Flag Operation",
		baseCost: 0,
		moveType: "active",
		effectText:
			"When one of your Crew would be turned face-up after you fail a challenge, prevent it and discard this Move instead.",
		flavorText: "",
	},
	{
		id: "bamboo-wall",
		name: "Bamboo Wall",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of your turn, if your team has a face-up Crew, give your Boss 10 Shield.",
		flavorText: "",
	},
	{
		id: "trickle-down-economics",
		name: "Trickle-Down Economics",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an enemy's Collector action resolves, gain the same amount of Cash they gained.",
		flavorText: "",
	},

	// burst / slow
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
		moveType: "slow",
		effectText: "Deal 30 damage to an enemy Boss.",
		flavorText: "",
	},
	{
		id: "claim-the-bounty",
		name: "Claim The Bounty",
		baseCost: 4,
		moveType: "slow",
		effectText:
			"Deal 30 damage to an enemy Boss. If you have successfully called a bluff this game, this costs 0 Cash instead.",
		flavorText: "",
	},
	{
		id: "ambush",
		name: "Ambush",
		baseCost: 4,
		moveType: "slow",
		effectText: "Strike an enemy Crew. This can be blocked.",
		flavorText: "",
	},
	{
		id: "devastate",
		name: "Devastate",
		baseCost: 7,
		moveType: "slow",
		effectText: "Deal damage equal to 50% of an enemy Boss's current HP.",
		flavorText: "",
	},
	{
		id: "bulletproof-vest",
		name: "Bulletproof Vest",
		baseCost: 1,
		moveType: "burst",
		effectText: "Give 10 Shield to an allied Boss.",
		flavorText: "",
	},
	{
		id: "job-application",
		name: "Job Application",
		baseCost: 3,
		moveType: "slow",
		effectText: "Set your Cash and an enemy's Cash to 0. Then draw 3 cards.",
		flavorText: "",
	},
	{
		id: "chronotrix",
		name: "Chronotrix",
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
		effectText:
			"Set an allied Boss's HP to 1. You gain 7 Cash and draw 2 cards.",
		flavorText: "",
	},
	{
		id: "cheap-labor",
		name: "Cheap Labor",
		baseCost: 1,
		moveType: "burst",
		effectText: "Draw 1 card and gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "coordinated-strike",
		name: "Coordinated Strike",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Deal 15 damage to an enemy Boss. If you or an ally has a face-up Striker, deal 30 damage instead.",
		flavorText: "",
	},
	{
		id: "ratatatat",
		name: "Ratatatat!",
		baseCost: 2,
		moveType: "slow",
		effectText: "Deal 20 damage to an enemy Boss. This damage ignores Shield.",
		flavorText: "",
	},
	{
		id: "dig-deep",
		name: "Dig Deep",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"You look at the top 5 cards of your deck. Draw 2, then shuffle your deck.",
		flavorText: "",
	},
	{
		id: "reinforcements",
		name: "Reinforcements",
		baseCost: 2,
		moveType: "burst",
		effectText: "Give 15 Shield to an allied Boss. Draw 1 card.",
		flavorText: "",
	},
	{
		id: "empty-the-clip",
		name: "Empty The Clip",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"You discard any number of cards from your hand. Deal 10 damage to an enemy Boss for each card discarded this way.",
		flavorText: "",
	},
	{
		id: "fresh-start",
		name: "Fresh Start",
		baseCost: 1,
		moveType: "burst",
		effectText:
			"Draw 1 card. If you had no other cards in hand when you played this Move, draw 3 cards instead.",
		flavorText: "",
	},
	{
		id: "tactical-support",
		name: "Tactical Support",
		baseCost: 5,
		moveType: "burst",
		effectText:
			"An allied player gains 2 Cash. You may then turn one of their face-up Crew face-down.",
		flavorText: "",
	},
	{
		id: "full-moon",
		name: "Full Moon",
		baseCost: 1,
		moveType: "burst",
		effectText: "Transform Andrew into Wolfman, face-down.",
		flavorText: "",
	},
	{
		id: "scorched-earth",
		name: "Scorched Earth",
		baseCost: 3,
		moveType: "slow",
		effectText: "Discard all Active Moves from an enemy's active zone.",
		flavorText: "",
	},
	{
		id: "triangle-of-trust",
		name: "Triangle of Trust",
		baseCost: 1,
		moveType: "burst",
		effectText: "Discard 1 card. If you do, draw 3 cards.",
		flavorText: "",
	},
	{
		id: "heel-turn",
		name: "Heel Turn",
		baseCost: 4,
		moveType: "burst",
		effectText: "Turn one of your Crew face-down.",
		flavorText: "",
	},
	{
		id: "first-aid",
		name: "First Aid",
		baseCost: 1,
		moveType: "burst",
		effectText: "Heal an allied Boss for 15 HP.",
		flavorText: "",
	},
	{
		id: "neetos-clock",
		name: "Neeto's Clock",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Discard 2 cards. If you do, reactivate one of your face-up Crew's Turned effect.",
		flavorText: "",
	},
	{
		id: "bailout",
		name: "Bailout",
		baseCost: 2,
		moveType: "burst",
		effectText: "Heal an allied Boss for 15 HP. You gain 2 Cash.",
		flavorText: "",
	},
	{
		id: "pull-counter",
		name: "Pull Counter",
		baseCost: 3,
		moveType: "burst",
		effectText: "Retrigger the Turned Effect of one of your face-up Crew..",
		flavorText: "",
	},
	{
		id: "cash-out",
		name: "Cash Out",
		baseCost: 0,
		moveType: "burst",
		effectText: "Discard 2 cards. If you do, gain 3 Cash.",
		flavorText: "",
	},
	{
		id: "switch-up",
		name: "Switch Up",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Turn one of your Crew face-down and a different one of your Crew face-up.",
		flavorText: "",
	},
	{
		id: "tag-out",
		name: "Tag Out",
		baseCost: 0,
		moveType: "burst",
		effectText: "Swap one of your Crew with a teammate's.",
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
		effectText: "Gain 3 Cash.",
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
		effectText: "Deal 15 damage to an enemy Boss.",
		flavorText: "",
	},
	{
		id: "wolfblaster",
		name: "Wolfblaster",
		baseCost: 6,
		moveType: "slow",
		effectText: "Deal 40 damage to an enemy Boss.",
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

	{
		id: "cheap-shot",
		name: "Cheap Shot",
		baseCost: 1,
		moveType: "slow",
		effectText: "Deal 20 damage to an enemy Boss.",
		flavorText: "",
	},
	{
		id: "unfinished-business",
		name: "Unfinished Business",
		baseCost: 3,
		moveType: "slow",
		effectText:
			"If you or an ally has a face-up Blocker, perform an unblockable Strike on an enemy Crew.",
		flavorText: "",
	},
	{
		id: "kamikaze",
		name: "Kamikaze",
		baseCost: 0,
		moveType: "slow",
		effectText:
			"Turn one of your Crew face-up. If you do, deal 30 damage to an enemy Boss.",
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
			"Look at 2 random cards from an enemy's hand. You may discard 1 of them.",
		flavorText: "",
	},
	{
		id: "reverse-card",
		name: "Reversal",
		baseCost: 2,
		moveType: "slow",
		effectText:
			"Stop an enemy Slow Move. If that Move deals damage, its damage is dealt to its caster instead.",
		flavorText: "",
	},
	{
		id: "pickpocket",
		name: "Pickpocket",
		baseCost: 0,
		moveType: "slow",
		effectText: "Steal 2 Cash from an enemy.",
		flavorText: "",
	},
	{
		id: "strip-em-down",
		name: "Strip 'Em Down",
		baseCost: 1,
		moveType: "slow",
		effectText: "Remove all Shield from an enemy Boss. Draw 1 card.",
		flavorText: "",
	},
	{
		id: "wheel-of-fortune",
		name: "Wheel Of Fortune",
		baseCost: 1,
		moveType: "slow",
		effectText:
			"You and an enemy each discard your hands, then each draw that many cards.",
		flavorText: "",
	},
	{
		id: "truth-serum",
		name: "Truth Serum",
		baseCost: 3,
		moveType: "slow",
		effectText: "An enemy reveals the class of one of their face-down Crew.",
		flavorText: "",
	},
	{
		id: "ayuda-slip",
		name: "Ayuda Slip",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Whoever has the least Cash on your team gains 3 Cash and draws 1 card. If tied, random.",
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

export const MOVE_TARGET_SCOPE: Readonly<Record<string, "ally" | "ally_self">> =
	{
		"tag-out": "ally",
		"life-insurance": "ally_self",
		"tactical-support": "ally_self",
		"trickle-down-economics": "ally_self",
	};

export function getMoveTargetScope(
	moveId: string,
): "enemy" | "ally" | "ally_self" {
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