import { useCallback, useEffect, useRef, useState } from "react";

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
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [cardSize, setCardSize] = useState(metrics.sizeMax);
	// bumped by the ref callback below whenever the underlying DOM node
	// actually changes (mount, unmount, or swap to a different element),
	// so it can sit in the effect's dependency array and force a fresh
	// measurement + ResizeObserver against whatever node is current.
	const [generation, setGeneration] = useState(0);

	// stable identity via useCallback ([] deps) is required here — this is
	// passed straight to JSX as `ref={...}`, and a ref callback with a new
	// function identity every render gets called by React with null then
	// the node on *every* render (detach old ref, attach "new" one), which
	// would call setGeneration on every render and loop forever.
	//
	// DraftingPhase swaps between separate mobile and desktop JSX trees as
	// isMobile flips, unmounting one grid element and mounting a different
	// one. a bare useRef + effect-with-[]-deps only ever observes whichever
	// node was attached the first time this hook instance's effect ran; if
	// the element is later swapped out (mobile -> desktop -> back) the old
	// ResizeObserver is left watching a detached node and never
	// reconnects. bumping generation here makes the effect below re-run
	// and rebuild the observer against the node that's actually mounted.
	const setContainerNode = useCallback((el: HTMLDivElement | null) => {
		containerRef.current = el;
		setGeneration((g) => g + 1);
	}, []);

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
	}, [generation]);

	return { containerRef: setContainerNode, cardSize };
}

export function useDesktopCardSize() {
	return useResponsiveCardSizeFor(DESKTOP_GRID);
}

export function useMobileCardSize() {
	return useResponsiveCardSizeFor(MOBILE_GRID);
}