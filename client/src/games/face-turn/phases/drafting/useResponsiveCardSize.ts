import { useEffect, useState } from "react";

const DRAFT_MOBILE_BREAKPOINT_PX = 720;

export function useIsDraftMobile(): boolean {
	const [isMobile, setIsMobile] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.innerWidth < DRAFT_MOBILE_BREAKPOINT_PX;
	});

	useEffect(() => {
		const mql = window.matchMedia(
			`(max-width: ${DRAFT_MOBILE_BREAKPOINT_PX - 1}px)`,
		);
		const handler = (e: MediaQueryListEvent) => {
			setIsMobile(e.matches);
		};
		mql.addEventListener("change", handler);
		return () => {
			mql.removeEventListener("change", handler);
		};
	}, []);

	return isMobile;
}

export interface GridMetrics {
	columns: number;
	gap: number;
	paddingX: number;
	sizeMin: number;
	sizeMax: number;
}

export const DESKTOP_GRID: GridMetrics = {
	columns: 4,
	gap: 40,
	paddingX: 40,
	sizeMin: 120,
	sizeMax: 310,
};

// used while the sidebar is expanded to full cards
// so fewer columns and a bit less breathing room per card
export const DESKTOP_GRID_COMPACT: GridMetrics = {
	columns: 3,
	gap: 32,
	paddingX: 32,
	sizeMin: 120,
	sizeMax: 310,
};

export const MOBILE_GRID: GridMetrics = {
	columns: 2,
	gap: 8,
	paddingX: 10,
	sizeMin: 120,
	sizeMax: 220,
};