import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let dragging = false;

function emit(): void {
	for (const listener of listeners) listener();
}

// separate from draggedMoveStore: active-move drags are discard-only, never play targets
export function setActiveMoveDragging(next: boolean): void {
	if (dragging === next) return;
	dragging = next;
	emit();
}

function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): boolean {
	return dragging;
}

export function useIsActiveMoveDragging(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot);
}