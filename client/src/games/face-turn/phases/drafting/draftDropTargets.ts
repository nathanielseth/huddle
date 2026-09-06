import { useEffect, useRef, useSyncExternalStore } from "react";

export type DraftDropKind = "boss" | "crew" | "move";

interface Point {
	x: number;
	y: number;
}

// scoped draft drop registry, only three kinds.
class DraftDropTargetRegistry {
	private els = new Map<DraftDropKind, Set<HTMLElement>>();

	register(kind: DraftDropKind, el: HTMLElement): () => void {
		let set = this.els.get(kind);
		if (!set) {
			set = new Set();
			this.els.set(kind, set);
		}
		set.add(el);
		return () => {
			set.delete(el);
			if (set.size === 0) this.els.delete(kind);
		};
	}

	getTargetAt(point: Point): DraftDropKind | null {
		for (const [kind, set] of this.els) {
			for (const el of set) {
				const rect = el.getBoundingClientRect();
				if (
					point.x >= rect.left &&
					point.x <= rect.right &&
					point.y >= rect.top &&
					point.y <= rect.bottom
				) {
					return kind;
				}
			}
		}
		return null;
	}
}

export const draftDropTargetRegistry = new DraftDropTargetRegistry();

export function useDraftDropTarget(
	kind: DraftDropKind,
): (el: HTMLElement | null) => void {
	const elRef = useRef<HTMLElement | null>(null);
	const unregisterRef = useRef<(() => void) | null>(null);

	function setRef(el: HTMLElement | null) {
		elRef.current = el;
	}

	useEffect(() => {
		unregisterRef.current?.();
		unregisterRef.current = elRef.current
			? draftDropTargetRegistry.register(kind, elRef.current)
			: null;
		return () => {
			unregisterRef.current?.();
			unregisterRef.current = null;
		};
	}, [kind]);

	return setRef;
}

// broadcasts current draft drag target.
const listeners = new Set<() => void>();
let currentTarget: DraftDropKind | null = null;

function emit(): void {
	for (const listener of listeners) listener();
}

export function setDraftDraggedOverTarget(target: DraftDropKind | null): void {
	if (currentTarget === target) return;
	currentTarget = target;
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getSnapshot(): DraftDropKind | null {
	return currentTarget;
}

export function useIsDraftDraggedOverTarget(kind: DraftDropKind): boolean {
	const target = useSyncExternalStore(subscribe, getSnapshot);
	return target === kind;
}