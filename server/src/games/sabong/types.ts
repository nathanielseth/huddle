import type {
	SabongPhase,
	BattleEvent,
	SabongState,
	HideableStat,
} from "../../../../shared/games/sabong";

export type { HideableStat };

// runtime array of hideable stat names, lives server-side because shared/ is commonjs
export const HIDEABLE_STATS: readonly HideableStat[] = [
	"health",
	"attack",
	"defense",
	"speed",
	"critRate",
] as const;

export interface ManokStats {
	id: string;
	name: string;
	health: number;
	maxHealth: number;
	attack: number;
	defense: number;
	speed: number;
	critRate: number;
	// hidden combat stat, reduces opponent defense per hit
	determination: number;
	// accumulated mid-battle attack bonus, reset per match
	attackBoost: number;
	// randomised set of stats hidden from public view
	hiddenStats: Set<HideableStat>;
	// set by sabotage, attack x0.8 and determination 0, persists entire tournament, rewards early investment and creates info asymmetry, public odds unchanged
	isSabotaged: boolean;
}

// computed from clean (pre-sabotage) stats so public odds never reveal sabotage, mirrors oddsresult
export interface SlotOdds {
	probability: { fighter1: number; fighter2: number };
	moneyline: { fighter1: number; fighter2: number };
}

export interface ServerBracketSlot {
	matchIndex: number;
	fighter1Id: string | null;
	fighter2Id: string | null;
	winnerId: string | null;
	// odds snapshot, null until betting opens, based on clean stats
	odds: SlotOdds | null;
}

export interface SabongServerPlayer {
	playerId: string;
	balance: number;

	bracketPickId: string | null;
	bracketPickLocked: boolean;

	// shop intelligence, private, never in public state
	// sabotaged fighters, persists across shop phases
	sabotageTargets: Set<string>;
	// revealed stats per fighter, persists across shop phases
	revealedStats: Map<string, Set<HideableStat>>;
	// uses consumed this shop phase, reset by openshop
	shopSpyUsed: number;
	shopSabotageUsed: number;

	currentBet: { manokId: string; amount: number } | null;
	betLocked: boolean;

	receivedAyudaThisRound: boolean;
}

export interface SabongServerState {
	phase: SabongPhase;
	manoks: Map<string, ManokStats>;
	bracket: ServerBracketSlot[];
	currentMatchIndex: number;
	// last fight event log, replayed as animation on client
	battleLog: BattleEvent[] | null;
	players: Map<string, SabongServerPlayer>;

	lockedPickCount: number;
	lockedBetCount: number;
	matchCount: number;

	// public state cache, invalidated by markdirty on mutations
	_publicStateCacheValid: boolean;
	_cachedPublicState: SabongState | null;
}

export const SABONG_CONSTANTS = {
	STARTING_BALANCE: 200,
	AYUDA_AMOUNT: 40,
	AYUDA_SCALE: 0.25,
	// effective ayuda: qf0→40 qf1→50 qf2→60 qf3→70 sf0→80 sf1→90 final→100
	BRACKET_PICK_BONUS: 150,
	CONTRARIAN_BONUS_MAX: 0.5,

	// match indices after payout where shop opens, set to [] to disable
	SHOP_AFTER_MATCH_INDICES: [3, 5] as readonly number[],
	SHOP_DURATION_MS: 45_000,
	SPY_PRICE: 25,
	SABOTAGE_PRICE: 70,
	// max uses per player per shop phase, 0 = unlimited
	SPY_CAP: 2 as number,
	SABOTAGE_CAP: 1 as number,

	MANOK_COUNT: 8,
	// hidden stats count per manok, ≤ hideable_stats.length
	HIDDEN_STAT_COUNT: 2,
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
	BALANCE_TOLERANCE: 0.125,
	MIN_STAT_DIFF_COUNT: 3,

	PRE_TOURNAMENT_DURATION_MS: 90_000,
	BETTING_DURATION_MS: 60_000,
	FIGHT_EVENT_DURATION_MS: 1_200,
	FIGHT_BUFFER_MS: 3_000,
	PAYOUT_DURATION_MS: 6_000,
} as const;