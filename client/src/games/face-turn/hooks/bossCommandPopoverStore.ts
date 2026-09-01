import { create } from "zustand";

interface BossCommandPopoverStore {
	// set while the popover for this player's boss is open
	openForPlayerId: string | null;
	anchorEl: HTMLElement | null;
	open: (playerId: string, anchorEl: HTMLElement) => void;
	close: () => void;
	toggle: (playerId: string, anchorEl: HTMLElement) => void;
}

export const useBossCommandPopoverStore = create<BossCommandPopoverStore>(
	(set, get) => ({
		openForPlayerId: null,
		anchorEl: null,
		open: (playerId, anchorEl) => set({ openForPlayerId: playerId, anchorEl }),
		close: () => set({ openForPlayerId: null, anchorEl: null }),
		toggle: (playerId, anchorEl) => {
			const { openForPlayerId } = get();
			if (openForPlayerId === playerId) {
				set({ openForPlayerId: null, anchorEl: null });
			} else {
				set({ openForPlayerId: playerId, anchorEl });
			}
		},
	}),
);