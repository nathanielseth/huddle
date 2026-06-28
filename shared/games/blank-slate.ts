export type BlankSlatePhase =
	| "clue_writing"
	| "guessing"
	| "result"
	| "finished";

export type BlankSlateClueResult =
	| { readonly kind: "guesser" }
	| { readonly kind: "eliminated"; readonly text: string }
	| { readonly kind: "surviving"; readonly text: string }
	| null;

export interface BlankSlatePlayerView {
	readonly playerId: string;
	readonly score: number;
	readonly hasSubmittedClue: boolean;
	readonly isGuesser: boolean;
	readonly clueResult: BlankSlateClueResult;
}

export interface BlankSlateRoundResult {
	readonly secretWord: string;
	readonly clueEntries: readonly {
		readonly playerId: string;
		readonly text: string;
		readonly eliminated: boolean;
	}[];
	readonly guess: string | null;
	readonly correct: boolean;
	readonly guesserPlayerId: string;
	readonly scoreDeltas: Readonly<Record<string, number>>;
}

export interface BlankSlateState {
	readonly phase: BlankSlatePhase;
	readonly roundNumber: number;
	readonly totalRounds: number;
	readonly guesserPlayerId: string;
	readonly secretWord: string | null;
	readonly survivingClues:
		| readonly {
				readonly playerId: string;
				readonly text: string;
		  }[]
		| null;
	readonly players: Readonly<Record<string, BlankSlatePlayerView>>;
	readonly lastResult: BlankSlateRoundResult | null;
	readonly cluesSubmittedCount: number;
	readonly cluesExpectedCount: number;
}

export type BlankSlateAction =
	| { readonly type: "submit_clue"; readonly text: string }
	| { readonly type: "submit_guess"; readonly text: string }
	| { readonly type: "skip_guess" };