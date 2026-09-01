import { useEffect, useEffectEvent, useRef, useState } from "react";

// queues scene swaps so a fast server update doesn't cut an exit animation short
export interface UsePhaseSceneQueueResult<T> {
	visible: T;
	onExited: () => void;
}

export function usePhaseSceneQueue<T>(
	source: T,
	keyOf: (value: T) => string,
): UsePhaseSceneQueueResult<T> {
	const [visible, setVisible] = useState<T>(source);
	const visibleRef = useRef<T>(visible);
	const queued = useRef<{ value: T } | null>(null);
	const exiting = useRef(false);

	const handleSourceChange = useEffectEvent((next: T) => {
		if (keyOf(next) === keyOf(visibleRef.current)) {
			queued.current = null;
			return;
		}

		if (exiting.current) {
			queued.current = { value: next };
			return;
		}

		if (visibleRef.current !== null && visibleRef.current !== undefined) {
			exiting.current = true;
		}
		visibleRef.current = next;
		setVisible(next);
	});

	useEffect(() => {
		handleSourceChange(source);
	}, [source]);

	function onExited() {
		exiting.current = false;
		const next = queued.current;
		queued.current = null;
		if (next && keyOf(next.value) !== keyOf(visibleRef.current)) {
			exiting.current = true;
			visibleRef.current = next.value;
			setVisible(next.value);
		}
	}

	return { visible, onExited };
}