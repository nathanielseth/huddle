import type {
	DeathvaultPhase,
	MinigameId,
	PlayerStatus,
	PrisonersDilemmaChoice,
	DeathvaultQuestionResult,
	PrisonersDilemmaOutcome,
	FloorIsLavaOutcome,
	WordScrambleOutcome,
	ToxicTriviaOutcome,
	MoneyGrabOutcome,
	HigherLowerOutcome,
	FinalCutOutcome,
} from "../../../../shared/games/deathvault/index";

export interface DeathvaultServerQuestion {
	readonly id: string;
	readonly category: string;
	readonly difficulty: 1 | 2 | 3;
	readonly prompt: string;
	readonly choices: ReadonlyArray<{ id: string; text: string }>;
	readonly correctChoiceId: string;
}

export interface DeathvaultServerPlayer {
	readonly playerId: string;
	cash: number;
	status: PlayerStatus;
	wager: number | null;
	answer: string | null;
	lastDelta: number | null;
}

export interface PrisonersDilemmaServerState {
	readonly id: "prisoners_dilemma";
	readonly playerA: string;
	readonly playerB: string;
	readonly prizePool: number;
	choiceA: PrisonersDilemmaChoice | null;
	choiceB: PrisonersDilemmaChoice | null;
	settled: boolean;
	resolvedOutcome: PrisonersDilemmaOutcome | null;
}

export interface FloorIsLavaServerState {
	readonly id: "floor_is_lava";
	readonly tileCount: number;
	readonly eligiblePlayerIds: readonly string[];
	readonly lethalTiles: readonly number[];
	wave: number;
	readonly burnPerWave: number;
	burnedTiles: number[];
	positions: Map<string, number>;
	survivors: string[];
	readonly prizePool: number;
	settled: boolean;
	resolvedOutcome: FloorIsLavaOutcome | null;
}

export interface WordScrambleServerState {
	readonly id: "word_scramble";
	readonly answer: string;
	readonly scrambled: string;
	readonly prizePool: number;
	submissions: Map<string, string>;
	settled: boolean;
	resolvedOutcome: WordScrambleOutcome | null;
}

export interface ToxicTriviaServerState {
	readonly id: "toxic_trivia";
	readonly question: DeathvaultServerQuestion;
	readonly passOrder: string[];
	currentHolderIndex: number;
	readonly prizePool: number;
	settled: boolean;
	resolvedOutcome: ToxicTriviaOutcome | null;
}

export interface MoneyGrabServerState {
	readonly id: "money_grab";
	readonly durationMs: number;
	readonly prizePool: number;
	tapCounts: Map<string, number>;
	settled: boolean;
	resolvedOutcome: MoneyGrabOutcome | null;
}

export interface HigherLowerServerState {
	readonly id: "higher_lower";
	readonly prizePool: number;
	readonly sequence: readonly number[];
	revealedCount: number;
	streak: number;
	readonly activePlayerId: string;
	settled: boolean;
	resolvedOutcome: HigherLowerOutcome | null;
}

export interface FinalCutServerState {
	readonly id: "final_cut";
	readonly prizePool: number;
	proposals: Map<string, number>;
	settled: boolean;
	resolvedOutcome: FinalCutOutcome | null;
}

export type MinigameServerState =
	| PrisonersDilemmaServerState
	| FloorIsLavaServerState
	| WordScrambleServerState
	| ToxicTriviaServerState
	| MoneyGrabServerState
	| HigherLowerServerState
	| FinalCutServerState;

export interface DeathvaultServerState {
	phase: DeathvaultPhase;
	round: number;
	readonly totalRounds: number;
	questionQueue: DeathvaultServerQuestion[];
	currentQuestion: DeathvaultServerQuestion | null;
	questionResult: DeathvaultQuestionResult | null;
	players: Map<string, DeathvaultServerPlayer>;
	minigame: MinigameServerState | null;
	usedMinigameIds: MinigameId[];
	cashHistory: Array<Readonly<Record<string, number>>>;
	roundResults: DeathvaultQuestionResult[];
}

export type DeathvaultParsedAction =
	| { type: "place_wager"; amount: number }
	| { type: "submit_answer"; choiceId: string }
	| { type: "dilemma_choose"; choice: PrisonersDilemmaChoice }
	| { type: "lava_pick_tile"; tileIndex: number }
	| { type: "scramble_submit"; word: string }
	| { type: "toxic_answer"; choiceId: string }
	| { type: "money_tap" }
	| { type: "higher_lower_guess"; guess: "higher" | "lower" }
	| { type: "final_cut_propose"; percentage: number };