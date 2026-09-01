// armed: primary target committed, waiting for secondary crew slot pick
// store because arm and pick live in different subtrees. separate from pendingInteraction.
import { create } from "zustand";
import type { BoardTarget } from "./boardTargetRegistry";

export interface ArmedMove {
	moveId: string;
	primaryTarget: BoardTarget;
}

type ArmedCompleteHandler = (
	moveId: string,
	primaryTarget: BoardTarget,
	secondaryPick: { slotIndex: number },
) => void;

interface ArmedMoveStore {
	armed: ArmedMove | null;
	onComplete: ArmedCompleteHandler | null;
	arm: (moveId: string, primaryTarget: BoardTarget) => void;
	setOnComplete: (handler: ArmedCompleteHandler | null) => void;
	pickSecondaryTarget: (slotIndex: number) => void;
	disarm: () => void;
}

export const useArmedMoveStore = create<ArmedMoveStore>((set, get) => ({
	armed: null,
	onComplete: null,
	arm: (moveId, primaryTarget) => set({ armed: { moveId, primaryTarget } }),
	setOnComplete: (handler) => set({ onComplete: handler }),
	pickSecondaryTarget: (slotIndex) => {
		const { armed, onComplete } = get();
		if (!armed) return;
		onComplete?.(armed.moveId, armed.primaryTarget, { slotIndex });
		set({ armed: null });
	},
	disarm: () => set({ armed: null }),
}));

export function useArmedMove(): ArmedMove | null {
	return useArmedMoveStore((s) => s.armed);
}