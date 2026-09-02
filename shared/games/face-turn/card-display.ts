import type { CrewClass, MoveType } from "./types";

export interface BaseCardDisplay {
	readonly id: string;
	readonly name: string;
	readonly flavorText: string;
	readonly artSrc?: string;
	readonly lore?: string;
	readonly synergyIds?: readonly string[];
}

export interface BossCardDisplay extends BaseCardDisplay {
	readonly effectText: {
		readonly command: string;
		readonly passive: string;
	};
	readonly maxHp: number;
	readonly startingArmor?: number;
	readonly draftable?: boolean;
	readonly hasCustomCommandLogic?: true;
}

export interface CrewCardDisplay extends BaseCardDisplay {
	readonly class: CrewClass;
	readonly effectText: {
		readonly revealed?: string;
		readonly passive?: string;
	};
	readonly draftable?: boolean;
}

export interface MoveCardDisplay extends BaseCardDisplay {
	readonly baseCost: number;
	readonly moveType: MoveType;
	readonly effectText: string;
}

// bosses

export const BOSS_DISPLAY: readonly BossCardDisplay[] = [
	{
		id: "the-bastion",
		artSrc: "/assets/games/face-turn/cards/boss/the-bastion.avif",
		name: "The Bastion",
		effectText: {
			command: "Deal damage equal to my Armor, then empty my Armor.",
			passive: "I start with 15 Armor. Whenever I take damage, gain 1 Cash.",
		},
		flavorText: "Scars can break us, or give us the strength to endure.",
		lore: "",
		synergyIds: ["glob", "rilla-gorilla", "miss-direction", "bulletproof-vest"],
		maxHp: 110,
		startingArmor: 15,
	},
	{
		id: "the-dealer",
		artSrc: "/assets/games/face-turn/cards/boss/dealer.jpg",
		name: "The Dealer",
		effectText: {
			command:
				"Replace one of your face-up Crew with your reserved Crew, face-down.",
			passive: "On your turn, you may discard a Move to gain 1 Cash.",
		},
		flavorText: "The house always wins. Luckily, I run the house.",
		lore: "",
		synergyIds: ["rat-queen", "doctor-norman", "job-application", "dataminer"],
		maxHp: 100,
		hasCustomCommandLogic: true,
	},
	{
		id: "the-razor",
		artSrc: "/assets/games/face-turn/cards/boss/razor.jpg",
		name: "The Razor",
		effectText: {
			command:
				"Guess a face-down enemy Crew's class. If correct, turn it face-up.",
			passive: "Damage you deal is increased by 7.",
		},
		flavorText: "Only a true star player commands a visionary empire.",
		lore: "",
		synergyIds: ["cool-guy", "monkey-man", "suplex", "truth-serum"],
		maxHp: 110,
		hasCustomCommandLogic: true,
	},
	{
		id: "the-watcher",
		artSrc: "/assets/games/face-turn/cards/boss/watcher.jpg",
		name: "The Watcher",
		effectText: {
			command:
				"Look at 2 random cards in an enemy's hand, take 1, then steal 1 Cash.",
			passive:
				"Whenever you win a challenge, draw 2, then turn an allied Crew face-down.",
		},
		flavorText: "Nothing dangerous stays unwatched.",
		lore: "",
		synergyIds: ["bear-bones", "suplex", "mama-mercy", "extortion"],
		maxHp: 120,
	},
];

// crew

