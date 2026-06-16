// phase types
export type WitzonePhase =
	| "answering"
	| "voting_prompt"
	| "round_end"
	| "final_answering"
	| "final_voting"
	| "finished";

export type WitzonePromptStage = "voting" | "revealing";

// public answer / prompt
export interface WitzonePublicAnswer {
	id: string;
	text: string;
}

// present during voting sub-stage only. answers are anonymous (no author info in text)
export interface WitzonePublicPrompt {
	text: string;
	// two answers, sorted by ID for stable order across rebuilds
	answers: WitzonePublicAnswer[];
	// IDs of the two authors — so the client can show "you wrote one of these"
	authorIds: string[];
	votedCount: number;
	eligibleVoterCount: number;
}

// reveal types
export interface WitzoneRevealAnswer {
	id: string;
	text: string | null; // null for DEFAULT (player didn't submit)
	authorId: string;
	voteCount: number;
	scoreDelta: number;
}

export interface WitzoneReveal {
	promptText: string;
	answers: WitzoneRevealAnswer[];
	wasJinx: boolean;
	wasDefault: boolean;
	wittyWinnerId: string | null;
}

export interface WitzoneFinalRevealAnswer {
	id: string;
	text: string;
	authorId: string;
	tokenCount: number;
	scoreDelta: number;
}

export interface WitzoneFinalReveal {
	promptText: string;
	answers: WitzoneFinalRevealAnswer[]; // sorted by tokenCount desc
}

// player view
export interface WitzonePlayerView {
	id: string;
	score: number;
	// true when the player has submitted all required answers for the current phase
	hasAnswered: boolean;
	// true when the player has cast their vote(s) for the current voting phase
	hasVoted: boolean;
}

// public game state (sent to all clients via game_state)
export interface WitzoneState {
	phase: WitzonePhase;
	round: 1 | 2 | 3;
	players: Record<string, WitzonePlayerView>;

	// answering / final_answering progress
	answeredCount: number; // players who have submitted ALL their required answers
	totalPlayers: number;

	// voting (voting_prompt phase)
	currentPromptIndex: number;
	totalPromptsThisRound: number;
	promptStage: WitzonePromptStage;
	// non-null only during voting sub-stage
	currentPrompt: WitzonePublicPrompt | null;
	// non-null during revealing sub-stage (and persists until next prompt)
	lastReveal: WitzoneReveal | null;

	// final answering
	finalPromptText: string | null;

	// final voting
	// anonymous answers shown during final_voting. sorted by ID for stability
	finalAnswers: WitzonePublicAnswer[] | null;
	finalVotedCount: number;

	// finished
	finalReveal: WitzoneFinalReveal | null;
}

// player secret (sent privately via player_secret)
export interface WitzoneAssignedPrompt {
	promptIndex: number;
	text: string;
	submitted: boolean;
	answer: string | null;
}

export interface WitzonePlayerSecret {
	// R1 / R2: the player's 2 assigned prompts. empty during final round
	assignedPrompts: WitzoneAssignedPrompt[];
	// final round: the shared prompt text
	finalPrompt: string | null;
	// final voting: which answerId is the player's own (to disable self-vote)
	finalAnswerId: string | null;
}

// actions
export type WitzoneAction =
	| { type: "submit_answer"; promptIndex: number; text: string }
	| { type: "cast_vote"; answerId: string }
	| { type: "cast_final_votes"; votes: Record<string, number> };