import type {
	BlankSlatePhase,
	BlankSlateRoundResult,
} from "../../../../shared/games/blank-slate";

export interface BlankSlateResolvedClue {
	readonly playerId: string;
	readonly raw: string;
	readonly normalized: string;
	readonly eliminated: boolean;
}

export interface BlankSlateServerState {
	phase: BlankSlatePhase;
	roundNumber: number;
	totalRounds: number;
	guesserRotation: readonly string[];
	guesserIndex: number;
	currentWord: string;
	wordDeck: string[];
	clues: Map<string, string>;
	resolvedClues: BlankSlateResolvedClue[] | null;
	guess: string | null;
	guesserActed: boolean;
	results: BlankSlateRoundResult[];
}