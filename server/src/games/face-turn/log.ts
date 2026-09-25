import type { FaceturnServerState } from "./types";
import type { LogEntry } from "../../../../shared/games/face-turn/log";

// caps payload growth over a long game, evicting oldest entries is fine since the log is scrollback, not a win-condition input
const MAX_LOG_ENTRIES = 200;

// Omit<LogEntry, "seq"> doesn't distribute over the union as wanted (TS merges the property set first)
// so this maps Omit over each member individually, the standard fix for picking/omitting over a union
type LogEntryInput = LogEntry extends infer E
	? E extends { seq: number }
		? Omit<E, "seq">
		: never
	: never;

// appends one entry to the log with the next sequence number, the only place that writes state.log/_nextLogSeq
// so call sites never construct seq themselves and can't get the monotonic invariant wrong
export function pushLog(state: FaceturnServerState, entry: LogEntryInput): void {
	state.log.push({ ...entry, seq: state._nextLogSeq });
	state._nextLogSeq++;
	if (state.log.length > MAX_LOG_ENTRIES) {
		state.log.splice(0, state.log.length - MAX_LOG_ENTRIES);
	}
	// same invalidation markDirty() does, duplicated here to avoid a game.ts <-> log.ts import cycle
	state._publicStateCacheValid = false;
}
