import type {
	Card,
	PlayerStatus,
	PokerPhase,
	LastAction,
	HandResult,
} from "../../../../shared/games/poker//index";
import type { AIPersonality } from "./ai/types";
import type { PokerLogger } from "./logger";
import type { ActiveLine } from "./ai/strategy/lines";
import type { NameDispenser } from "./ai/personality";

// scoped to current street, reset each new street
export interface BettingRoundState {
	betToCall: number;
	lastRaiseIncrement: number;
	lastRaiserId: string | null;
}

export interface SidePot {
	amount: number;
	eligiblePlayerIds: string[];
}

// server-authoritative action union. used by betting, index, and ai
export type PokerServerAction =
	| { type: "fold" }
	| { type: "check" }
	| { type: "call" }
	| { type: "raise"; amount: number }
	| { type: "all_in" };

export interface PokerServerPlayer {
	playerId: string;
	seatIndex: number;
	stack: number;
	// set on deal, null between hands
	holeCards: [Card, Card] | null;
	status: PlayerStatus;
	// chips committed this street only
	currentBet: number;
	// total chips committed this hand across all streets
	totalContributed: number;
	hasActedThisRound: boolean;
	canRaise: boolean;
	isDealer: boolean;
	displayName: string | null;
	isAI: boolean;
	aiPersonality: AIPersonality | null;
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
	pfAggressorId: string | null;
	// ai's estimated range per player. 169 Float32Array weights. initialised
	// uniform, narrowed per action, reset each hand. server-only
	opponentRangeModels: Map<string, Float32Array>;
	nameDispenser: NameDispenser;
	activeLines: Map<string, ActiveLine | null>;
}

// one pot's resolution at showdown
export interface PotResolution {
	potIndex: number;
	winnerIds: string[];
	amount: number;
	handDescription: string | null;
}

// constants shape for typed parameters
export type PokerConstants = {
	readonly STARTING_STACK: number;
	readonly SMALL_BLIND: number;
	readonly BIG_BLIND: number;
	readonly WAITING_DURATION_MS: number;
	readonly SHOWDOWN_DURATION_MS: number;
	readonly HAND_END_DURATION_MS: number;
	readonly TURN_DURATION_MS: number;
};