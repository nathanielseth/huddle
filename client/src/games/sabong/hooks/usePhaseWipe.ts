import { useRef, useState, useLayoutEffect, useEffect } from "react";
import type { RefObject, Dispatch, SetStateAction } from "react";

type UsePhaseWipeOptions<T> = {
	source: T | undefined;
	onWipe: (swap: () => void) => Promise<void> | void;
};

function swap<T>(
	next: T,
	visiblePhaseRef: RefObject<T | undefined>,
	setVisiblePhase: Dispatch<SetStateAction<T | undefined>>,
): void {
	visiblePhaseRef.current = next;
	setVisiblePhase(next);
}

function processWipe<T>(
	next: T,
	isWiping: RefObject<boolean>,
	pendingPhase: RefObject<T | null>,
	visiblePhaseRef: RefObject<T | undefined>,
	processWipeRef: RefObject<((n: T) => void) | null>,
	onWipeRef: RefObject<(swap: () => void) => Promise<void> | void>,
	setVisiblePhase: Dispatch<SetStateAction<T | undefined>>,
): void {
	isWiping.current = true;
	const task = onWipeRef.current(() => {
		swap(next, visiblePhaseRef, setVisiblePhase);
	});
	const finish = (): void => {
		isWiping.current = false;
		const queued = pendingPhase.current;
		pendingPhase.current = null;
		if (queued !== null && queued !== visiblePhaseRef.current) {
			processWipeRef.current?.(queued);
		}
	};
	if (task instanceof Promise) {
		void task
			.catch(() => {
				swap(next, visiblePhaseRef, setVisiblePhase);
			})
			.then(finish);
	} else {
		finish();
	}
}

export function usePhaseWipe<T>({ source, onWipe }: UsePhaseWipeOptions<T>) {
	const [visiblePhase, setVisiblePhase] = useState<T | undefined>(source);
	const visiblePhaseRef = useRef<T | undefined>(visiblePhase);
	const isWiping = useRef<boolean>(false);
	const pendingPhase = useRef<T | null>(null);
	const processWipeRef = useRef<((next: T) => void) | null>(null);
	const onWipeRef = useRef<(swap: () => void) => Promise<void> | void>(onWipe);

	useLayoutEffect(() => {
		onWipeRef.current = onWipe;
	});

	useLayoutEffect(() => {
		processWipeRef.current = (next: T): void => {
			processWipe(
				next,
				isWiping,
				pendingPhase,
				visiblePhaseRef,
				processWipeRef,
				onWipeRef,
				setVisiblePhase,
			);
		};
	});

	useEffect(() => {
		if (!source) return;
		if (!visiblePhaseRef.current) {
			swap(source, visiblePhaseRef, setVisiblePhase);
			return;
		}
		if (source === visiblePhaseRef.current) return;
		if (isWiping.current) {
			pendingPhase.current = source;
			return;
		}
		processWipeRef.current?.(source);
	}, [source]);

	return visiblePhase;
}