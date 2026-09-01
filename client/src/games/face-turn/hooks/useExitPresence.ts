import { useEffect, useRef, useState } from "react";

const EXIT_FALLBACK_MS = 400;

interface Rendered<T> {
	key: string;
	value: T;
	exiting: boolean;
}

interface PresenceEntry<T> {
	key: string;
	value: T;
	isExiting: boolean;
	panelRef: (node: HTMLElement | null) => void;
}

export function useExitPresence<T>(
	value: T,
	keyOf: (value: T) => string,
	onExited: () => void,
	watchProperty: string = "opacity",
): { list: readonly PresenceEntry<T>[] } {
	const nextKey = value === null || value === undefined ? null : keyOf(value);

	const [entries, setEntries] = useState<Rendered<T>[]>(() =>
		nextKey === null ? [] : [{ key: nextKey, value, exiting: false }],
	);

	const syncedKeyRef = useRef(nextKey);
	if (syncedKeyRef.current !== nextKey) {
		syncedKeyRef.current = nextKey;
		setEntries((prev) => {
			const exitingPrev = prev.map((entry) =>
				entry.exiting ? entry : { ...entry, exiting: true },
			);
			if (nextKey === null) return exitingPrev;
			return [...exitingPrev, { key: nextKey, value, exiting: false }];
		});
	}

	const onExitedRef = useRef(onExited);
	useEffect(() => {
		onExitedRef.current = onExited;
	}, [onExited]);

	const elementsRef = useRef<Map<string, HTMLElement> | null>(null);
	elementsRef.current ??= new Map();

	function makePanelRef(key: string) {
		return (node: HTMLElement | null) => {
			if (node) elementsRef.current?.set(key, node);
			else elementsRef.current?.delete(key);
		};
	}

	const exitingKeys = entries.reduce<string[]>((keys, entry) => {
		if (entry.exiting) keys.push(entry.key);
		return keys;
	}, []).join(",");

	useEffect(() => {
		if (!exitingKeys) return;

		const keys = exitingKeys.split(",");
		const cleanups: (() => void)[] = [];

		for (const key of keys) {
			const el = elementsRef.current?.get(key);
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				elementsRef.current?.delete(key);
				setEntries((prev) => prev.filter((entry) => entry.key !== key));
				onExitedRef.current();
			};

			const fallback = setTimeout(finish, EXIT_FALLBACK_MS);
			const onEnd = (e: TransitionEvent) => {
				if (e.target !== el || e.propertyName !== watchProperty) return;
				clearTimeout(fallback);
				finish();
			};

			el?.addEventListener("transitionend", onEnd);
			cleanups.push(() => {
				el?.removeEventListener("transitionend", onEnd);
				clearTimeout(fallback);
			});
		}

		return () => {
			cleanups.forEach((cleanup) => cleanup());
		};
	}, [exitingKeys, watchProperty]);

	const list = entries.map((entry) => ({
		key: entry.key,
		value: entry.value,
		isExiting: entry.exiting,
		panelRef: makePanelRef(entry.key),
	}));

	return { list };
}