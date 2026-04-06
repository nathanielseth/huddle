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
	currentHp: number | null;
	moneylineOdds: number;
	winProbability: number;
}

export interface BracketSlot {
	matchIndex: number;
	fighter1Id: string | null;
	fighter2Id: string | null;
	winnerId: string | null;
}

// battle log - pre-computed on the server the moment betting closes.

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
	bracketPickId: string | null; // which they picked to win the whole tourna
	currentBet: { manokId: string; amount: number } | null;
	betLocked: boolean; // true = they're done betting this match, waiting for others
}

// sabong-specific phases

export type SabongPhase =
	| "pre_tournament" // bracket visible, players pick tournament winner + study matchups
	| "betting" // current match open for bets — proceeds when all players lock
	| "fighting" // pre-computed battle log streaming on client during animation
	| "payout" // results shown, balances updated, brief pause before next match
	| "finished"; // all 7 matches done, final leaderboard

// the full game payload — this is what travels inside gamestate.gamepayload.
// cast to this type on both the server (when building it) and the client (when reading it).

export interface SabongState {
	phase: SabongPhase;
	manoks: Record<string, ManokView>; // id -> client-safe view
	bracket: BracketSlot[]; // always 7 slots, some winnerid null
	currentMatchIndex: number; // 0–6, which match is currently active
	battleLog: BattleEvent[] | null; // null until fight resolves for current match
	players: Record<string, SabongPlayerView>;
	allBracketPicksLocked: boolean; // true once every player submitted their tournament pick
	matchCount: number; // total matches played so far
}
