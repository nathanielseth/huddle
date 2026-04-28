export interface ManokView {
	id: string;
	name: string;
	stats: {
		health: number | null;
		attack: number | null;
		defense: number | null;
		speed: number | null;
		critRate: number | null;
	};
	maxHp: number;
	currentHp: number | null;
	moneylineOdds: number;
	winProbability: number;
}

export interface BracketSlot {
	matchIndex: number; // 0-6, order of fights in tournament
	fighter1Id: string | null;
	fighter2Id: string | null;
	winnerId: string | null;
}

// battle log
export type BattleEvent =
	| {
			type: "move";
			turn: number;
			attackerId: string;
			move: "strike" | "double_strike";
			damage: number;
			crit: boolean;
			defenderHp: number;
	  }
	| {
			type: "miss";
			turn: number;
			attackerId: string;
			move: "strike" | "double_strike";
	  }
	| { type: "buff"; turn: number; attackerId: string; newAttackBoost: number }
	| { type: "ko"; loserId: string }
	| { type: "timeout"; winnerId: string; reason: "hp_advantage" | "coinflip" };

// player betting state
export interface SabongPlayerView {
	playerId: string;
	balance: number;
	bracketPickId: string | null; // which manok they picked to win the whole tournament
	bracketPickLocked: boolean;
	sabotageTargetId: string | null;
	currentBet: { manokId: string; amount: number } | null;
	betLocked: boolean; // true = they're done betting this match, waiting for others
}

// sabong-specific phases
export type SabongPhase =
	| "pre_tournament" // players pick tournament winner + study matchups
	| "betting" // current match open for bets
	| "fighting" // pre-computed battle log streaming on client
	| "payout" // results shown, balances updated
	| "finished"; // all 7 matches done, final leaderboard

// the full game payload, travels inside GameState.gamePayload
export interface SabongState {
	phase: SabongPhase;
	manoks: Record<string, ManokView>;
	bracket: BracketSlot[];
	currentMatchIndex: number;
	battleLog: BattleEvent[] | null;
	players: Record<string, SabongPlayerView>;
	allBracketPicksLocked: boolean;
	matchCount: number;
}
