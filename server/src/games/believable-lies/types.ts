import type {
	BelievableLiesPhase,
	BelievableLiesRound,
	BelievableLiesRoundResult,
} from "../../../../shared/games/believable-lies/index";

export interface BelievableLiesQuestion {
	id: string;
	category: string;
	// fill-in-the-blank prompt, blank represented as ______
	prompt: string;
	truth: string;
	// normalised alternate forms that should also count as the truth
	alternate_truths: string[];
	// fallback lies to pad the answer pool when player count is low
	game_lies: string[];
}

export interface BelievableLiesServerPlayer {
	playerId: string;
}

// resolved answer entry in the server's answer pool for the current question
export interface BelievableLiesBuiltAnswer {
	id: string;
	text: string;
	normalizedText: string;
	authorIds: string[];
	isGameLie: boolean;
	isTruth: boolean;
}

// sentinel for players who didn't pick before timer expired
export const ABSTAIN = "__abstain__" as const;

export interface BelievableLiesServerState {
	phase: BelievableLiesPhase;
	roundNumber: BelievableLiesRound;
	// 0-based index of the current question within the current round
	questionIndex: number;
	questionQueue: BelievableLiesQuestion[];
	currentQuestion: BelievableLiesQuestion | null;
	answerPool: BelievableLiesBuiltAnswer[];
	// playerId → raw submitted lie text
	lies: Map<string, string>;
	picks: Map<string, string>;
	players: Map<string, BelievableLiesServerPlayer>;
	results: BelievableLiesRoundResult[];
	pickerPlayerId: string | null;
	categoryChoices: string[] | null;
	// player IDs already assigned as picker in current rotation cycle
	// reset when all players have had a turn
	usedPickerIds: string[];
}

export type BelievableLiesParsedAction =
	| { type: "submit_lie"; text: string }
	| { type: "pick_answer"; answerId: string }
	| { type: "select_category"; category: string };