export const CREW_DISPLAY: readonly CrewCardDisplay[] = [
	// strikers
	{
		id: "berto-lopez",
		artSrc: "/assets/games/face-turn/cards/crew/berto-lopez.avif",
		name: "Berto Lopez",
		class: "striker",
		effectText: {
			revealed:
				"I deal 15 damage to an enemy Boss. If my partner Crew is face-up, deal 30 damage instead.",
			passive: "Whenever you kill a Crew, turn me face-down.",
		},
		flavorText: "Reeks of cheap scum. Time to take out the trash.",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "black-fist",
		artSrc: "/assets/games/face-turn/cards/crew/black-fist.avif",
		name: "Blackfist",
		class: "striker",
		effectText: {
			revealed: "Discard 2. If you do, I deal 35 damage to an enemy Boss.",
		},
		flavorText: "Out of the way! I have business to finish.",
		lore: "",
		synergyIds: ["the-razor", "the-dealer"],
	},
	{
		id: "g-rone",
		artSrc: "/assets/games/face-turn/cards/crew/g-rone.avif",
		name: "G-Rone",
		class: "striker",
		effectText: {
			passive: "At the end of each round, I deal 10 damage to an enemy Boss.",
		},
		flavorText: "The white gazes into the unseen...",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "hot-girl",
		artSrc: "/assets/games/face-turn/cards/crew/hot-girl.avif",
		name: "Hot Girl",
		class: "striker",
		effectText: {
			revealed:
				"An enemy discards their hand. I deal 5 damage to their Boss for each card discarded this way.",
		},
		flavorText: "FEED THE FLAMES!!",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "monkey-man",
		artSrc: "/assets/games/face-turn/cards/crew/monkey-man.avif",
		name: "Monkey-Man",
		class: "striker",
		effectText: {
			revealed: "Take 1 random card from an enemy's hand.",
			passive:
				"Whenever you deal damage to an enemy Boss, steal 1 Cash from them.",
		},
		flavorText: "Finders keepers, sucker!",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "pektus",
		artSrc: "/assets/games/face-turn/cards/crew/pektus.avif",
		name: "Pektus",
		class: "striker",
		effectText: {
			revealed: "I deal 25 piercing damage to an enemy Boss.",
			passive: "All damage you deal is piercing.",
		},
		flavorText: "Bullseye.",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "shrike",
		artSrc: "/assets/games/face-turn/cards/crew/shrike.avif",
		name: "Shrike",
		class: "striker",
		effectText: {
			revealed: "I Strike an enemy Crew.",
		},
		flavorText: "Alright. Let's make this quick.",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "whisper",
		artSrc: "/assets/games/face-turn/cards/crew/whisper.avif",
		name: "Whisper",
		class: "striker",
		effectText: {
			revealed:
				"Discard 3. If you do, I do an unstoppable Strike on an enemy Crew. If you have successfully called a bluff this game, discard 1 instead.",
		},
		flavorText: "You'll never know what kills you.",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "wolfman",
		artSrc: "/assets/games/face-turn/cards/crew/wolfman.avif",
		name: "Wolfman",
		class: "striker",
		effectText: { revealed: "I deal 40 damage to an enemy Boss." },
		flavorText: "...IN WOLF'S CLOTHING!!",
		lore: "",
		synergyIds: ["the-razor"],
		draftable: false,
	},

	// defenders

	{
		id: "doctor-norman",
		artSrc: "/assets/games/face-turn/cards/crew/doctor-norman.avif",
		name: "Doctor Norman",
		class: "defender",
		effectText: {
			passive: "Whenever you discard, I give my Boss 10 Armor for each.",
		},
		flavorText: "Exquisite! Another breakthrough.",
		lore: "",
		synergyIds: ["the-dealer", "the-bastion", "black-fist", "empty-the-clip"],
	},
	{
		id: "frontline",
		artSrc: "/assets/games/face-turn/cards/crew/frontline.avif",
		name: "Frontline",
		class: "defender",
		effectText: {
			revealed: "My Boss cannot be damaged or struck for 2 turns.",
		},
		flavorText: "You will survive. I'll make sure of it.",
		lore: "",
		synergyIds: ["the-bastion", "pull-counter"],
	},
	{
		id: "glob",
		artSrc: "/assets/games/face-turn/cards/crew/glob.avif",
		name: "Glob",
		class: "defender",
		effectText: {
			revealed:
				"If my Boss has any Armor, I give it 40 more Armor. If my Boss has no Armor, steal 1 Cash from an enemy instead.",
		},
		flavorText: "glorb. goob. gaaarb.",
		lore: "",
		synergyIds: ["the-bastion"],
	},
	{
		id: "lighthouse",
		artSrc: "/assets/games/face-turn/cards/crew/lighthouse.avif",
		name: "Lighthouse",
		class: "defender",
		effectText: {
			revealed: "I deal 10 damage to all enemy Bosses.",
			passive: "All enemy Revealed Effects are disabled.",
		},
		flavorText: "Hope is dead... but the light remains.",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "lotus",
		artSrc: "/assets/games/face-turn/cards/crew/lotus.avif",
		name: "Lotus",
		class: "defender",
		effectText: {
			passive: "I can Strike.",
		},
		flavorText: "Don't die. I've already wasted enough time on you.",
		lore: "",
		synergyIds: ["bagman"],
	},
	{
		id: "mama-mercy",
		artSrc: "/assets/games/face-turn/cards/crew/mama-mercy.avif",
		name: "Mama Mercy",
		class: "defender",
		effectText: {
			passive:
				"Whenever the team turns a Crew face-up or face-down, I give my Boss 20 Armor.",
		},
		flavorText: "Nobody touches my people.",
		lore: "",
		synergyIds: ["the-bastion", "the-watcher", "suplex"],
	},
	{
		id: "rilla-gorilla",
		artSrc: "/assets/games/face-turn/cards/crew/rilla-gorilla.avif",
		name: "Rilla Gorilla",
		class: "defender",
		effectText: {
			revealed:
				"I give 30 Armor to my Boss, then deal 10 damage to an enemy Boss.",
		},
		flavorText: "GRRR-AAAAAH!",
		lore: "",
		synergyIds: ["the-bastion", "the-razor", "pull-counter"],
	},
	{
		id: "silencer",
		artSrc: "/assets/games/face-turn/cards/crew/silencer.avif",
		name: "Silencer",
		class: "defender",
		effectText: {
			revealed: "I give 10 Armor to all allied Bosses.",
			passive: "All enemy Crew Passives are disabled.",
		},
		flavorText: "...",
		lore: "",
		synergyIds: ["the-bastion"],
	},

	// collectors

	{
		id: "bagman",
		artSrc: "/assets/games/face-turn/cards/crew/bagman.avif",
		name: "Bagman",
		class: "collector",
		effectText: {
			passive: "I can Defend.",
		},
		flavorText: "Here comes the money.",
		lore: "",
		synergyIds: ["lotus"],
	},
	{
		id: "bear-bones",
		artSrc: "/assets/games/face-turn/cards/crew/bear-bones.avif",
		name: "Bear Bones",
		class: "collector",
		effectText: {
			revealed: "Steal 1 Cash.",
			passive:
				"Whenever you successfully challenge an enemy, Strike one of their Crew.",
		},
		flavorText: "I would do anything for my Ursula. Especially a felony.",
		lore: "",
		synergyIds: ["the-watcher"],
	},
	{
		id: "belladonna",
		artSrc: "/assets/games/face-turn/cards/crew/belladonna.avif",
		name: "Belladonna",
		class: "collector",
		effectText: {
			revealed: "Copy an enemy's ongoing Move into your ongoing zone.",
			passive: "Class actions cost 1 less Cash.",
		},
		flavorText: "Mmm, I like this. I think I'll make one just for me.",
		lore: "",
		synergyIds: ["the-razor"],
	},
	{
		id: "claw-machine",
		artSrc: "/assets/games/face-turn/cards/crew/claw-machine.avif",
		name: "Claw Machine",
		class: "collector",
		effectText: { revealed: "You draw 3." },
		flavorText: "That's going in my collection.",
		lore: "",
		synergyIds: ["the-dealer"],
	},
	{
		id: "cool-guy",
		artSrc: "/assets/games/face-turn/cards/crew/cool-guy.avif",
		name: "Cool Guy",
		class: "collector",
		effectText: {
			passive:
				"Whenever you play a Move, I deal 3 damage to a random enemy Boss.",
		},
		flavorText: "Ice to meet ya!",
		lore: "",
		synergyIds: ["the-razor", "zednem"],
	},
	{
		id: "mayumi",
		artSrc: "/assets/games/face-turn/cards/crew/mayumi.avif",
		name: "Mayumi",
		class: "collector",
		effectText: { revealed: "You gain 2 Cash and draw 1." },
		flavorText: "Curiosity pays surprisingly well...",
		lore: "",
		synergyIds: ["the-dealer"],
	},
	{
		id: "rat-queen",
		artSrc: "/assets/games/face-turn/cards/crew/rat-queen.avif",
		name: "Rat Queen",
		class: "collector",
		effectText: {
			passive: "The first time your hand becomes empty each turn, you draw 2.",
		},
		flavorText: "We're here! We're there! We're everywhere!",
		lore: "",
		synergyIds: ["the-dealer"],
	},
	{
		id: "too-big",
		artSrc: "/assets/games/face-turn/cards/crew/too-big.avif",
		name: "Too Big",
		class: "collector",
		effectText: {
			revealed: "Swap this card with any other face-up crew card.",
			passive: "At the start of your turn, deal 5 damage to my Boss.",
		},
		flavorText: "You ever tried drowning someone?",
		lore: "",
		synergyIds: ["warrant-of-arrest"],
	},

	// hiders

	{
		id: "andrew",
		artSrc: "/assets/games/face-turn/cards/crew/andrew.avif",
		name: "Andrew",
		class: "hider",
		effectText: {
			passive: "Draw 1 at the start of your turn.",
		},
		flavorText: "Just a sheep..",
		lore: "",
		synergyIds: ["full-moon", "zednem", "command-center", "dataminer"],
	},
	{
		id: "handles",
		artSrc: "/assets/games/face-turn/cards/crew/handles.avif",
		name: "Handles",
		class: "hider",
		effectText: {
			revealed:
				"If my partner Crew is face-up, turn me face-down and deal 5 damage to my Boss.",
		},
		flavorText: "First I steal your ankles, bro, then I take your teeth.",
		lore: "",
		synergyIds: ["miss-direction", "the-watcher", "the-bastion"],
	},
	{
		id: "miss-direction",
		artSrc: "/assets/games/face-turn/cards/crew/hider.avif",
		name: "Miss Direction",
		class: "hider",
		effectText: {
			revealed: "If my partner crew is face-up, I turn it face-down.",
			passive: "At the start of your turn, your Boss gains 10 Armor.",
		},
		flavorText: "You'll be safe here.",
		lore: "",
		synergyIds: ["handles", "the-watcher"],
	},
	{
		id: "keeper",
		artSrc: "/assets/games/face-turn/cards/crew/keeper.avif",
		name: "Keeper",
		class: "hider",
		effectText: {
			revealed: "Take 1 random card from an enemy's hand.",
			passive: "Enemy Moves cost 1 more Cash.",
		},
		flavorText: "Moving things that bite. Looking for a buyer.",
		lore: "",
		synergyIds: ["the-watcher", "trickle-down-economics"],
	},
	{
		id: "retro",
		artSrc: "/assets/games/face-turn/cards/crew/retro.avif",
		name: "Retro",
		class: "hider",
		effectText: {
			revealed:
				"Chronotrix costs 3. Search your deck for Chronotrix, then shuffle your deck.",
		},
		flavorText: "How many times do you think I've tried?",
		lore: "",
		synergyIds: ["the-dealer", "zednem"],
	},
	{
		id: "suplex",
		artSrc: "/assets/games/face-turn/cards/crew/suplex.avif",
		name: "Suplex",
		class: "hider",
		effectText: {
			revealed: "I deal 10 damage to an enemy Boss.",
			passive:
				"Whenever the team turns a Crew face-up or face-down, I Strike an enemy Crew.",
		},
		flavorText: "You picked the wrong ring, brother!",
		lore: "",
		synergyIds: ["the-razor", "the-watcher", "mama-mercy"],
	},
	{
		id: "terminal",
		artSrc: "/assets/games/face-turn/cards/crew/terminal.avif",
		name: "Terminal",
		class: "hider",
		effectText: {
			passive: "My Boss cannot be Struck while its HP is greater than 60.",
		},
		flavorText: "[SYS_FLAG] USER_SURVIVAL :: PRIORITY_MAX",
		lore: "",
		synergyIds: ["the-bastion"],
	},
	{
		id: "zednem",
		artSrc: "/assets/games/face-turn/cards/crew/zednem.avif",
		name: "Zednem",
		class: "hider",
		effectText: {
			revealed: "Draw 2.",
			passive: "Your Burst Moves cost 1 less Cash.",
		},
		flavorText: "THIS CITY HAS ENOUGH MONSTERS!",
		lore: "",
		synergyIds: ["cool-guy", "retro", "heel-turn", "pull-counter"],
	},
];

