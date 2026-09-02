import { create } from "zustand";
import type { DragPosition } from "./useCardDrag";

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
	controller: HandController<never> | null;
	setHandController: <T>(controller: HandController<T> | null) => void;
}

export const useHandControllerStore = create<HandControllerStore>((set) => ({
	controller: null,
	setHandController: (controller) =>
		set({ controller: controller as HandController<never> | null }),
}));