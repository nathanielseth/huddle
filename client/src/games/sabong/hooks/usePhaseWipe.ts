import {
	useRef,
	useState,
	useEffect,
	useLayoutEffect,
	useCallback,
} from "react";

type UsePhaseWipeOptions<T> = {
	source: T | undefined;
	onWipe: (swap: () => void) => Promise<void> | void;
};

export function usePhaseWipe<T>({ source, onWipe }: UsePhaseWipeOptions<T>) {
	const [visiblePhase, setVisiblePhase] = useState<T | undefined>(source);

	const visiblePhaseRef = useRef(visiblePhase);
	const isWiping = useRef(false);
	const pendingPhase = useRef<T | null>(null);
	const processWipeRef = useRef<((next: T) => Promise<void>) | null>(null);

	const onWipeRef = useRef(onWipe);
	useLayoutEffect(() => {
		onWipeRef.current = onWipe;
	});

	const swap = useCallback((next: T) => {
		visiblePhaseRef.current = next;
		setVisiblePhase(next);
	}, []);

	const processWipe = useCallback(
		async (next: T) => {
			isWiping.current = true;
			try {
				const task = onWipeRef.current(() => swap(next));
				if (task instanceof Promise) await task;
			} catch (err) {
				console.error("[usePhaseWipe] transition failed:", err);
				swap(next);
			} finally {
				isWiping.current = false;
				const queued = pendingPhase.current;
				pendingPhase.current = null;
				if (queued !== null && queued !== visiblePhaseRef.current) {
					processWipeRef.current?.(queued);
				}
			}
		},
		[swap],
	);

	useLayoutEffect(() => {
		processWipeRef.current = processWipe;
	});

	useEffect(() => {
		if (!source) return;
		if (!visiblePhaseRef.current) {
			swap(source);
			return;
		}
		if (source === visiblePhaseRef.current) return;
		if (isWiping.current) {
			pendingPhase.current = source;
			return;
		}
		processWipe(source);
	}, [source, processWipe, swap]);

	return visiblePhase;
}
