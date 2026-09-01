import type { FaceturnServerState } from "./types";
import type { LogEntry } from "../../../../shared/games/face-turn/log";

// caps payload growth over a long game. evicting the oldest entries is
// fine — a match log this deep into a game is a scrollback, not a
// win-condition input, and nothing server-side ever reads state.log back
// to make a decision.
const MAX_LOG_ENTRIES = 200;

// Omit<LogEntry, "seq"> doesn't distribute over the union the way we want
// (TS computes it against the merged property set, dropping the
// discriminant-specific fields), so this maps Omit over each member
// individually — the standard fix for "picking/omitting over a union".
type LogEntryInput = LogEntry extends infer E
	? E extends { seq: number }
		? Omit<E, "seq">
		: never
	: never;

// appends one entry to the match log, assigning it the next sequence
// number. this is the only place that writes to state.log/_nextLogSeq —
// call sites never construct the seq themselves, so there's exactly one
// spot that can get the monotonic-and-never-reused invariant wrong.
export function pushLog(state: FaceturnServerState, entry: LogEntryInput): void {
	state.log.push({ ...entry, seq: state._nextLogSeq });
	state._nextLogSeq++;
	if (state.log.length > MAX_LOG_ENTRIES) {
		state.log.splice(0, state.log.length - MAX_LOG_ENTRIES);
	}
	// same invalidation markDirty() does — duplicated here rather than
	// imported to avoid a game.ts <-> log.ts import cycle, since markDirty
	// itself is a one-line field flip with no other logic to drift from.
	state._publicStateCacheValid = false;
}
