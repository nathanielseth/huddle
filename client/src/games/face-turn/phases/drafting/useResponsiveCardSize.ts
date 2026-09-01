import { useEffect, useRef, useState } from "react";

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

interface GridMetrics {
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
	sizeMin: 160,
	sizeMax: 285,
};

export const MOBILE_GRID: GridMetrics = {
	columns: 2,
	gap: 8,
	paddingX: 10,
	sizeMin: 120,
	sizeMax: 220,
};

function useResponsiveCardSizeFor(metrics: GridMetrics) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [cardSize, setCardSize] = useState(metrics.sizeMax);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const compute = (containerWidth: number) => {
			const usableWidth = containerWidth - metrics.paddingX * 2;
			const raw =
				(usableWidth - metrics.gap * (metrics.columns - 1)) / metrics.columns;
			const clamped = Math.min(
				metrics.sizeMax,
				Math.max(metrics.sizeMin, Math.floor(raw)),
			);
			setCardSize(clamped);
		};

		compute(el.clientWidth);

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) compute(entry.contentRect.width);
		});
		observer.observe(el);
		return () => {
			observer.disconnect();
		};
		// metrics is always DESKTOP_GRID or MOBILE_GRID, both stable module constants
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return { containerRef, cardSize };
}

export function useDesktopCardSize() {
	return useResponsiveCardSizeFor(DESKTOP_GRID);
}

export function useMobileCardSize() {
	return useResponsiveCardSizeFor(MOBILE_GRID);
}