// locks fire-and-forget actions until resetToken changes, an explicit
// rejection signal fires, or timeout — since socket has no per-action ack
// and state sync latency allows double submit.

import { useEffect, useRef, useState } from "react";
import { subscribeToActionRejection } from "./actionRejectionSignal";

const DEFAULT_TIMEOUT_MS = 4_000;

export interface UseActionLockResult {
	locked: boolean;
	runLocked: (fn: () => void) => void;
}

export function useActionLock(
	resetToken: unknown,
	timeoutMs: number = DEFAULT_TIMEOUT_MS,
	onLikelyRejected?: () => void,
	// when true, an "action_rejected" event from the server (see
	// actionRejectionSignal.ts) releases the lock immediately instead of
	// waiting out timeoutMs. Opt-in and defaulted false so existing callers
	// that don't expect a mid-wait release keep their current behavior —
	// only turn this on where runLocked wraps an action that can actually
	// produce a targeted rejection (play_move and friends), not e.g. a
	// generic "end turn" where a stray rejection for something else
	// shouldn't release an unrelated lock.
	releaseOnRejection: boolean = false,
): UseActionLockResult {
	const [locked, setLocked] = useState(false);
	const onLikelyRejectedRef = useRef(onLikelyRejected);

	useEffect(() => {
		onLikelyRejectedRef.current = onLikelyRejected;
	}, [onLikelyRejected]);

	const [prevResetToken, setPrevResetToken] = useState(resetToken);
	if (resetToken !== prevResetToken) {
		setPrevResetToken(resetToken);
		if (locked) setLocked(false);
	}

	useEffect(() => {
		if (!locked) return;
		const timeoutId = setTimeout(() => {
			setLocked(false);
			onLikelyRejectedRef.current?.();
		}, timeoutMs);
		return () => {
			clearTimeout(timeoutId);
		};
	}, [locked, timeoutMs]);

	useEffect(() => {
		if (!locked || !releaseOnRejection) return;
		return subscribeToActionRejection(() => {
			setLocked(false);
			onLikelyRejectedRef.current?.();
		});
	}, [locked, releaseOnRejection]);

	function runLocked(fn: () => void) {
		if (locked) return;
		setLocked(true);
		fn();
	}

	return { locked, runLocked };
}