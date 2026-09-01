import type { DragPosition } from "./useCardDrag";

export interface DragPositionStore {
	getPosition: () => DragPosition | null;
	setPosition: (position: DragPosition | null) => void;
	subscribe: (onChange: () => void) => () => void;
}

export function createDragPositionStore(): DragPositionStore {
	let position: DragPosition | null = null;
	const listeners = new Set<() => void>();

	return {
		getPosition: () => position,
		setPosition: (next) => {
			position = next;
			for (const listener of listeners) listener();
		},
		subscribe: (onChange) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
	};
}