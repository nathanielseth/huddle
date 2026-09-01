import { useSyncExternalStore } from "react";
import { targetKey, type BoardTarget } from "./boardTargetRegistry";

type Listener = () => void;

const listeners = new Set<Listener>();
let currentKey: string | null = null;

function emit(): void {
	for (const listener of listeners) listener();
}

export function setDraggedOverTarget(target: BoardTarget | null): void {
	const key = target ? targetKey(target) : null;
	if (currentKey === key) return;
	currentKey = key;
	emit();
}

function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): string | null {
	return currentKey;
}

export function useIsDraggedOverTarget(target: BoardTarget): boolean {
	const key = useSyncExternalStore(subscribe, getSnapshot);
	return key !== null && key === targetKey(target);
}