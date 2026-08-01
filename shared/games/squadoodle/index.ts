export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

export interface InputPoint {
	readonly x: number;
	readonly y: number;
	readonly pressure: number; // 0..1
}

export interface Stroke {
	readonly points: readonly InputPoint[];
	readonly color: string;
	readonly size: number; // brush size in logical px
}

export interface PromptEntry {
	readonly type: "prompt";
	readonly authorId: string;
	readonly text: string;
}

export interface DrawingEntry {
	readonly type: "drawing";
	readonly authorId: string;
	readonly strokes: readonly Stroke[];
}

export interface GuessEntry {
	readonly type: "guess";
	readonly authorId: string;
	readonly text: string;
}

export type ChainEntry = PromptEntry | DrawingEntry | GuessEntry;

export type ReactionType = "fire" | "laugh" | "heart" | "trash";

export interface ReactionTally {
	readonly fire: number;
	readonly laugh: number;
	readonly heart: number;
	readonly trash: number;
}

export type AccoladeKind =
	| "most_hearted_drawing"
	| "funniest_guess"
	| "most_chaotic_chain"
	| "most_trashed_drawing";

export interface Accolade {
	readonly kind: AccoladeKind;
	readonly chainIndex: number;
	readonly entryIndex: number | null; // null for chain-level accolades
	readonly authorId: string;
}

export type SquadoodlePhase =
	| "prompt_writing"
	| "drawing"
	| "guessing"
	| "reveal"
	| "accolades";

export interface SquadoodleState {
	readonly phase: SquadoodlePhase;

	readonly step: number;
	readonly totalSteps: number;

	readonly playerOrder: readonly string[];

	readonly submittedCount: number;
	readonly totalCount: number;

	readonly revealChainIndex: number;
	readonly revealEntryIndex: number;
	readonly chains: readonly (readonly ChainEntry[])[];

	readonly reactions: readonly (readonly ReactionTally[])[];

	readonly accolades: readonly Accolade[];
}

export type PlayerTask =
	| { readonly type: "write_prompt" }
	| { readonly type: "draw"; readonly basedOn: string }
	| { readonly type: "guess"; readonly strokes: readonly Stroke[] }
	| { readonly type: "wait" }
	| { readonly type: "react" };

export interface SquadoodleSecret {
	readonly task: PlayerTask;
}

export type SquadoodleAction =
	| {
			readonly type: "submit_prompt";
			readonly text: string;
	  }
	| {
			readonly type: "submit_drawing";
			readonly strokes: readonly Stroke[];
	  }
	| {
			readonly type: "submit_guess";
			readonly text: string;
	  }
	| {
			readonly type: "react";
			readonly chainIndex: number;
			readonly entryIndex: number;
			readonly reaction: ReactionType;
	  }
	| {
			readonly type: "next_reveal";
	  }
	| {
			readonly type: "play_again";
	  };