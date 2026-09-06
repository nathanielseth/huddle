import { create } from "zustand";

// board cards only; hand stays independently sized
const DEFAULT_BOARD_CARD_PX = 120;

interface BoardCardSizeStore {
	px: number;
	setPx: (px: number) => void;
}

export const useBoardCardSizeStore = create<BoardCardSizeStore>((set) => ({
	px: DEFAULT_BOARD_CARD_PX,
	setPx: (px) => {
		set({ px });
	},
}));

export function useBoardCardSize(): number {
	return useBoardCardSizeStore((s) => s.px);
}