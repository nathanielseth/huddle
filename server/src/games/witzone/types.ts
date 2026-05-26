import type {
	WitzonePhase,
	WitzonePromptStage,
	WitzoneReveal,
	WitzoneFinalReveal,
	WitzoneState,
} from "../../../../shared/witzone";

// per-answer slot inside a server prompt
export interface WitzoneAnswerSlot {
	// stable random id used as the answer's identity during voting
	answerId: string;
	authorId: string;
	// null until the player submits
	text: string | null;
}

// server-side prompt (r1 / r2)
export interface WitzoneServerPrompt {
	// 0-based index within the current round's prompt list
	index: number;
	text: string;
	// always exactly 2 slots — one per assigned author
	slots: [WitzoneAnswerSlot, WitzoneAnswerSlot];
	// voterid → answerid, only populated during voting sub-stage
	votes: Map<string, string>;
}

// final round data
export interface WitzoneFinalEntry {
	answerId: string;
	// null until the player submits their final answer
	text: string | null;
}

export interface WitzoneFinalPrompt {
	text: string;
	// playerid → entry, one entry per player, created at round start
	answers: Map<string, WitzoneFinalEntry>;
	// voterid → (answerid → tokens), populated during final_voting
	votes: Map<string, Map<string, number>>;
}

// full server state
export interface WitzoneServerState {
	phase: WitzonePhase;
	round: 1 | 2 | 3;
	// playerid → { id }, populated from room.players on onstart
	players: Map<string, { id: string }>;

	// r1 / r2
	// remaining questions not yet used, spliced as rounds begin
	questionPool: string[];
	prompts: WitzoneServerPrompt[];
	// total answer slots filled so far this round (max = prompts.length × 2)
	submittedSlots: number;
	// playerid → number of answers submitted this round (used to mark hasanswered)
	playerAnswerCount: Map<string, number>;

	// voting
	currentPromptIndex: number;
	promptStage: WitzonePromptStage;
	lastReveal: WitzoneReveal | null;

	// final round
	finalPrompt: WitzoneFinalPrompt | null;
	finalSubmittedCount: number;
	finalVotedCount: number;
	finalReveal: WitzoneFinalReveal | null;

	// public state cache
	_publicStateDirty: boolean;
	_cachedPublicState: WitzoneState | null;
}