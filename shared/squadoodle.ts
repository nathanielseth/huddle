export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;

// single pointer sample captured during drawing. coordinates in logical canvas
// units. client feeds these into perfect-freehand's getStroke(); other clients
// re-run the same call to reproduce the stroke at any scale
export interface InputPoint {
	readonly x: number;
	readonly y: number;
	readonly pressure: number; // 0..1
}

// one continuous stroke — pointer-down through pointer-up. storing input points
// (not rendered SVG) keeps payloads small and lets every client re-render at
// native resolution
export interface Stroke {
	readonly points: readonly InputPoint[];
	readonly color: string; // CSS color
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
	| "prompt_writing" // everyone writes their starting prompt
	| "drawing" // everyone draws in parallel
	| "guessing" // everyone guesses in parallel
	| "reveal" // TV animates chains; phones show reaction buttons
	| "accolades"; // trophy screen

// broadcast to every socket in the room
export interface SquadoodleState {
	readonly phase: SquadoodlePhase;

	// step counter. 0 = prompt writing, 1..playerCount-1 = alternating draw/guess
	readonly step: number;
	readonly totalSteps: number;

	// fixed player order established at game start
	readonly playerOrder: readonly string[];

	// progress indicator for the current work step
	readonly submittedCount: number;
	readonly totalCount: number;

	// reveal state
	readonly revealChainIndex: number;
	readonly revealEntryIndex: number;
	// full chain data — populated only in reveal and accolades phases.
	// future entries are in the payload but UI shouldn't render them yet
	readonly chains: readonly (readonly ChainEntry[])[];

	// reactions[chainIndex][entryIndex] — always present (zeros before any reactions)
	readonly reactions: readonly (readonly ReactionTally[])[];

	readonly accolades: readonly Accolade[];
}

// what the player should be doing right now on their phone.
// the phone renders exactly one task at a time — no menu, no navigation
export type PlayerTask =
	| { readonly type: "write_prompt" }
	| { readonly type: "draw"; readonly basedOn: string } // text to draw
	| { readonly type: "guess"; readonly strokes: readonly Stroke[] } // drawing to caption
	| { readonly type: "wait" } // submitted, waiting for others
	| { readonly type: "react" }; // reveal/accolades phase — show emoji buttons

// delivered per-player via player_secret
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
			// player taps a reaction emoji during reveal.
			// sending again overwrites the previous reaction (last-write wins)
			readonly type: "react";
			readonly chainIndex: number;
			readonly entryIndex: number;
			readonly reaction: ReactionType;
	  }
	| {
			// host (TV) advances to next reveal entry/chain.
			// server resets the auto-advance timer on receipt
			readonly type: "next_reveal";
	  }
	| {
			// host requests a new game in the same room.
			// transitions room back to lobby (roomPhase: "ended")
			readonly type: "play_again";
	  };