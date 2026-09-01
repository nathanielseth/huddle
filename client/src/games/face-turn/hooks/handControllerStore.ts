import { create } from "zustand";
import type { DragPosition } from "./useCardDrag";

// T is the drag-drop target shape for whichever producer currently owns the
// hand: PlayMoveSection's BoardTarget vs MoveChainBar's playerId/"myself"
// string vs HandSandbox's dev-only ZoneId. Defaults to string so existing
// string-based producers need no changes; PlayMoveSection instantiates
// Hand<BoardTarget> explicitly to get real target objects with no
// JSON round-trip at the boundary.
export interface HandController<T = string> {
	getPlayable?: (moveId: string) => boolean;
	selectedId?: string | null;
	armedId?: string | null;
	disabled?: boolean;
	onSelect?: (moveId: string, index: number) => void;
	dragEnabled: boolean;
	getTargetAt?: (point: DragPosition, moveId: string) => T | null;
	isValidTarget?: (candidate: T, moveId: string) => boolean;
	onDrop?: (moveId: string, target: T) => void;
}

interface HandControllerStore {
	// erased at the store boundary: exactly one producer's controller is
	// registered at a time, but the store itself can't know which T is live.
	// PersistentHand narrows back to HandController<BoardTarget> since Hand
	// is only ever rendered there with BoardTarget-typed callbacks.
	controller: HandController<never> | null;
	setHandController: <T>(controller: HandController<T> | null) => void;
}

export const useHandControllerStore = create<HandControllerStore>((set) => ({
	controller: null,
	setHandController: (controller) =>
		set({ controller: controller as HandController<never> | null }),
}));