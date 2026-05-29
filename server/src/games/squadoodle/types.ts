import type {
	SquadoodlePhase,
	ChainEntry,
	ReactionType,
	Accolade,
} from "../../../../shared/squadoodle";

// engine mutates this in place (same pattern as CyberSecs). public-safe fields
// projected into SquadoodleState by buildPublicState(). secret fields (chain
// contents during working phases, per-player tasks) projected into SquadoodleSecret
export interface SquadoodleServerState {
	phase: SquadoodlePhase;

	// current step index. 0 = prompt writing, odd = drawing, even = guessing.
	// N = playerOrder.length
	step: number;

	// player order fixed at onStart. index i is authoritative for routing:
	// at step s, playerOrder[i] works on chains[(i - s + N) % N]
	playerOrder: string[];

	// chains[c] accumulates entries as the game progresses.
	// full chains revealed only in reveal / accolades phases
	chains: ChainEntry[][];

	// playerIds who have submitted for the current step. reset each new step
	submissions: Set<string>;

	// reveal tracking
	revealChainIndex: number;
	revealEntryIndex: number;

	// nested maps: reactions[chainIndex][entryIndex][playerId] = last reaction.
	// last-write-wins so players can change their mind
	reactions: Map<number, Map<number, Map<string, ReactionType>>>;

	accolades: Accolade[];
}