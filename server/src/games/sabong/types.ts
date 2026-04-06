export interface ManokStats {
	id: string;
	name: string;
	health: number;
	maxHealth: number;
	attack: number;
	defense: number;
	speed: number;
	critRate: number;
	determination: number; // hidden from players
	attackBoost: number; // mutable during battle, reset between matches
	hiddenStats: Set<"health" | "attack" | "defense" | "speed" | "critRate">;
}

// server bracket slot
export interface ServerBracketSlot {
	matchIndex: number;
	fighter1Id: string | null;
	fighter2Id: string | null;
	winnerId: string | null;
	odds: { fighter1: number; fighter2: number } | null;
}

// server player state
export interface SabongServerPlayer {
	playerId: string;
	balance: number;
	bracketPickId: string | null;
	bracketPickLocked: boolean; // true = locked, cannot change tournament pick
	currentBet: { manokId: string; amount: number } | null;
	betLocked: boolean; // true = locked, waiting for other players
	receivedAyudaThisRound: boolean; // prevents multiple ayuda per match
}

// lives in room.gamepayload on the server as the private source of truth
export interface SabongServerState {
	phase: import("../../../../shared/sabong.js").SabongPhase;
	manoks: Map<string, ManokStats>; // id -> full stats
	bracket: ServerBracketSlot[];
	currentMatchIndex: number;
	battleLog: import("../../../../shared/sabong.js").BattleEvent[] | null;
	players: Map<string, SabongServerPlayer>;
}

// actions
export type SabongAction =
	| { type: "pick_bracket_winner"; manokId: string }
	| { type: "lock_bracket_pick" } // confirms pick, no more changes
	| { type: "place_bet"; manokId: string; amount: number }
	| { type: "lock_bet" }; // confirms bet, no more changes

// constants
export const SABONG_CONSTANTS = {
	STARTING_BALANCE: 100,
	AYUDA_AMOUNT: 20, // ayuda
	BRACKET_PICK_BONUS: 300, // awarded if their tournament pick wins overall
	MANOK_COUNT: 8,
	MAX_TURNS: 100,
	MONTE_CARLO_SIMS: 1000,
	STAT_RANGES: {
		health: [90, 150] as [number, number],
		attack: [40, 100] as [number, number],
		defense: [30, 90] as [number, number],
		speed: [50, 100] as [number, number],
		critRate: [5, 85] as [number, number],
		determination: [0, 5] as [number, number],
	},
	CRIT_MULTIPLIER: 1.5,
	MAX_ATTACK_BOOST: 50,
	BALANCE_TOLERANCE: 0.125, // for matchup balance check, ensures fair fights
	MIN_STAT_DIFF_COUNT: 3, // stats must differ by 10+ to consider manoks distinct
} as const;
