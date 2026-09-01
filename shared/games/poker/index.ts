export type Rank =
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "T"
	| "J"
	| "Q"
	| "K"
	| "A";

export type Suit = "h" | "d" | "c" | "s";

export type Card = `${Rank}${Suit}`;

export type PokerPhase =
	| "waiting"
	| "pre_flop"
	| "flop"
	| "turn"
	| "river"
	| "showdown"
	| "hand_end"
	| "finished";

export type BettingPhase = Extract<
	PokerPhase,
	"pre_flop" | "flop" | "turn" | "river"
>;

export type PlayerStatus = "active" | "folded" | "allin" | "out";

export type PokerAction =
	| { readonly type: "fold" }
	| { readonly type: "check" }
	| { readonly type: "call" }
	| { readonly type: "raise"; readonly amount: number }
	| { readonly type: "all_in" };

export interface LastAction {
	readonly playerId: string;
	readonly type: PokerAction["type"];
	readonly amount?: number;
}

export interface PotResult {
	readonly amount: number;
	readonly winnerIds: readonly string[];
	readonly handDescription: string | null; // null = won without showdown
}

export interface HandResult {
	readonly potResults: readonly PotResult[];
}

export interface PokerPlayerView {
	readonly playerId: string;
	readonly seatIndex: number;
	readonly stack: number;
	readonly status: PlayerStatus;
	readonly currentBet: number;
	readonly totalContributed: number;
	readonly holeCards: readonly [Card | null, Card | null];
	readonly isDealer: boolean;
	readonly canRaise: boolean;
	readonly displayName: string | null;
}

export interface PotView {
	readonly amount: number;
	readonly eligiblePlayerIds: readonly string[];
}

export interface PokerSecret {
	readonly holeCards: readonly [Card, Card];
}

export interface PokerState {
	readonly phase: PokerPhase;
	readonly communityCards: readonly Card[];
	readonly pots: readonly PotView[];
	readonly players: Readonly<Record<string, PokerPlayerView>>;
	readonly seatOrder: readonly string[];
	readonly currentPlayerId: string | null;
	readonly dealerSeatIndex: number;

	readonly bigBlind: number;
	readonly smallBlind: number;

	readonly betToCall: number;
	readonly minRaise: number;
	readonly handNumber: number;

	readonly lastAction: LastAction | null;
	readonly handResult: HandResult | null;
}