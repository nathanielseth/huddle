import { useSyncExternalStore } from "react";
import type { CardProps } from "../card/Card";

// single source for hovered card preview, token-based to avoid stale object reference
let current: CardProps | null = null;
let currentToken = 0;
const listeners = new Set<() => void>();

function emit() {
	for (const listener of listeners) listener();
}

export function setCardHoverPreview(card: CardProps | null): number {
	current = card;
	currentToken += 1;
	emit();
	return currentToken;
}

// fast sweeps can fire leave after enter on next, only clear if token still latest
export function clearCardHoverPreview(token: number) {
	if (token !== currentToken) return;
	current = null;
	emit();
}

function subscribe(onChange: () => void) {
	listeners.add(onChange);
	return () => listeners.delete(onChange);
}

function getSnapshot() {
	return current;
}

export function useCardHoverPreview(): CardProps | null {
	return useSyncExternalStore(subscribe, getSnapshot);
}