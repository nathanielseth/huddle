export type BelievableLiesPhase =
	| "question_select"
	| "lie_input"
	| "picking"
	| "result"
	| "round_end"
	| "finished";

export type BelievableLiesRound = 1 | 2 | 3;

export interface BelievableLiesAnswer {
	readonly id: string;
	readonly text: string;
	readonly isGameLie: boolean;
}

export interface BelievableLiesPlayerView {
	readonly playerId: string;
	readonly score: number;
	readonly hasSubmittedLie: boolean;
	readonly hasPicked: boolean;
	readonly submittedLie: string | null;
	readonly pickedAnswerId: string | null;
}

export interface BelievableLiesRoundResult {
	readonly prompt: string;
	readonly truth: string;
	readonly answers: readonly {
		readonly id: string;
		readonly text: string;
		readonly authorIds: readonly string[];
		readonly isGameLie: boolean;
		readonly isTruth: boolean;
	}[];
	readonly picks: Readonly<Record<string, string>>;
	readonly scoreDeltas: Readonly<Record<string, number>>;
	readonly truthPickerIds: readonly string[];
}

export interface BelievableLiesState {
	readonly phase: BelievableLiesPhase;
	readonly roundNumber: BelievableLiesRound;
	readonly questionIndex: number;
	readonly totalQuestionsThisRound: number;
	readonly currentPrompt: string | null;
	readonly answers: readonly BelievableLiesAnswer[] | null;
	readonly players: Readonly<Record<string, BelievableLiesPlayerView>>;
	readonly lastResult: BelievableLiesRoundResult | null;
	readonly allSubmitted: boolean;
	readonly allPicked: boolean;
	readonly pickerPlayerId: string | null;
	readonly categoryChoices: readonly string[] | null;
}

export type BelievableLiesAction =
	| { readonly type: "submit_lie"; readonly text: string }
	| { readonly type: "pick_answer"; readonly answerId: string }
	| { readonly type: "select_category"; readonly category: string };
