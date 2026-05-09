export type WitzonePhase =
	| "answering"
	| "voting_prompt"
	| "round_end"
	| "final_answering"
	| "final_voting"
	| "finished";

export type WitzoneRound = 1 | 2 | 3;

// Anonymous answer slot shown during voting — no authorId exposed
export interface WitzoneVotingAnswer {
	answerId: string;
	text: string | null; // null = didn't submit
}

// Full attributed reveal — emitted after voting closes on a prompt
export interface WitzonePromptReveal {
	promptId: string;
	promptText: string;
	answers: Array<{
		answerId: string;
		authorId: string;
		text: string | null;
	}>;
	votes: Record<string, number>; // answerId → vote count / token count
	scoreDeltas: Record<string, number>; // authorId → points earned this prompt
	wasJinx: boolean;
	wasDefault: boolean; // true if one player didn't submit
	wittyWinnerId: string | null; // authorId who swept all votes (Witty!)
}

export interface WitzonePlayerView {
	playerId: string;
	score: number;
	hasSubmitted: boolean; // during answering / final_answering
	hasVoted: boolean; // during voting phases
	isAuthorOfCurrentPrompt: boolean; // watching, not voting
}

// Current prompt exposed during voting stage — no author attribution
export interface WitzoneCurrentPrompt {
	promptId: string;
	promptText: string;
	answers: WitzoneVotingAnswer[];
}

export interface WitzoneState {
	phase: WitzonePhase;
	roundNumber: WitzoneRound;
	currentPromptIndex: number;
	totalPromptsThisRound: number;
	promptStage: "voting" | "revealing"; // sub-stage within voting_prompt
	currentPrompt: WitzoneCurrentPrompt | null; // null during revealing
	lastReveal: WitzonePromptReveal | null;
	players: Record<string, WitzonePlayerView>;
	lastRoundResults: WitzonePromptReveal[]; // all reveals from last completed round
	allSubmitted: boolean;
	allVoted: boolean;
}

// Sent privately to each player — their assigned prompts + submitted answers
export interface WitzonePlayerSecret {
	prompts: Array<{ promptId: string; text: string }>;
	answers: Record<string, string>; // promptId → submitted answer text
}

export type WitzoneAction =
	| { type: "submit_answer"; promptId: string; text: string }
	| { type: "cast_vote"; answerId: string } // R1 / R2
	| { type: "cast_final_votes"; votes: Record<string, number> }; // R3 — token split
