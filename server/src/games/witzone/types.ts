import type {
	WitzonePhase,
	WitzonePromptStage,
	WitzoneReveal,
	WitzoneFinalReveal,
	WitzoneState,
} from "../../../../shared/witzone";

export interface WitzoneAnswerSlot {
	// stable random id used as the answer's identity during voting
	answerId: string;
	authorId: string;
	// null until the player submits
	text: string | null;
}

export interface WitzoneServerPrompt {
	index: number;
	text: string;
	slots: [WitzoneAnswerSlot, WitzoneAnswerSlot];
	votes: Map<string, string>;
	eligibleVoterIds: Set<string>;
}

export interface WitzoneFinalEntry {
	answerId: string;
	text: string | null;
}

export interface WitzoneFinalPrompt {
	text: string;
	answers: Map<string, WitzoneFinalEntry>;
	votes: Map<string, Map<string, number>>;
}

export interface WitzoneServerState {
	phase: WitzonePhase;
	round: 1 | 2 | 3;

	playerIds: Set<string>;

	// r1 / r2
	questionPool: string[];
	prompts: WitzoneServerPrompt[];
	submittedSlots: number;
	playerAnswerCount: Map<string, number>;

	// voting
	currentPromptIndex: number;
	promptStage: WitzonePromptStage;
	lastReveal: WitzoneReveal | null;

	// final round
	finalPrompt: WitzoneFinalPrompt | null;
	finalSubmittedCount: number;
	finalReveal: WitzoneFinalReveal | null;

	// public state cache
	_publicStateDirty: boolean;
	_cachedPublicState: WitzoneState | null;
}