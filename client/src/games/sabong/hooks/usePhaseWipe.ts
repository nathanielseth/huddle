import { useRef, useState, useEffect, useCallback } from "react";

type UsePhaseWipeOptions<T> = {
	source: T | undefined;
	onWipe: (swap: () => void) => Promise<void> | void;
};

export function usePhaseWipe<T>({ source, onWipe }: UsePhaseWipeOptions<T>) {
	const [visiblePhase, setVisiblePhase] = useState<T | undefined>(source);

	const visiblePhaseRef = useRef(visiblePhase);
	const isWiping = useRef(false);
	const pendingPhase = useRef<T | null>(null);

	const processWipe = useCallback(
		async (nextPhase: T) => {
			isWiping.current = true;
			try {
				const task = onWipe(() => {
					visiblePhaseRef.current = nextPhase;
					setVisiblePhase(nextPhase);
				});
				if (task instanceof Promise) await task;
			} catch (err) {
				console.error("[usePhaseWipe] Wipe transition failed:", err);
				visiblePhaseRef.current = nextPhase;
				setVisiblePhase(nextPhase);
			} finally {
				isWiping.current = false;
				if (
					pendingPhase.current &&
					pendingPhase.current !== visiblePhaseRef.current
				) {
					const next = pendingPhase.current;
					pendingPhase.current = null;
					processWipe(next);
				} else {
					pendingPhase.current = null;
				}
			}
		},
		[onWipe],
	);

	useEffect(() => {
		const target = source;
		if (!target) return;

		// initial snap
		if (!visiblePhaseRef.current) {
			visiblePhaseRef.current = target;
			setVisiblePhase(target);
			return;
		}

		if (target === visiblePhaseRef.current) return;

		if (isWiping.current) {
			pendingPhase.current = target;
			return;
		}

		processWipe(target);
	}, [source, processWipe]);

	return visiblePhase;
}
