import type {
	SabongPhase,
	BattleEvent,
	SabongState,
	HideableStat,
} from "../../../../shared/games/sabong/index";

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
	// hidden combat stat — reduces effective opponent defense per hit
	determination: number;
	// randomised set of stats hidden from public view
	hiddenStats: Set<HideableStat>;
	// set by sabotage: attack ×0.8, determination → 0. persists entire tournament.
	// rewards early intelligence investment and creates info asymmetry.
	// public odds are never recomputed after sabotage to avoid leaking the action.
	isSabotaged: boolean;
}

// computed from clean (pre-sabotage) stats so public odds never reveal sabotage
export interface SlotOdds {
	probability: { fighter1: number; fighter2: number };
	moneyline: { fighter1: number; fighter2: number };
}

export interface ServerBracketSlot {
	matchIndex: number;
	fighter1Id: string | null;
	fighter2Id: string | null;
	winnerId: string | null;
	// odds snapshot: null until betting opens, computed from clean stats only
	odds: SlotOdds | null;
}

export interface SabongServerPlayer {
	playerId: string;
	balance: number;

	bracketPickId: string | null;
	bracketPickLocked: boolean;

	// shop intelligence — private, never in public state
	sabotageTargets: Set<string>; // persists across all shop phases
	revealedStats: Map<string, Set<HideableStat>>; // persists across all shop phases
	shopSpyUsed: number; // reset each shop phase by openShop
	shopSabotageUsed: number; // reset each shop phase by openShop

	currentBet: { manokId: string; amount: number } | null;
	betLocked: boolean;

	// true when the player received ayuda this round; surfaced in private view
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

	// counts of players who have confirmed their action this phase.
	// quorum (allPicksLocked/allBetsLocked) is checked against state.players.size, a
	// snapshot taken at onStart — not room.players.size (live connected count). A
	// player who disconnects still counts toward quorum; phase timers are what
	// prevent the room from hanging on an absent player.
	lockedPickCount: number;
	lockedBetCount: number;
	matchCount: number;

	// public state cache — invalidated by markDirty on any mutation
	_publicStateCacheValid: boolean;
	_cachedPublicState: SabongState | null;
}

export const SABONG_CONSTANTS = {
	STARTING_BALANCE: 200,
	AYUDA_AMOUNT: 40,
	AYUDA_SCALE: 0.25,
	// effective ayuda per match: qf0→40 qf1→50 qf2→60 qf3→70 sf0→80 sf1→90 final→100
	BRACKET_PICK_BONUS: 150,
	CONTRARIAN_BONUS_MAX: 0.5,

	// match indices after which payout opens the shop. set to [] to disable entirely.
	SHOP_AFTER_MATCH_INDICES: [3, 5] as readonly number[],
	SHOP_DURATION_MS: 45_000,
	SPY_PRICE: 25,
	SABOTAGE_PRICE: 70,
	// max uses per player per shop phase. 0 = unlimited.
	SPY_CAP: 2 as number,
	SABOTAGE_CAP: 1 as number,

	MANOK_COUNT: 8,
	// hidden stat count per manok, must be ≤ HIDEABLE_STATS.length
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