import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "../../../../hooks/a11y/useReducedMotion";
import { useIsCompactPointer } from "../../../../hooks/a11y/useIsCompactPointer";
import { Card } from "./Card";
import {
	useCardInspectState,
	closeCardInspect,
	stepCardInspect,
} from "./cardInspectStore";
import "./card-inspect-modal.css";

const INSPECT_SIZE = 470;

// above board layers, below app modals
const INSPECT_Z = 1200;

// same threshold as toaster swipe
const SWIPE_OFFSET_PX = 60;
const SWIPE_VELOCITY = 0.5; // px/ms

// single shared instance mounted at app root, driven by store
export function AppCardInspect() {
	const state = useCardInspectState();
	const reducedMotion = useReducedMotion();
	const isCompactPointer = useIsCompactPointer();

	const card = state ? state.items[state.index] : null;
	const hasCycle = state !== null && state.items.length > 1;
	const canGoPrev = hasCycle && state.index > 0;
	const canGoNext = hasCycle && state.index < state.items.length - 1;

	// stable identities so keydown effect doesn't resubscribe every render
	const goPrev = useMemo(
		() => (canGoPrev ? () => stepCardInspect(-1) : undefined),
		[canGoPrev],
	);
	const goNext = useMemo(
		() => (canGoNext ? () => stepCardInspect(1) : undefined),
		[canGoNext],
	);

	// escape and arrow keys for non-touch input
	useEffect(() => {
		if (!card) return;
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") closeCardInspect();
			if (e.key === "ArrowLeft") goPrev?.();
			if (e.key === "ArrowRight") goNext?.();
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [card, goPrev, goNext]);

	if (!card) return null;

	const dragEnabled = hasCycle && isCompactPointer && !reducedMotion;

	// portaled to body so z-index compares at top level
	return createPortal(
		<div
			className="fixed inset-0 flex items-center justify-center pointer-events-auto"
			style={
				{
					zIndex: INSPECT_Z,
					background: "rgba(0,0,0,0.7)",
					backdropFilter: "blur(2px)",
					transition: reducedMotion ? "none" : "opacity 0.15s ease",
					// needed because body has no ambient card width var
					"--card-vw-share": "92vw",
				} as CSSProperties
			}
			onClick={closeCardInspect}
			role="dialog"
			aria-modal="true"
		>
			{/* pinned to viewport corner so close button stays reachable */}
			<button
				type="button"
				onClick={closeCardInspect}
				aria-label="Close card inspection"
				className="fixed top-4 right-4 w-9 h-9 rounded-full border border-white/20 bg-black/80 text-white/70 text-lg font-bold flex items-center justify-center hover:text-white hover:border-white/40"
				style={{ zIndex: INSPECT_Z + 1 }}
			>
				✕
			</button>

			{/* relative anchor for arrows, not drag target */}
			<div
				className="relative"
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				<SwipeableCard
					dragEnabled={dragEnabled}
					onSwipePrev={goPrev}
					onSwipeNext={goNext}
				>
					{/* inspect is not a selectable tile */}
					<Card
						{...card}
						size={INSPECT_SIZE}
						tiltOnHover={!isCompactPointer}
						selected={false}
					/>
				</SwipeableCard>

				{/* arrows only on fine pointer, offset from card edge */}
				{hasCycle && !isCompactPointer && (
					<>
						<InspectArrowButton direction="prev" onClick={goPrev} />
						<InspectArrowButton direction="next" onClick={goNext} />
					</>
				)}
			</div>
		</div>,
		document.body,
	);
}

// hand rolled swipe, snaps back or triggers prev/next past threshold
function SwipeableCard({
	dragEnabled,
	onSwipePrev,
	onSwipeNext,
	children,
}: {
	dragEnabled: boolean;
	onSwipePrev?: () => void;
	onSwipeNext?: () => void;
	children: React.ReactNode;
}) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [dragging, setDragging] = useState(false);
	const start = useRef<{ x: number; t: number } | null>(null);

	function onPointerDown(e: React.PointerEvent) {
		if (!dragEnabled) return;
		start.current = { x: e.clientX, t: performance.now() };
		setDragging(true);
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: React.PointerEvent) {
		if (!dragging || !start.current || !ref.current) return;
		const dx = e.clientX - start.current.x;
		ref.current.style.transform = `translateX(${dx}px)`;
	}

	function endDrag(e: React.PointerEvent) {
		if (!dragging || !start.current || !ref.current) return;
		const dx = e.clientX - start.current.x;
		const dt = Math.max(1, performance.now() - start.current.t);
		const velocity = Math.abs(dx) / dt;

		ref.current.style.transform = "";
		setDragging(false);
		start.current = null;

		const past = Math.abs(dx) > SWIPE_OFFSET_PX || velocity > SWIPE_VELOCITY;
		if (!past) return;
		// offset decides direction, velocity can disagree on bounce
		if (dx < 0) onSwipeNext?.();
		else onSwipePrev?.();
	}

	return (
		<div
			ref={ref}
			className={dragging ? "ft-inspect-swipe is-dragging" : "ft-inspect-swipe"}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
		>
			{children}
		</div>
	);
}

// disabled when no sibling that way, stays mounted for stable layout
function InspectArrowButton({
	direction,
	onClick,
}: {
	direction: "prev" | "next";
	onClick?: () => void;
}) {
	const isPrev = direction === "prev";
	return (
		<button
			type="button"
			disabled={!onClick}
			onClick={(e) => {
				// stop backdrop close
				e.stopPropagation();
				onClick?.();
			}}
			aria-label={isPrev ? "Previous card" : "Next card"}
			className={[
				"absolute top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border",
				"flex items-center justify-center text-xl font-bold",
				"transition-colors",
				isPrev ? "-left-16" : "-right-16",
				onClick
					? "border-white/20 bg-black/80 text-white/70 hover:text-white hover:border-white/40 cursor-pointer"
					: "border-white/5 bg-black/50 text-white/15 cursor-default",
			].join(" ")}
		>
			{isPrev ? "‹" : "›"}
		</button>
	);
}