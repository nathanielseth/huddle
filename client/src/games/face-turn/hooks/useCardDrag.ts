// hand rolled drag on pointer events, position in store not state
import { useRef, useState } from "react";
import type { DragPositionStore } from "./dragPositionStore";

const DRAG_MOVE_THRESHOLD_PX = 12;
const LONG_PRESS_MS = 450;

export interface DragPosition {
	x: number;
	y: number;
}

export interface CardDragState<T> {
	dragging: boolean;
	origin: DragPosition | null;
	currentTarget: T | null;
}

export interface UseCardDragOptions<T> {
	positionStore: DragPositionStore;
	getTargetAt: (point: DragPosition) => T | null;
	isValidTarget: (candidate: T) => boolean;
	onDrop: (target: T) => void;
	onLongPress?: () => void;
	disabled?: boolean;
	// synchronous callback for drag state changes
	onDragStateChange?: (state: CardDragState<T>) => void;
}

export interface UseCardDragResult<T> {
	dragHandleProps: {
		onPointerDown: (e: React.PointerEvent) => void;
	};
	dragState: CardDragState<T>;
}

export function useCardDrag<T>({
	positionStore,
	getTargetAt,
	isValidTarget,
	onDrop,
	onLongPress,
	disabled = false,
	onDragStateChange,
}: UseCardDragOptions<T>): UseCardDragResult<T> {
	const [dragState, setDragState] = useState<CardDragState<T>>({
		dragging: false,
		origin: null,
		currentTarget: null,
	});

	function updateDragState(next: CardDragState<T>) {
		setDragState(next);
		onDragStateChange?.(next);
	}

	// mutable gesture state that should not trigger re renders
	const pointerIdRef = useRef<number | null>(null);
	const startPointRef = useRef<DragPosition | null>(null);
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const resolvedRef = useRef<"none" | "drag" | "inspect">("none");
	// live mirror of currentTarget for drop time
	const currentTargetRef = useRef<T | null>(null);

	const clearLongPressTimer = () => {
		if (longPressTimerRef.current !== null) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	};

	const endGesture = () => {
		clearLongPressTimer();
		pointerIdRef.current = null;
		startPointRef.current = null;
		resolvedRef.current = "none";
		currentTargetRef.current = null;
	};

	const removeWindowListeners = () => {
		window.removeEventListener("pointermove", handlePointerMove);
		window.removeEventListener("pointerup", handlePointerUp);
		window.removeEventListener("pointercancel", handlePointerCancel);
	};

	const handlePointerMove = (e: PointerEvent) => {
		if (pointerIdRef.current !== e.pointerId) return;
		const start = startPointRef.current;
		if (!start) return;
		const point = { x: e.clientX, y: e.clientY };

		if (resolvedRef.current === "none") {
			const dx = point.x - start.x;
			const dy = point.y - start.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			if (distance >= DRAG_MOVE_THRESHOLD_PX) {
				// movement wins over long press, treat as drag
				clearLongPressTimer();
				resolvedRef.current = "drag";
				const target = getTargetAt(point);
				currentTargetRef.current = target;
				positionStore.setPosition(point);
				updateDragState({
					dragging: true,
					origin: start,
					currentTarget: target,
				});
			}
			return;
		}

		if (resolvedRef.current === "drag") {
			// hot path: write to store, not state
			positionStore.setPosition(point);

			const candidate = getTargetAt(point);
			const target = candidate && isValidTarget(candidate) ? candidate : null;
			if (target !== currentTargetRef.current) {
				currentTargetRef.current = target;
				setDragState((prev) => ({ ...prev, currentTarget: target }));
			}
		}
	};

	const handlePointerUp = (e: PointerEvent) => {
		if (pointerIdRef.current !== e.pointerId) return;
		const wasDrag = resolvedRef.current === "drag";
		const finalTarget = currentTargetRef.current;

		removeWindowListeners();

		if (wasDrag) {
			if (finalTarget !== null) {
				onDrop(finalTarget);
			}
			positionStore.setPosition(null);
			updateDragState({
				dragging: false,
				origin: null,
				currentTarget: null,
			});
		}
		// plain tap: browser click handles it
		endGesture();
	};

	const handlePointerCancel = (e: PointerEvent) => {
		if (pointerIdRef.current !== e.pointerId) return;
		removeWindowListeners();
		positionStore.setPosition(null);
		updateDragState({
			dragging: false,
			origin: null,
			currentTarget: null,
		});
		endGesture();
	};

	const onPointerDown = (e: React.PointerEvent) => {
		if (disabled) return;
		if (pointerIdRef.current !== null) return;

		pointerIdRef.current = e.pointerId;
		startPointRef.current = { x: e.clientX, y: e.clientY };
		resolvedRef.current = "none";

		// no setPointerCapture: capture retargets pointerup click, plain tap wouldn't reach inner button
		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerCancel);

		longPressTimerRef.current = setTimeout(() => {
			if (resolvedRef.current !== "none") return;
			resolvedRef.current = "inspect";
			onLongPress?.();
		}, LONG_PRESS_MS);
	};

	return {
		dragHandleProps: { onPointerDown },
		dragState,
	};
}