import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let currentMoveId: string | null = null;

function emit(): void {
	for (const listener of listeners) listener();
}

export function setDraggedMove(moveId: string | null): void {
	if (currentMoveId === moveId) return;
	currentMoveId = moveId;
	emit();
}

function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): string | null {
	return currentMoveId;
}

export function useDraggedMoveId(): string | null {
	return useSyncExternalStore(subscribe, getSnapshot);
}