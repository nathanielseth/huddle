export type DeathvaultPhase =
	| "question_wager"
	| "question_answer"
	| "question_result"
	| "minigame_intro"
	| "minigame_active"
	| "minigame_result"
	| "round_end"
	| "final_wager"
	| "final_answer"
	| "final_result"
	| "podium";

export type MinigameId =
	| "prisoners_dilemma"
	| "floor_is_lava"
	| "word_scramble"
	| "toxic_trivia"
	| "money_grab"
	| "higher_lower"
	| "final_cut";

export type PlayerStatus = "alive" | "ghost";

export interface DeathvaultPlayerView {
	readonly playerId: string;
	readonly cash: number;
	readonly status: PlayerStatus;
	readonly hasWagered: boolean;
	readonly hasActed: boolean;
	readonly revealedAnswer: string | null;
	readonly wager: number | null;
	readonly lastDelta: number | null;
}

export interface DeathvaultQuestion {
	readonly id: string;
	readonly category: string;
	readonly difficulty: 1 | 2 | 3;
	readonly prompt: string;
	readonly choices: readonly DeathvaultChoice[];
}

export interface DeathvaultChoice {
	readonly id: string;
	readonly text: string;
}

export interface DeathvaultQuestionResult {
	readonly questionId: string;
	readonly prompt: string;
	readonly correctChoiceId: string;
	readonly answers: Readonly<Record<string, string>>;
	readonly cashDeltas: Readonly<Record<string, number>>;
	readonly correctPlayerIds: readonly string[];
	readonly wrongPlayerIds: readonly string[];
}

export interface PrisonersDilemmaState {
	readonly id: "prisoners_dilemma";
	readonly playerA: string;
	readonly playerB: string;
	readonly prizePool: number;
	readonly playerALocked: boolean;
	readonly playerBLocked: boolean;
	readonly outcome: PrisonersDilemmaOutcome | null;
}

export type PrisonersDilemmaChoice = "share" | "steal";

export interface PrisonersDilemmaOutcome {
	readonly playerAChoice: PrisonersDilemmaChoice;
	readonly playerBChoice: PrisonersDilemmaChoice;
	readonly cashDeltas: Readonly<Record<string, number>>;
}

export interface FloorIsLavaState {
	readonly id: "floor_is_lava";
	readonly tileCount: number;
	readonly wave: number;
	readonly burnedTiles: readonly number[];
	readonly positions: Readonly<Record<string, number | null>>;
	readonly survivors: readonly string[];
	readonly prizePool: number;
	readonly outcome: FloorIsLavaOutcome | null;
}

export interface FloorIsLavaOutcome {
	readonly winnerIds: readonly string[];
	readonly cashDeltas: Readonly<Record<string, number>>;
}

export interface WordScrambleState {
	readonly id: "word_scramble";
	readonly scrambled: string;
	readonly prizePool: number;
	readonly submissions: Readonly<Record<string, string>>;
	readonly outcome: WordScrambleOutcome | null;
}

export interface WordScrambleOutcome {
	readonly answer: string;
	readonly winnerIds: readonly string[];
	readonly cashDeltas: Readonly<Record<string, number>>;
}

export interface ToxicTriviaState {
	readonly id: "toxic_trivia";
	readonly prompt: string;
	readonly choices: readonly DeathvaultChoice[];
	readonly passOrder: readonly string[];
	readonly currentHolderId: string;
	readonly correctChoiceId: string | null;
	readonly prizePool: number;
	readonly outcome: ToxicTriviaOutcome | null;
}

export interface ToxicTriviaOutcome {
	readonly correctChoiceId: string;
	readonly loserIds: readonly string[];
	readonly cashDeltas: Readonly<Record<string, number>>;
}

export interface MoneyGrabState {
	readonly id: "money_grab";
	readonly durationMs: number;
	readonly prizePool: number;
	readonly tapCounts: Readonly<Record<string, number>>;
	readonly outcome: MoneyGrabOutcome | null;
}

export interface MoneyGrabOutcome {
	readonly cashDeltas: Readonly<Record<string, number>>;
}

export interface HigherLowerState {
	readonly id: "higher_lower";
	readonly prizePool: number;
	readonly revealed: readonly number[];
	readonly streak: number;
	readonly activePlayerId: string;
	readonly outcome: HigherLowerOutcome | null;
}

export interface HigherLowerOutcome {
	readonly finalStreak: number;
	readonly cashDeltas: Readonly<Record<string, number>>;
}

export interface FinalCutState {
	readonly id: "final_cut";
	readonly prizePool: number;
	readonly proposals: Readonly<Record<string, number | null>>;
	readonly outcome: FinalCutOutcome | null;
}

export interface FinalCutOutcome {
	readonly trueHalf: number;
	readonly cashDeltas: Readonly<Record<string, number>>;
}

export type MinigameState =
	| PrisonersDilemmaState
	| FloorIsLavaState
	| WordScrambleState
	| ToxicTriviaState
	| MoneyGrabState
	| HigherLowerState
	| FinalCutState;

export interface DeathvaultState {
	readonly phase: DeathvaultPhase;
	readonly round: number;
	readonly totalRounds: number;
	readonly question: DeathvaultQuestion | null;
	readonly questionResult: DeathvaultQuestionResult | null;
	readonly players: Readonly<Record<string, DeathvaultPlayerView>>;
	readonly allWagered: boolean;
	readonly allAnswered: boolean;
	readonly minigame: MinigameState | null;
	readonly isFinalRound: boolean;
}

export interface DeathvaultPlayerSecret {
	readonly myWager: number | null;
	readonly myDilemmaChoice: PrisonersDilemmaChoice | null;
}

export type DeathvaultAction =
	| { readonly type: "place_wager"; readonly amount: number }
	| { readonly type: "submit_answer"; readonly choiceId: string }
	| { readonly type: "dilemma_choose"; readonly choice: PrisonersDilemmaChoice }
	| { readonly type: "lava_pick_tile"; readonly tileIndex: number }
	| { readonly type: "scramble_submit"; readonly word: string }
	| { readonly type: "toxic_answer"; readonly choiceId: string }
	| { readonly type: "money_tap" }
	| { readonly type: "higher_lower_guess"; readonly guess: "higher" | "lower" }
	| { readonly type: "final_cut_propose"; readonly percentage: number };