// moves

export const MOVE_DISPLAY: readonly MoveCardDisplay[] = [
	// ongoing moves
	{
		id: "background-check",
		artSrc: "/assets/games/face-turn/cards/moves/background-check.avif",
		name: "Background Check",
		baseCost: 1,
		moveType: "active",
		effectText:
			"When an enemy challenges you, they guess the class of one of your face-down Crew. If wrong, you turn one of their Crew face-up.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "bamboo-wall",
		artSrc: "/assets/games/face-turn/cards/moves/bamboo-wall.avif",
		name: "Bamboo Wall",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of your turn, if your team has a face-up Crew, give your Boss 10 Armor.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "big-voucher",
		artSrc: "/assets/games/face-turn/cards/moves/big-voucher.avif",
		name: "Big Voucher",
		baseCost: 2,
		moveType: "active",
		effectText: "Your Move costs are each reduced by 1.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "blackmail",
		artSrc: "/assets/games/face-turn/cards/moves/blackmail.avif",
		name: "Blackmail",
		baseCost: 3,
		moveType: "active",
		effectText: "All enemy Crew Passives are disabled.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "blood-money",
		artSrc: "/assets/games/face-turn/cards/moves/blood-money.avif",
		name: "Blood Money",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an enemy plays a Move or performs a Strike, gain 1 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "cease-and-desist",
		artSrc: "/assets/games/face-turn/cards/moves/cease-and-desist.avif",
		name: "Cease & Desist",
		baseCost: 1,
		moveType: "active",
		effectText:
			"The next time an enemy Crew would resolve its Revealed Effect, prevent it instead. Then discard this Move.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "command-center",
		artSrc: "/assets/games/face-turn/cards/moves/command-center.avif",
		name: "Command Center",
		baseCost: 3,
		moveType: "active",
		effectText: "At the start of your turn, draw 1 and gain 1 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "dataminer",
		artSrc: "/assets/games/face-turn/cards/moves/dataminer.avif",
		name: "Dataminer",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of your turn, draw 1.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "equalizer",
		artSrc: "/assets/games/face-turn/cards/moves/equalizer.avif",
		name: "Equalizer",
		baseCost: 2,
		moveType: "active",
		effectText:
			"At the start of your turn, if an enemy has more Cash than you, gain 2 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "extortion",
		artSrc: "/assets/games/face-turn/cards/moves/extortion.avif",
		name: "Extortion",
		baseCost: 2,
		moveType: "active",
		effectText: "Whenever you win a challenge, gain 3 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "false-flag-operation",
		artSrc: "/assets/games/face-turn/cards/moves/false-flag-operation.avif",
		name: "False Flag Operation",
		baseCost: 0,
		moveType: "active",
		effectText:
			"When one of your Crew would be turned face-up after you fail a challenge, prevent it and discard this Move instead.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "life-insurance",
		artSrc: "/assets/games/face-turn/cards/moves/life-insurance.avif",
		name: "Life Insurance",
		baseCost: 3,
		moveType: "active",
		effectText:
			"Whenever an allied Boss would die for the first time, it survives with 1 HP instead. Then discard this Move.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "poison-breath",
		artSrc: "/assets/games/face-turn/cards/moves/poison-breath.avif",
		name: "Poison Breath",
		baseCost: 3,
		moveType: "active",
		effectText: "At the end of each round, deal 10 damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "red-herring",
		artSrc: "/assets/games/face-turn/cards/moves/red-herring.avif",
		name: "Red Herring",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Choose one of your face-down Crew. The next Strike or Face Turn attempt against you must target that Crew. Then discard this Move.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "sell-out",
		artSrc: "/assets/games/face-turn/cards/moves/sell-out.avif",
		name: "Sell Out",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of your turn, deal 5 damage to your Boss. Then gain 2 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "side-hustle",
		artSrc: "/assets/games/face-turn/cards/moves/side-hustle.avif",
		name: "Side Hustle",
		baseCost: 2,
		moveType: "active",
		effectText: "At the start of your turn, gain 2 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "supply-drop",
		artSrc: "/assets/games/face-turn/cards/moves/supply-drop.avif",
		name: "Supply Drop",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever your team performs a Collector action, gain 1 additional Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "void-arms",
		artSrc: "/assets/games/face-turn/cards/moves/void-arms.avif",
		name: "The Iterated Void's Arms",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever an enemy would choose which of your face-down Crew to turn face-up, you make that choice instead.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "void-legs",
		artSrc: "/assets/games/face-turn/cards/moves/void-legs.avif",
		name: "The Iterated Void's Legs",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of your turn, you may discard. If you do, deal 5 damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "void-torso",
		artSrc: "/assets/games/face-turn/cards/moves/void-torso.avif",
		name: "The Iterated Void's Torso",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of your turn, give 5 Armor to your Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "trickle-down-economics",
		artSrc: "/assets/games/face-turn/cards/moves/trickle-down-economics.avif",
		name: "Trickle-Down Economics",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an enemy's Collector action resolves, gain the same amount of Cash they gained.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "warrant-of-arrest",
		artSrc: "/assets/games/face-turn/cards/moves/warrant-of-arrest.avif",
		name: "Warrant of Arrest",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Mark a face-down enemy Crew. At the start of your 2nd turn after this resolves, if that Crew is still face-down, turn it face-up.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},

	// burst moves
	{
		id: "all-in",
		artSrc: "/assets/games/face-turn/cards/moves/all-in.avif",
		name: "All-In",
		baseCost: 4,
		moveType: "burst",
		effectText: "Set an allied Boss's HP to 1. You gain 7 Cash and draw 2.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "ayuda-slip",
		artSrc: "/assets/games/face-turn/cards/moves/ayuda-slip.avif",
		name: "Ayuda Slip",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Whoever has the least Cash on your team gains 3 Cash and draws 1. If tied, random.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "bailout",
		artSrc: "/assets/games/face-turn/cards/moves/bailout.avif",
		name: "Bailout",
		baseCost: 2,
		moveType: "burst",
		effectText: "Heal an allied Boss for 20 HP. You gain 2 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "bulletproof-vest",
		artSrc: "/assets/games/face-turn/cards/moves/bulletproof-vest.avif",
		name: "Bulletproof Vest",
		baseCost: 1,
		moveType: "burst",
		effectText: "Give 10 Armor to an allied Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "cash-out",
		artSrc: "/assets/games/face-turn/cards/moves/cash-out.avif",
		name: "Cash Out",
		baseCost: 0,
		moveType: "burst",
		effectText: "Discard 2. If you do, gain 3 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "cheap-labor",
		artSrc: "/assets/games/face-turn/cards/moves/cheap-labor.avif",
		name: "Cheap Labor",
		baseCost: 1,
		moveType: "burst",
		effectText: "Draw 1 and gain 2 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "chronotrix",
		artSrc: "/assets/games/face-turn/cards/moves/chronotrix.avif",
		name: "Chronotrix",
		baseCost: 10,
		moveType: "burst",
		effectText:
			"Return cards from your discard pile to your hand until your hand is full. Gain 10 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "coordinated-strike",
		artSrc: "/assets/games/face-turn/cards/moves/coordinated-strike.avif",
		name: "Coordinated Strike",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Deal 15 damage to an enemy Boss. If the team has a face-up Striker, deal 30 damage instead.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "dead-drop-retrieval",
		artSrc: "/assets/games/face-turn/cards/moves/dead-drop-retrieval.avif",
		name: "Dead Drop Retrieval",
		baseCost: 2,
		moveType: "burst",
		effectText: "Draw 3.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "deleb-i",
		artSrc: "/assets/games/face-turn/cards/moves/deleb-i.avif",
		name: "Deleb-i, The Iterated Void",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"If The Iterated Void's Arms, Legs, and Torso are all in your ongoing zone, you win the game.",
		flavorText: "DELETE. ALL. BUT. I.",
		lore: "",
		synergyIds: ["void-arms", "void-legs", "void-torso"],
	},
	{
		id: "dig-deep",
		artSrc: "/assets/games/face-turn/cards/moves/dig-deep.avif",
		name: "Dig Deep",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"You look at the top 5 cards of your deck. Draw 2, then shuffle your deck.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "empty-the-clip",
		artSrc: "/assets/games/face-turn/cards/moves/empty-the-clip.avif",
		name: "Empty The Clip",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"You discard any number of cards from your hand. Deal 10 damage to an enemy Boss for each.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "first-aid",
		artSrc: "/assets/games/face-turn/cards/moves/first-aid.avif",
		name: "First Aid",
		baseCost: 1,
		moveType: "burst",
		effectText: "Heal an allied Boss for 20 HP.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "fresh-start",
		artSrc: "/assets/games/face-turn/cards/moves/fresh-start.avif",
		name: "Fresh Start",
		baseCost: 1,
		moveType: "burst",
		effectText:
			"Draw 1. If you had no other cards in hand when you played this Move, draw 3 instead.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "full-moon",
		artSrc: "/assets/games/face-turn/cards/moves/full-moon.avif",
		name: "Full Moon",
		baseCost: 1,
		moveType: "burst",
		effectText: "Transform Andrew into Wolfman.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "heel-turn",
		artSrc: "/assets/games/face-turn/cards/moves/heel-turn.avif",
		name: "Heel Turn",
		baseCost: 4,
		moveType: "burst",
		effectText: "Turn one of your Crew face-down.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "my-treat",
		artSrc: "/assets/games/face-turn/cards/moves/my-treat.avif",
		name: "My Treat",
		baseCost: 2,
		moveType: "burst",
		effectText: "An allied player gains 2 Cash and draws 1.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "neetos-clock",
		artSrc: "/assets/games/face-turn/cards/moves/neetos-clock.avif",
		name: "Neeto's Clock",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Discard 2. If you do, trigger one of your face-up Crew's Revealed effect.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "paycheck",
		artSrc: "/assets/games/face-turn/cards/moves/paycheck.avif",
		name: "Paycheck",
		baseCost: 2,
		moveType: "burst",
		effectText: "Gain 4 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "pull-counter",
		artSrc: "/assets/games/face-turn/cards/moves/pull-counter.avif",
		name: "Pull Counter",
		baseCost: 3,
		moveType: "burst",
		effectText: "Trigger one of your face-up Crew's Revealed effect.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "reinforcements",
		artSrc: "/assets/games/face-turn/cards/moves/reinforcements.avif",
		name: "Reinforcements",
		baseCost: 2,
		moveType: "burst",
		effectText: "Give 15 Armor to an allied Boss. Draw 1.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "reload",
		artSrc: "/assets/games/face-turn/cards/moves/reload.avif",
		name: "Reload",
		baseCost: 1,
		moveType: "burst",
		effectText: "Draw 2.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "restock",
		artSrc: "/assets/games/face-turn/cards/moves/restock.avif",
		name: "Restock",
		baseCost: 1,
		moveType: "burst",
		effectText: "Shuffle your discard pile into your deck. Draw 1.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "sabotage",
		artSrc: "/assets/games/face-turn/cards/moves/sabotage.avif",
		name: "Sabotage",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Choose an Ongoing Move in an enemy's ongoing zone. Discard it.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "spare-change",
		artSrc: "/assets/games/face-turn/cards/moves/spare-change.avif",
		name: "Spare Change",
		baseCost: 1,
		moveType: "burst",
		effectText: "Gain 3 Cash.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "sucker-punch",
		artSrc: "/assets/games/face-turn/cards/moves/sucker-punch.avif",
		name: "Sucker Punch",
		baseCost: 1,
		moveType: "burst",
		effectText: "Deal 15 damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "switch-up",
		artSrc: "/assets/games/face-turn/cards/moves/switch-up.avif",
		name: "Switch Up",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Turn one of your Crew face-down and a different one of your Crew face-up.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "tactical-support",
		artSrc: "/assets/games/face-turn/cards/moves/tactical-support.avif",
		name: "Tactical Support",
		baseCost: 5,
		moveType: "burst",
		effectText:
			"An allied player gains 2 Cash. You may then turn one of their face-up Crew face-down.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "tag-out",
		artSrc: "/assets/games/face-turn/cards/moves/tag-out.avif",
		name: "Tag Out",
		baseCost: 0,
		moveType: "burst",
		effectText:
			"Choose one of your Crew and one of a teammate's Crew. Swap them.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "take-it-back",
		artSrc: "/assets/games/face-turn/cards/moves/take-it-back.avif",
		name: "Take It Back",
		baseCost: 1,
		moveType: "burst",
		effectText: "Return 1 random card from your discard pile to your hand.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "triangle-of-trust",
		artSrc: "/assets/games/face-turn/cards/moves/triangle-of-trust.avif",
		name: "Triangle of Trust",
		baseCost: 1,
		moveType: "burst",
		effectText: "Discard 1. If you do, draw 3.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},

	// slow moves
	{
		id: "ambush",
		artSrc: "/assets/games/face-turn/cards/moves/ambush.avif",
		name: "Ambush",
		baseCost: 4,
		moveType: "slow",
		effectText: "Strike an enemy Crew. This can be defended against.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "cheap-shot",
		artSrc: "/assets/games/face-turn/cards/moves/cheap-shot.avif",
		name: "Cheap Shot",
		baseCost: 1,
		moveType: "slow",
		effectText: "Deal 20 damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "claim-the-bounty",
		artSrc: "/assets/games/face-turn/cards/moves/claim-the-bounty.avif",
		name: "Claim The Bounty",
		baseCost: 4,
		moveType: "slow",
		effectText:
			"Deal 25 damage to an enemy Boss. If you have successfully called a bluff this game, this costs 0 Cash instead.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "devastate",
		artSrc: "/assets/games/face-turn/cards/moves/devastate.avif",
		name: "Devastate",
		baseCost: 7,
		moveType: "slow",
		effectText: "Deal damage equal to 50% of an enemy Boss's current HP.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "drive-by",
		artSrc: "/assets/games/face-turn/cards/moves/drive-by.avif",
		name: "Drive-By",
		baseCost: 3,
		moveType: "slow",
		effectText: "Deal 30 damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "interrogation",
		artSrc: "/assets/games/face-turn/cards/moves/interrogation.avif",
		name: "Interrogation",
		baseCost: 1,
		moveType: "slow",
		effectText:
			"Look at 2 random cards from an enemy's hand. You may discard 1 of them.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "job-application",
		artSrc: "/assets/games/face-turn/cards/moves/job-application.avif",
		name: "Job Application",
		baseCost: 3,
		moveType: "slow",
		effectText: "Set your Cash and an enemy's Cash to 0. Then draw 3.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "kamikaze",
		artSrc: "/assets/games/face-turn/cards/moves/kamikaze.avif",
		name: "Kamikaze",
		baseCost: 0,
		moveType: "slow",
		effectText:
			"Turn one of your Crew face-up. If you do, deal 30 damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "nope",
		artSrc: "/assets/games/face-turn/cards/moves/nope.avif",
		name: "Nope!",
		baseCost: 1,
		moveType: "slow",
		effectText: "Stop an enemy Slow Move.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "pickpocket",
		artSrc: "/assets/games/face-turn/cards/moves/pickpocket.avif",
		name: "Pickpocket",
		baseCost: 0,
		moveType: "slow",
		effectText: "Steal 2 Cash from an enemy.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "prank-call",
		artSrc: "/assets/games/face-turn/cards/moves/prank-call.avif",
		name: "Prank Call",
		baseCost: 2,
		moveType: "slow",
		effectText: "If you have ever bluffed, steal 4 Cash from an enemy.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "ratatatat",
		artSrc: "/assets/games/face-turn/cards/moves/ratatatat.avif",
		name: "Ratatatat!",
		baseCost: 2,
		moveType: "slow",
		effectText: "Deal 20 piercing damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "reverse-card",
		artSrc: "/assets/games/face-turn/cards/moves/reversal.avif",
		name: "Reversal",
		baseCost: 2,
		moveType: "slow",
		effectText:
			"Stop an enemy Slow Move. If that Move deals damage, its damage is dealt to its caster instead.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "scorched-earth",
		artSrc: "/assets/games/face-turn/cards/moves/scorched-earth.avif",
		name: "Scorched Earth",
		baseCost: 3,
		moveType: "slow",
		effectText: "Discard all Ongoing Moves from an enemy's ongoing zone.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "strip-em-down",
		artSrc: "/assets/games/face-turn/cards/moves/strip-em-down.avif",
		name: "Strip 'Em Down",
		baseCost: 1,
		moveType: "slow",
		effectText: "Remove all Armor from an enemy Boss. Draw 1.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "to-the-death",
		artSrc: "/assets/games/face-turn/cards/moves/to-the-death.avif",
		name: "To The Death",
		baseCost: 5,
		moveType: "slow",
		effectText:
			"Kill one of your face-up Crew. Then perform an unstoppable Strike.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "truth-serum",
		artSrc: "/assets/games/face-turn/cards/moves/truth-serum.avif",
		name: "Truth Serum",
		baseCost: 3,
		moveType: "slow",
		effectText: "An enemy reveals the class of one of their face-down Crew.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "unfinished-business",
		artSrc: "/assets/games/face-turn/cards/moves/unfinished-business.avif",
		name: "Unfinished Business",
		baseCost: 4,
		moveType: "slow",
		effectText:
			"If the team has a face-up Defender, perform an unstoppable Strike on an enemy Crew.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "wheel-of-fortune",
		artSrc: "/assets/games/face-turn/cards/moves/wheel-of-fortune.avif",
		name: "Wheel Of Fortune",
		baseCost: 1,
		moveType: "slow",
		effectText:
			"You and an enemy each discard your hands, then each draw that many.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
	{
		id: "wolfblaster",
		artSrc: "/assets/games/face-turn/cards/moves/wolfblaster.avif",
		name: "Wolfblaster",
		baseCost: 6,
		moveType: "slow",
		effectText: "Deal 40 damage to an enemy Boss.",
		flavorText: "",
		lore: "",
		synergyIds: [],
	},
];

export type MoveTargetKind =
	| "enemy_boss"
	| "enemy_crew"
	| "enemy_active"
	| "enemy_player"
	| "ally_crew"
	| "ally_player"
	// ally-scoped but excludes caster
	| "ally_teammate"
	// target is always the caster, no picker
	| "ally_self"
	| "no_target";

export const MOVE_TARGET_KIND: Readonly<Record<string, MoveTargetKind>> = {
	"background-check": "no_target",
	"bamboo-wall": "no_target",
	"big-voucher": "no_target",
	blackmail: "no_target",
	"blood-money": "no_target",
	"cease-and-desist": "no_target",
	"command-center": "no_target",
	dataminer: "no_target",
	equalizer: "no_target",
	extortion: "no_target",
	"false-flag-operation": "no_target",
	"life-insurance": "ally_player",
	"poison-breath": "no_target",
	"red-herring": "no_target",
	"sell-out": "no_target",
	"side-hustle": "no_target",
	"supply-drop": "no_target",
	"void-arms": "no_target",
	"void-legs": "no_target",
	"void-torso": "no_target",
	// primary is no_target; enemy crew slot supplied via armed secondary pick.
	"warrant-of-arrest": "no_target",

	"all-in": "ally_player",
	"ayuda-slip": "no_target",
	bailout: "ally_player",
	"bulletproof-vest": "ally_player",
	"cash-out": "no_target",
	"cheap-labor": "no_target",
	chronotrix: "no_target",
	"coordinated-strike": "enemy_boss",
	"dead-drop-retrieval": "no_target",
	"deleb-i": "no_target",
	"dig-deep": "no_target",
	"empty-the-clip": "enemy_boss",
	"first-aid": "ally_player",
	"fresh-start": "no_target",
	"full-moon": "no_target",
	"heel-turn": "no_target",
	"my-treat": "ally_teammate",
	"neetos-clock": "no_target",
	paycheck: "no_target",
	"pull-counter": "no_target",
	reinforcements: "ally_player",
	reload: "no_target",
	restock: "no_target",
	sabotage: "enemy_active",
	"spare-change": "no_target",
	"sucker-punch": "enemy_boss",
	"switch-up": "no_target",
	"tactical-support": "ally_player",
	"tag-out": "ally_teammate",
	"take-it-back": "no_target",
	"triangle-of-trust": "no_target",

	ambush: "enemy_crew",
	"cheap-shot": "enemy_boss",
	"claim-the-bounty": "enemy_boss",
	devastate: "enemy_boss",
	"drive-by": "enemy_boss",
	interrogation: "enemy_player",
	"job-application": "enemy_player",
	kamikaze: "enemy_boss",
	nope: "no_target",
	"trickle-down-economics": "enemy_player",
	pickpocket: "enemy_player",
	"prank-call": "enemy_player",
	ratatatat: "enemy_boss",
	"reverse-card": "no_target",
	"scorched-earth": "enemy_player",
	"strip-em-down": "enemy_boss",
	"to-the-death": "enemy_crew",
	"truth-serum": "enemy_player",
	"unfinished-business": "enemy_crew",
	"wheel-of-fortune": "enemy_player",
	wolfblaster: "enemy_boss",
};

export function getMoveTargetKind(moveId: string): MoveTargetKind {
	const kind = MOVE_TARGET_KIND[moveId];
	if (!kind)
		throw new Error(`[face-turn] no MoveTargetKind for move: "${moveId}"`);
	return kind;
}

export type PostPlacementScope =
	| "own_crew"
	| "enemy_crew"
	| "enemy_player"
	| "enemy_active";

export type PostPlacementTarget = {
	readonly required: boolean;
	readonly scope: PostPlacementScope;
	// only for own_crew; field splits due to schema inconsistency
	readonly field?: "targetCrewSlot" | "targetAllySlot";
} | null;

export const MOVE_POST_PLACEMENT_TARGET: Readonly<
	Record<string, PostPlacementTarget>
> = {
	"heel-turn": null,
	"pull-counter": {
		required: false,
		scope: "own_crew",
		field: "targetAllySlot",
	},
	"red-herring": {
		required: false,
		scope: "own_crew",
		field: "targetCrewSlot",
	},
	kamikaze: null,
	"to-the-death": {
		required: true,
		scope: "own_crew",
		field: "targetAllySlot",
	},
	"warrant-of-arrest": { required: true, scope: "enemy_crew" },
	"poison-breath": { required: false, scope: "enemy_player" },
	// primary target already supplies both fields, no secondary pick
	sabotage: null,
	"neetos-clock": null,
};

export function getMovePostPlacementTarget(
	moveId: string,
): PostPlacementTarget {
	return MOVE_POST_PLACEMENT_TARGET[moveId] ?? null;
}

export const BOSS_DISPLAY_MAP = new Map(BOSS_DISPLAY.map((b) => [b.id, b]));
export const CREW_DISPLAY_MAP = new Map(CREW_DISPLAY.map((c) => [c.id, c]));
export const MOVE_DISPLAY_MAP = new Map(MOVE_DISPLAY.map((m) => [m.id, m]));

export type CardId = string;

export const ALL_CARDS_MAP = new Map<CardId, BaseCardDisplay>([
	...BOSS_DISPLAY.map((c) => [c.id, c] as const),
	...CREW_DISPLAY.map((c) => [c.id, c] as const),
	...MOVE_DISPLAY.map((c) => [c.id, c] as const),
]);

export function getCardById(id: CardId): BaseCardDisplay | undefined {
	return ALL_CARDS_MAP.get(id);
}

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