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
	readonly currentHp: number | null;
	readonly moneylineOdds: number;
	readonly winProbability: number;
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
	readonly sabotageTargetId: string | null;
	readonly currentBet: {
		readonly manokId: string;
		readonly amount: number;
	} | null;
	readonly betLocked: boolean;
}

export type SabongPhase =
	| "pre_tournament"
	| "betting"
	| "fighting"
	| "payout"
	| "finished";

export interface SabongState {
	readonly phase: SabongPhase;
	readonly manoks: Readonly<Record<string, ManokView>>;
	readonly bracket: readonly BracketSlot[];
	readonly currentMatchIndex: number;
	readonly battleLog: readonly BattleEvent[] | null;
	readonly players: Readonly<Record<string, SabongPlayerView>>;
	readonly allBracketPicksLocked: boolean;
	readonly matchCount: number;
}
