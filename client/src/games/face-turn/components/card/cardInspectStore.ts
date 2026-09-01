import { useSyncExternalStore } from "react";
import type { CardProps } from "./Card";

export interface InspectCycle {
	readonly items: readonly CardProps[];
	readonly index: number;
}

let current: InspectCycle | null = null;
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

export function openCardInspect(card: CardProps, cycle?: InspectCycle) {
	current = cycle ? { items: cycle.items, index: cycle.index } : { items: [card], index: 0 };
	emit();
}

export function closeCardInspect() {
	if (current === null) return;
	current = null;
	emit();
}

export function stepCardInspect(delta: 1 | -1) {
	if (current === null) return;
	const nextIndex = current.index + delta;
	if (nextIndex < 0 || nextIndex >= current.items.length) return;
	current = { ...current, index: nextIndex };
	emit();
}

function subscribe(onChange: () => void) {
	listeners.add(onChange);
	return () => listeners.delete(onChange);
}

function getSnapshot() {
	return current;
}

export function useCardInspectState(): InspectCycle | null {
	return useSyncExternalStore(subscribe, getSnapshot);
}
