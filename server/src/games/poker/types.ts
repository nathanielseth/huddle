import type {
	Card,
	PlayerStatus,
	PokerPhase,
	LastAction,
	HandResult,
} from "../../../../shared/poker.js";
import type { PokerLogger } from "./logger.js";

// scoped to the current betting street, reset at start of each new street
export interface BettingRoundState {
	betToCall: number;
	lastRaiseIncrement: number;
	lastRaiserId: string | null;
}

export interface SidePot {
	amount: number;
	eligiblePlayerIds: string[];
}

export interface PokerServerPlayer {
	playerId: string;
	seatIndex: number;
	stack: number;
	// two hole cards. set on deal, null between hands
	holeCards: [Card, Card] | null;
	status: PlayerStatus;
	// chips committed in current street only
	currentBet: number;
	// running total of chips committed this entire hand across all streets
	totalContributed: number;
	hasActedThisRound: boolean;
	canRaise: boolean;
	isDealer: boolean;
}

export interface PokerServerState {
	phase: PokerPhase;
	deck: Card[];
	communityCards: Card[];
	pots: SidePot[];
	players: Map<string, PokerServerPlayer>;
	seatOrder: string[];
	dealerIndex: number;
	currentPlayerIndex: number;
	betting: BettingRoundState;
	handNumber: number;
	lastAction: LastAction | null;
	logger: PokerLogger;
	handResult: HandResult | null;
}

export type PokerServerAction =
	| { type: "fold" }
	| { type: "check" }
	| { type: "call" }
	| { type: "raise"; amount: number }
	| { type: "all_in" };

// resolution for one pot at showdown
export interface PotResolution {
	potIndex: number;
	winnerIds: string[];
	amount: number;
	handDescription: string | null;
}

// constants type alias for typed parameters in pure functions
export type PokerConstants = {
	readonly STARTING_STACK: number;
	readonly SMALL_BLIND: number;
	readonly BIG_BLIND: number;
	readonly WAITING_DURATION_MS: number;
	readonly BETTING_DURATION_MS: number;
	readonly SHOWDOWN_DURATION_MS: number;
	readonly HAND_END_DURATION_MS: number;
	readonly TURN_DURATION_MS: number;
};
