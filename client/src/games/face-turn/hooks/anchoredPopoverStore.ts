import { create } from "zustand";

// a popover anchored to one board element at a time, identified by some key
// (a player id, a slot index...), only one can be open per store
interface AnchoredPopoverStore<TKey> {
	openKey: TKey | null;
	anchorEl: HTMLElement | null;
	open: (key: TKey, anchorEl: HTMLElement) => void;
	close: () => void;
	toggle: (key: TKey, anchorEl: HTMLElement) => void;
}

function createAnchoredPopoverStore<TKey>() {
	return create<AnchoredPopoverStore<TKey>>((set, get) => ({
		openKey: null,
		anchorEl: null,
		open: (key, anchorEl) => set({ openKey: key, anchorEl }),
		close: () => set({ openKey: null, anchorEl: null }),
		toggle: (key, anchorEl) => {
			const { openKey } = get();
			if (openKey === key) {
				set({ openKey: null, anchorEl: null });
			} else {
				set({ openKey: key, anchorEl });
			}
		},
	}));
}

export const useBossCommandPopoverStore = createAnchoredPopoverStore<string>();

// opened by clicking one of your own face-down crew during your turn;
// offers Collect/Strike/Hide (whichever are legal) anchored to that card
export const useClassActionPopoverStore = createAnchoredPopoverStore<number>();

// opened by clicking one of your own face-up crew during your turn;
// offers your reserved Crew (face-down) to swap in, anchored to that card
export const useReserveSwapPopoverStore = createAnchoredPopoverStore<number>();
