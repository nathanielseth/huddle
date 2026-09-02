import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "@shared/games/face-turn/log";
import { useReducedMotion } from "../../../hooks/a11y/useReducedMotion";

const DISPLAY_MS = 2000;
const REDUCED_MOTION_DISPLAY_MS = 400;

export interface MovePlayFlash {
	readonly id: string;
	readonly moveId: string;
	readonly actorId: string;
	readonly targetPlayerId: string | null;
}

export interface UseMovePlayFlashResult {
	readonly current: MovePlayFlash | null;
}

function toFlash(
	entry: Extract<LogEntry, { kind: "move_played" }>,
): MovePlayFlash {
	return {
		id: `move-flash-${entry.seq}`,
		moveId: entry.moveId,
		actorId: entry.actorId,
		targetPlayerId: entry.targetPlayerId,
	};
}

// rail flash for move_played, sourced from log so rapid plays aren't skipped.
// newest wins: a new play replaces the current one immediately.
export function useMovePlayFlash(
	log: readonly LogEntry[],
): UseMovePlayFlashResult {
	const reducedMotion = useReducedMotion();
	const displayMs = reducedMotion ? REDUCED_MOTION_DISPLAY_MS : DISPLAY_MS;

	const [current, setCurrent] = useState<MovePlayFlash | null>(null);
	// state so render-time log comparison is safe, not a ref
	const [seenLog, setSeenLog] = useState<readonly LogEntry[] | null>(null);

	if (seenLog !== log) {
		const lastSeenSeq =
			seenLog && seenLog.length > 0 ? seenLog[seenLog.length - 1].seq : null;
		setSeenLog(log);

		// first render: start tracking, don't replay history
		if (seenLog !== null) {
			const freshEntries =
				lastSeenSeq === null ? log : log.filter((e) => e.seq > lastSeenSeq);
			const newFlashes = freshEntries.filter(
				(e): e is Extract<LogEntry, { kind: "move_played" }> =>
					e.kind === "move_played",
			);
			const latest = newFlashes[newFlashes.length - 1];
			if (latest) {
				setCurrent(toFlash(latest));
			}
		}
	}

	// re-arms on every new current so each gets its full window
	const displayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (current === null) return;
		const id = current.id;
		displayTimer.current = setTimeout(() => {
			// only clear if this timer's flash still showing
			setCurrent((prev) => (prev?.id === id ? null : prev));
		}, displayMs);
		return () => {
			if (displayTimer.current) clearTimeout(displayTimer.current);
		};
	}, [current, displayMs]);

	return { current };
}