import type {
	SabongPhase,
	BattleEvent,
	SabongState,
	HideableStat,
} from "../../../../shared/sabong";

export type { HideableStat };

// runtime array of hideable stat names. lives server-side because shared/ is
// CommonJS and verbatimModuleSyntax forbids value exports there
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
	// reduces effective defense of the opponent, never shown to players
	determination: number;
	// accumulated mid-battle attack bonus, reset between matches
	attackBoost: number;
	// two stats hidden from public betting view, randomised per manok
	hiddenStats: Set<HideableStat>;
	// set when a player uses sabotage. effect: attack ×0.8, determination → 0.
	// not reflected in public odds — only saboteur sees impact via private view
	isSabotaged: boolean;
}

// always computed from clean (pre-sabotage) stats so public odds never leak
// whether a sabotage has occurred. mirrors OddsResult from odds.ts
export interface SlotOdds {
	probability: { fighter1: number; fighter2: number };
	moneyline: { fighter1: number; fighter2: number };
}

export interface ServerBracketSlot {
	matchIndex: number;
	fighter1Id: string | null;
	fighter2Id: string | null;
	winnerId: string | null;
	// full odds snapshot, null until betting opens, always based on clean stats
	odds: SlotOdds | null;
}

export interface SabongServerPlayer {
	playerId: string;
	balance: number;

	// bracket pick
	bracketPickId: string | null;
	bracketPickLocked: boolean;

	// shop intelligence (private, never in public state)
	// all fighters this player has sabotaged, persists across shop phases
	sabotageTargets: Set<string>;
	// per-fighter revealed stats, persists across shop phases
	revealedStats: Map<string, Set<HideableStat>>;
	// spy uses consumed in current shop phase, reset by openShop
	shopSpyUsed: number;
	// sabotage uses consumed in current shop phase, reset by openShop
	shopSabotageUsed: number;

	// per-match bet
	currentBet: { manokId: string; amount: number } | null;
	betLocked: boolean;

	receivedAyudaThisRound: boolean;
}

export interface SabongServerState {
	phase: SabongPhase;
	manoks: Map<string, ManokStats>;
	bracket: ServerBracketSlot[];
	currentMatchIndex: number;
	// full event log of the last simulated fight, replayed as animation on client
	battleLog: BattleEvent[] | null;
	players: Map<string, SabongServerPlayer>;

	lockedPickCount: number;
	lockedBetCount: number;
	matchCount: number;

	// public state cache
	_publicStateCacheValid: boolean;
	_cachedPublicState: SabongState | null;
}

export const SABONG_CONSTANTS = {
	STARTING_BALANCE: 200,
	AYUDA_AMOUNT: 40,
	AYUDA_SCALE: 0.25,
	// effective ayuda: QF0→₱40 QF1→₱50 QF2→₱60 QF3→₱70 SF0→₱80 SF1→₱90 Final→₱100
	BRACKET_PICK_BONUS: 150,
	CONTRARIAN_BONUS_MAX: 0.5,

	// match indices (0-based) after whose payout the shop opens.
	// default: after last QF (3) and last SF (5). set to [] to disable shop
	SHOP_AFTER_MATCH_INDICES: [3, 5] as readonly number[],
	SHOP_DURATION_MS: 45_000,
	SPY_PRICE: 25,
	SABOTAGE_PRICE: 70,
	// max uses per player per shop phase. 0 = unlimited
	SPY_CAP: 2 as number,
	SABOTAGE_CAP: 1 as number,

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
	BALANCE_TOLERANCE: 0.125,
	MIN_STAT_DIFF_COUNT: 3,

	PRE_TOURNAMENT_DURATION_MS: 90_000,
	BETTING_DURATION_MS: 60_000,
	FIGHT_EVENT_DURATION_MS: 1_200,
	FIGHT_BUFFER_MS: 3_000,
	PAYOUT_DURATION_MS: 6_000,
} as const;