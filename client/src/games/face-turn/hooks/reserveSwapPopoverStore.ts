import { create } from "zustand";

// opened by clicking one of your own face-up crew during your turn;
// offers your reserved Crew (face-down) to swap in, anchored to that card
interface ReserveSwapPopoverStore {
	openForSlotIndex: number | null;
	anchorEl: HTMLElement | null;
	open: (slotIndex: number, anchorEl: HTMLElement) => void;
	close: () => void;
	toggle: (slotIndex: number, anchorEl: HTMLElement) => void;
}

export const useReserveSwapPopoverStore = create<ReserveSwapPopoverStore>(
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