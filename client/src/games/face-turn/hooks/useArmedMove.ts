// armed: primary target committed, waiting for secondary crew slot pick
// store because arm and pick live in different subtrees. separate from pendingInteraction.
import { create } from "zustand";
import type { BoardTarget } from "./boardTargetRegistry";

export interface ArmedMove {
	moveId: string;
	primaryTarget: BoardTarget;
}

export interface SecondaryPick {
	playerId: string;
	slotIndex: number;
}

type ArmedCompleteHandler = (
	moveId: string,
	primaryTarget: BoardTarget,
	secondaryPick: SecondaryPick,
) => void;

interface ArmedMoveStore {
	armed: ArmedMove | null;
	onComplete: ArmedCompleteHandler | null;
	arm: (moveId: string, primaryTarget: BoardTarget) => void;
	setOnComplete: (handler: ArmedCompleteHandler | null) => void;
	pickSecondaryTarget: (target: SecondaryPick) => void;
	disarm: () => void;
}

export const useArmedMoveStore = create<ArmedMoveStore>((set, get) => ({
	armed: null,
	onComplete: null,
	arm: (moveId, primaryTarget) => set({ armed: { moveId, primaryTarget } }),
	setOnComplete: (handler) => set({ onComplete: handler }),
	pickSecondaryTarget: (target) => {
		const { armed, onComplete } = get();
		if (!armed) return;
		onComplete?.(armed.moveId, armed.primaryTarget, target);
		set({ armed: null });
	},
	disarm: () => set({ armed: null }),
}));

export function useArmedMove(): ArmedMove | null {
	return useArmedMoveStore((s) => s.armed);
}