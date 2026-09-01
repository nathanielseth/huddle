import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "@shared/games/face-turn/log";
import { toAnnouncement, type Announcement } from "../lib/announceEvent";
import { useReducedMotion } from "../../../hooks/a11y/useReducedMotion";

type PlayerLookup = Record<string, { name: string }>;

const DISPLAY_MS = 1500;
const REDUCED_MOTION_DISPLAY_MS = 400;

// caps backlog so reconnecting clients don't replay entire match history one event at a time
const MAX_BACKLOG = 3;

export interface UseMoveAnnouncementsResult {
	// the announcement on screen, or null when none
	readonly current: Announcement | null;
	readonly onExited: () => void;
}

// sources from the log rather than lastEvent so multiple events arriving between renders aren't skipped
export function useMoveAnnouncements(
	log: readonly LogEntry[],
	playerMap: PlayerLookup,
): UseMoveAnnouncementsResult {
	const reducedMotion = useReducedMotion();
	const displayMs = reducedMotion ? REDUCED_MOTION_DISPLAY_MS : DISPLAY_MS;

	const [current, setCurrent] = useState<Announcement | null>(null);
	const queueRef = useRef<Announcement[]>([]);
	const lastSeqRef = useRef<number | null>(null);
	const initializedRef = useRef(false);

	if (!initializedRef.current) {
		// first mount starts tracking from latest seq to avoid replaying history on reconnect
		initializedRef.current = true;
		lastSeqRef.current = log.length > 0 ? log[log.length - 1].seq : null;
	} else {
		const freshEntries =
			lastSeqRef.current === null
				? log
				: log.filter((e) => e.seq > lastSeqRef.current!);

		if (freshEntries.length > 0) {
			lastSeqRef.current = log[log.length - 1].seq;

			const newAnnouncements = freshEntries
				.map((entry) => toAnnouncement(entry, playerMap))
				.filter((a): a is Announcement => a !== null)
				.slice(-MAX_BACKLOG);

			if (newAnnouncements.length > 0) {
				if (current === null && queueRef.current.length === 0) {
					const [first, ...rest] = newAnnouncements;
					queueRef.current = rest;
					setCurrent(first);
				} else {
					queueRef.current = [...queueRef.current, ...newAnnouncements];
				}
			}
		}
	}

	// auto-advance hands off to banner's exit animation so it can animate out before content swaps
	const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (current === null) return;
		advanceTimer.current = setTimeout(() => {
			advance();
		}, displayMs);
		return () => {
			if (advanceTimer.current) clearTimeout(advanceTimer.current);
		};
	}, [current, displayMs]);

	function advance() {
		const next = queueRef.current[0] ?? null;
		queueRef.current = queueRef.current.slice(1);
		setCurrent(next);
	}

	return { current, onExited: advance };
}