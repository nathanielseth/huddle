import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "../../../../hooks/a11y/useReducedMotion";

// shared flip mechanism for position changes
export interface UseCardFlipResult {
	ref: React.RefObject<HTMLElement | null>;
	play: () => void;
}

const FLIP_DURATION_MS = 350;
// matches card.css ease
const FLIP_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

export function useCardFlip(): UseCardFlipResult {
	const ref = useRef<HTMLElement | null>(null);
	const firstRect = useRef<DOMRect | null>(null);
	const pendingPlay = useRef(false);
	const cleanupRef = useRef<(() => void) | null>(null);
	const reducedMotion = useReducedMotion();

	function play() {
		const el = ref.current;
		if (!el) return;
		firstRect.current = el.getBoundingClientRect();
		pendingPlay.current = true;
	}

	useLayoutEffect(() => {
		// run the pending flip's cleanup (if any) on unmount, so a card removed
		// mid-flip doesn't leave its listener/timer running past its own lifetime
		return () => cleanupRef.current?.();
	}, []);

	useLayoutEffect(() => {
		if (!pendingPlay.current) return;
		pendingPlay.current = false;

		const el = ref.current;
		const first = firstRect.current;
		if (!el || !first) return;

		const last = el.getBoundingClientRect();

		// round to device pixels to avoid fractional scale blur
		const dpr = window.devicePixelRatio || 1;
		const round = (v: number) => Math.round(v * dpr) / dpr;
		const firstLeft = round(first.left);
		const firstTop = round(first.top);
		const firstWidth = round(first.width);
		const firstHeight = round(first.height);
		const lastLeft = round(last.left);
		const lastTop = round(last.top);
		const lastWidth = round(last.width);
		const lastHeight = round(last.height);

		const deltaX = firstLeft - lastLeft;
		const deltaY = firstTop - lastTop;
		const scaleX = lastWidth === 0 ? 1 : firstWidth / lastWidth;
		const scaleY = lastHeight === 0 ? 1 : firstHeight / lastHeight;

		const noOp =
			Math.abs(deltaX) < 0.5 &&
			Math.abs(deltaY) < 0.5 &&
			Math.abs(scaleX - 1) < 0.01 &&
			Math.abs(scaleY - 1) < 0.01;
		if (noOp) return;

		if (reducedMotion) {
			// already snapped to last position
			return;
		}

		// cancel a still-running previous flip on this element before starting a new one
		cleanupRef.current?.();

		// invert: jump back to first, with no transition so the jump doesn't animate
		el.style.transition = "none";
		el.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
		el.style.transformOrigin = "top left";
		el.style.willChange = "transform";

		// force layout so the jump above commits before the transition is enabled
		void el.getBoundingClientRect();

		const reset = () => {
			el.style.transition = "";
			el.style.transform = "";
			el.style.transformOrigin = "";
			el.style.willChange = "";
			el.removeEventListener("transitionend", onEnd);
			clearTimeout(fallback);
			cancelAnimationFrame(raf);
			cleanupRef.current = null;
		};
		// fallback in case transitionend never fires (e.g. element removed mid-flip)
		const fallback = setTimeout(reset, FLIP_DURATION_MS + 50);
		const onEnd = (e: TransitionEvent) => {
			if (e.target !== el || e.propertyName !== "transform") return;
			reset();
		};
		el.addEventListener("transitionend", onEnd);
		cleanupRef.current = reset;

		// play to identity on the next frame, after the jump above has painted
		const raf = requestAnimationFrame(() => {
			el.style.transition = `transform ${FLIP_DURATION_MS}ms ${FLIP_EASE}`;
			el.style.transform = "translate(0px, 0px) scale(1, 1)";
		});

		return () => {
			el.removeEventListener("transitionend", onEnd);
			clearTimeout(fallback);
			cancelAnimationFrame(raf);
		};
	});

	return { ref, play };
}
