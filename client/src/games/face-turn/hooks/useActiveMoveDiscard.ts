import { create } from "zustand";

type ActiveMoveDiscardHandler = (slotIndex: number) => void;

interface ActiveMoveDiscardStore {
	onDiscard: ActiveMoveDiscardHandler | null;
	setOnDiscard: (handler: ActiveMoveDiscardHandler | null) => void;
}

export const useActiveMoveDiscardStore = create<ActiveMoveDiscardStore>(
	(set) => ({
		onDiscard: null,
		setOnDiscard: (handler) => set({ onDiscard: handler }),
	}),
);