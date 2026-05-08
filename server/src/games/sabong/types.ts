import type { SabongLogger } from "./logger.js";
import type { SabongPhase, BattleEvent } from "../../../../shared/sabong.js";

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
	isSabotaged: boolean;
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
	sabotageTargetId: string | null;
	currentBet: { manokId: string; amount: number } | null;
	betLocked: boolean; // true = locked, waiting for other players
	receivedAyudaThisRound: boolean; // prevents multiple ayuda per match
}

// lives in room.gamepayload on the server as the private source of truth
export interface SabongServerState {
	phase: SabongPhase;
	manoks: Map<string, ManokStats>;
	bracket: ServerBracketSlot[];
	currentMatchIndex: number;
	battleLog: BattleEvent[] | null;
	players: Map<string, SabongServerPlayer>;
	logger: SabongLogger;
}

// actions
export type SabongAction =
	| { type: "pick_bracket_winner"; manokId: string }
	| { type: "lock_bracket_pick" } // confirms pick, no more changes
	| { type: "sabotage_manok"; manokId: string }
	| { type: "place_bet"; manokId: string; amount: number }
	| { type: "lock_bet" }; // confirms bet, no more changes

// constants
export const SABONG_CONSTANTS = {
	STARTING_BALANCE: 200, // was 100 — more runway for strategy
	AYUDA_AMOUNT: 40, // base ayuda, scaled by match index
	AYUDA_SCALE: 0.25, // ayuda × (1 + matchIndex × 0.25)
	// match 1: ₱40, match 4: ₱70, match 7: ₱100
	BRACKET_PICK_BONUS: 150, // was 300 — meaningful but not game-defining
	CONTRARIAN_BONUS_MAX: 0.5, // max 1.5× payout multiplier for going alone
	MANOK_COUNT: 8,
	MAX_TURNS: 100,
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
	PRE_TOURNAMENT_DURATION_MS: 90_000, // 90s to study bracket + pick winner
	BETTING_DURATION_MS: 60_000, // 60s to place and lock bet
	FIGHT_EVENT_DURATION_MS: 1_200, // ms per battle log event
	FIGHT_BUFFER_MS: 3_000, // extra buffer after events finish
	PAYOUT_DURATION_MS: 6_000,
} as const;

export const HIDEABLE_STATS = [
	"health",
	"attack",
	"defense",
	"speed",
	"critRate",
] as const;

export type HideableStat = (typeof HIDEABLE_STATS)[number];