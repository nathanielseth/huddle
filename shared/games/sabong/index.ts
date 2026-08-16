export type HideableStat =
	| "health"
	| "attack"
	| "defense"
	| "speed"
	| "critRate";

export type SabongPhase =
	| "pre_tournament"
	| "shop"
	| "betting"
	| "fighting"
	| "payout"
	| "finished";

export type MatchupTier = "even" | "slight_edge" | "favored" | "heavy_favorite";

export interface ManokView {
	readonly id: string;
	readonly name: string;
	readonly stats: {
		readonly health: number | null;
		readonly attack: number | null;
		readonly defense: number | null;
		readonly speed: number | null;
		readonly critRate: number | null;
	};
	readonly maxHp: number;
	readonly moneylineOdds: number;
	readonly winProbability: number;
	readonly matchupTier: MatchupTier | null;
	readonly matchupLabel: string | null;
	readonly matchupSubtitle: string | null;
	readonly matchupEdge: number | null;
	readonly isSabotaged: boolean;
}

export interface BracketSlot {
	readonly matchIndex: number;
	readonly fighter1Id: string | null;
	readonly fighter2Id: string | null;
	readonly winnerId: string | null;
}

export type BattleEvent =
	| {
			readonly type: "move";
			readonly turn: number;
			readonly attackerId: string;
			readonly move: "strike" | "double_strike";
			readonly damage: number;
			readonly crit: boolean;
			readonly defenderHp: number;
	  }
	| {
			readonly type: "miss";
			readonly turn: number;
			readonly attackerId: string;
			readonly move: "strike" | "double_strike";
	  }
	| {
			readonly type: "buff";
			readonly turn: number;
			readonly attackerId: string;
			readonly newAttackBoost: number;
	  }
	| { readonly type: "ko"; readonly loserId: string }
	| {
			readonly type: "timeout";
			readonly winnerId: string;
			readonly reason: "hp_advantage" | "coinflip";
	  };

export interface SabongPlayerView {
	readonly playerId: string;
	readonly balance: number;
	readonly bracketPickId: string | null;
	readonly bracketPickLocked: boolean;
	readonly currentBet: {
		readonly manokId: string;
		readonly amount: number;
	} | null;
	readonly betLocked: boolean;
}

export interface SabongPrivateView {
	readonly revealedStats: Readonly<
		Record<string, Partial<Record<HideableStat, number>>>
	>;
	readonly sabotaged: Readonly<
		Record<string, { readonly attack: number; readonly determination: number }>
	>;
	readonly shopSpyRemaining: number | null;
	readonly shopSabotageRemaining: number | null;
	readonly receivedAyuda: boolean;
	readonly myPendingBracketPick: string | null;
	readonly myPendingBet: {
		readonly manokId: string;
		readonly amount: number;
	} | null;
}

export interface SabongState {
	readonly phase: SabongPhase;
	readonly manoks: Readonly<Record<string, ManokView>>;
	readonly bracket: readonly BracketSlot[];
	readonly currentMatchIndex: number;
	readonly battleLog: readonly BattleEvent[] | null;
	readonly players: Readonly<Record<string, SabongPlayerView>>;
	readonly allBracketPicksLocked: boolean;
	readonly matchCount: number;
	readonly shopConfig: {
		readonly spyPrice: number;
		readonly sabotagePrice: number;
		readonly spyCap: number | null; // null = unlimited
		readonly sabotageCap: number | null;
	};
}