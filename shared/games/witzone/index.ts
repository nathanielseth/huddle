export type WitzonePhase =
	| "answering"
	| "voting_prompt"
	| "round_end"
	| "final_answering"
	| "final_voting"
	| "finished";

export type WitzonePromptStage = "voting" | "revealing";

export interface WitzonePublicAnswer {
	id: string;
	text: string;
}

export interface WitzonePublicPrompt {
	text: string;
	answers: WitzonePublicAnswer[];
	authorIds: string[];
	votedCount: number;
	eligibleVoterCount: number;
}

export interface WitzoneRevealAnswer {
	id: string;
	text: string | null;
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
	answers: WitzoneFinalRevealAnswer[];
}

export interface WitzonePlayerView {
	id: string;
	score: number;
	hasAnswered: boolean;
	hasVoted: boolean;
}

export interface WitzoneState {
	phase: WitzonePhase;
	round: 1 | 2 | 3;
	players: Record<string, WitzonePlayerView>;

	answeredCount: number;
	totalPlayers: number;

	currentPromptIndex: number;
	totalPromptsThisRound: number;
	promptStage: WitzonePromptStage;
	// non-null only during voting sub-stage
	currentPrompt: WitzonePublicPrompt | null;
	// non-null during revealing sub-stage, persists until the next prompt
	lastReveal: WitzoneReveal | null;

	finalPromptText: string | null;

	// anonymous answers shown during final_voting
	finalAnswers: WitzonePublicAnswer[] | null;
	finalVotedCount: number;

	finalReveal: WitzoneFinalReveal | null;
}

export interface WitzoneAssignedPrompt {
	promptIndex: number;
	text: string;
	submitted: boolean;
	answer: string | null;
}

export interface WitzonePlayerSecret {
	// rounds 1 and 2: the player's 2 assigned prompts. empty during final round
	assignedPrompts: WitzoneAssignedPrompt[];
	// final round: the shared prompt text
	finalPrompt: string | null;
	// final voting: which answerId is the player's own (to disable self-vote)
	finalAnswerId: string | null;
}

export type WitzoneAction =
	| { type: "submit_answer"; promptIndex: number; text: string }
	| { type: "cast_vote"; answerId: string }
	| { type: "cast_final_votes"; votes: Record<string, number> };