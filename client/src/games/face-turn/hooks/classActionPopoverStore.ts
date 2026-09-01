import { create } from "zustand";

// opened by clicking one of your own face-down crew during your turn;
// offers Collect/Strike/Hide (whichever are legal) anchored to that card
interface ClassActionPopoverStore {
	openForSlotIndex: number | null;
	anchorEl: HTMLElement | null;
	open: (slotIndex: number, anchorEl: HTMLElement) => void;
	close: () => void;
	toggle: (slotIndex: number, anchorEl: HTMLElement) => void;
}

export const useClassActionPopoverStore = create<ClassActionPopoverStore>(
	(set, get) => ({
		openForSlotIndex: null,
		anchorEl: null,
		open: (slotIndex, anchorEl) =>
			set({ openForSlotIndex: slotIndex, anchorEl }),
		close: () => set({ openForSlotIndex: null, anchorEl: null }),
		toggle: (slotIndex, anchorEl) => {
			const { openForSlotIndex } = get();
			if (openForSlotIndex === slotIndex) {
				set({ openForSlotIndex: null, anchorEl: null });
			} else {
				set({ openForSlotIndex: slotIndex, anchorEl });
			}
		},
	}),
);
