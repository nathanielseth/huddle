import React, {
	useEffect,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { getMoveDisplay } from "@shared/games/face-turn/card-display";
import { Card, CARD_MIN_WIDTH_PX, type CardProps } from "../card/Card";
import { CREW_SLOT_CARD_SIZE } from "../BoardPrimitives";
import { moveToCard } from "../card/cardAdapters";
import { useCardFlip } from "../../lib/animation/useCardFlip";
import {
	useCardDrag,
	type CardDragState,
	type DragPosition,
} from "../../hooks/useCardDrag";
import {
	createDragPositionStore,
	type DragPositionStore,
} from "../../hooks/dragPositionStore";
import { setDraggedMove, useDraggedMoveId } from "../../hooks/draggedMoveStore";
import { useReducedMotion } from "../../../../hooks/a11y/useReducedMotion";
import { DragPortal } from "./DragPortal";
import { useCardInspect, type InspectCycle } from "../card/useCardInspect";
import { HandFanController, type HandFanSlot } from "./handFan";
import { useStableHandKeys } from "./useStableHandKeys";
import {
	setCardHoverPreview,
	clearCardHoverPreview,
} from "./cardHoverPreviewStore";
import "./hand-fan.css";

// match board card size for table consistency
const HAND_CARD_SIZE = CREW_SLOT_CARD_SIZE;
const HAND_CARD_VW_SHARE = `${CREW_SLOT_CARD_SIZE}px`;
const CARD_OVERLAP_PCT = 55;

interface HandDragVisualState {
	moveId: string;
	cardProps: CardProps;
	playable: boolean;
	selected: boolean;
	armed: boolean;
}

function HandCardSlot<T>({
	moveId,
	index,
	cardProps,
	selected,
	armed,
	disabled,
	playable,
	onSelect,
	onLongPress,
	getTargetAt,
	isValidTarget,
	onDrop,
	dragEnabled,
	positionStore,
	onDragVisualChange,
	registerFanSlot,
	getFanController,
}: {
	moveId: string;
	index: number;
	cardProps: CardProps;
	selected: boolean;
	armed: boolean;
	disabled: boolean;
	playable: boolean;
	onSelect: () => void;
	onLongPress: () => void;
	getTargetAt: (point: DragPosition, moveId: string) => T | null;
	isValidTarget: (candidate: T, moveId: string) => boolean;
	onDrop: (target: T) => void;
	dragEnabled: boolean;
	positionStore: DragPositionStore;
	onDragVisualChange: (state: HandDragVisualState | null) => void;
	registerFanSlot: (index: number, el: HTMLDivElement | null) => void;
	getFanController: () => HandFanController | null;
}) {
	const { ref: flipRef, play } = useCardFlip();
	const fanRef = useRef<HTMLDivElement | null>(null);

	const ownsDragVisualRef = useRef(false);
	// token comparison avoids stale object identity issues in hover store
	const hoverTokenRef = useRef<number | null>(null);
	function clearOwnPreview() {
		if (hoverTokenRef.current !== null) {
			clearCardHoverPreview(hoverTokenRef.current);
			hoverTokenRef.current = null;
		}
	}

	function handleDragStateChange(state: CardDragState<T>) {
		const el = fanRef.current;
		el?.classList.toggle("is-drag-source", state.dragging);
		getFanController()?.setDragging(state.dragging);

		if (state.dragging && state.origin) {
			ownsDragVisualRef.current = true;
			clearOwnPreview();
			onDragVisualChange({ moveId, cardProps, playable, selected, armed });
		} else if (ownsDragVisualRef.current) {
			ownsDragVisualRef.current = false;
			onDragVisualChange(null);
		}
	}

	const { dragHandleProps } = useCardDrag<T>({
		positionStore,
		disabled: disabled || !dragEnabled,
		getTargetAt: (point) => getTargetAt(point, moveId),
		isValidTarget: (candidate) => isValidTarget(candidate, moveId),
		onDrop,
		onLongPress,
		onDragStateChange: handleDragStateChange,
	});

	// clear lingering preview if slot unmounts while hovered
	useEffect(() => clearOwnPreview, []);

	return (
		<div
			ref={flipRef as React.RefObject<HTMLDivElement>}
			className="shrink-0"
			style={{
				marginLeft:
					index === 0
						? 0
						: `calc(var(--hand-card-w) * -${CARD_OVERLAP_PCT} / 100)`,
				position: "relative",
			}}
			onPointerEnter={() => {
				if (fanRef.current) {
					getFanController()?.focusSlot({ el: fanRef.current });
				}
				hoverTokenRef.current = setCardHoverPreview(cardProps);
			}}
			onPointerLeave={() => {
				if (fanRef.current) {
					getFanController()?.blurSlot({ el: fanRef.current });
				}
				clearOwnPreview();
			}}
		>
			<div
				ref={(el) => {
					fanRef.current = el;
					registerFanSlot(index, el);
				}}
				className="hand-fan-slot"
				{...dragHandleProps}
				onContextMenu={(e) => {
					e.preventDefault();
					onLongPress();
				}}
			>
				<Card
					{...cardProps}
					size={HAND_CARD_SIZE}
					selected={selected}
					armed={armed}
					disabled={disabled}
					playable={playable}
					onClick={() => {
						play();
						onSelect();
					}}
				/>
			</div>
		</div>
	);
}

export function Hand<T = string>({
	cardIds,
	getCost,
	getPlayable,
	selectedId,
	armedId,
	disabled,
	onSelect,
	dragEnabled = false,
	getTargetAt,
	isValidTarget,
	onDrop,
}: {
	cardIds: readonly string[];
	getCost: (moveId: string) => number;
	getPlayable?: (moveId: string) => boolean;
	selectedId?: string | null;
	armedId?: string | null;
	disabled?: boolean;
	onSelect?: (moveId: string, index: number) => void;
	dragEnabled?: boolean;
	getTargetAt?: (point: DragPosition, moveId: string) => T | null;
	isValidTarget?: (candidate: T, moveId: string) => boolean;
	onDrop?: (moveId: string, target: T) => void;
}) {
	const { inspect, modal: inspectModal } = useCardInspect();
	const [dragVisual, setDragVisual] = useState<HandDragVisualState | null>(
		null,
	);

	useEffect(() => {
		setDraggedMove(dragVisual?.moveId ?? null);
		return () => setDraggedMove(null);
	}, [dragVisual?.moveId]);

	const inspectCycleItems = useMemo(
		() =>
			cardIds.map((moveId) =>
				moveToCard(getMoveDisplay(moveId), getCost(moveId)),
			),
		[cardIds, getCost],
	);
	const stableKeys = useStableHandKeys(cardIds);
	const reducedMotion = useReducedMotion();
	const getReducedMotion = useEffectEvent(() => reducedMotion);

	const handRef = useRef<HTMLDivElement | null>(null);
	const fanController = useRef<HandFanController | null>(null);
	const fanSlotsRef = useRef<(HTMLDivElement | null)[]>([]);
	const [positionStore] = useState<DragPositionStore>(() =>
		createDragPositionStore(),
	);

	const hasCards = cardIds.length > 0;
	useLayoutEffect(() => {
		if (!hasCards) return;
		const el = handRef.current;
		if (!el) return;
		const controller = new HandFanController(el);
		fanController.current = controller;

		const slots: HandFanSlot[] = fanSlotsRef.current
			.map((slotEl): HandFanSlot | null => (slotEl ? { el: slotEl } : null))
			.filter((s): s is HandFanSlot => s !== null);
		controller.registerSlots(slots);
		controller.setReducedMotion(getReducedMotion());

		return () => {
			controller.destroy();
			fanController.current = null;
		};
	}, [hasCards]);

	useEffect(() => {
		fanController.current?.setReducedMotion(reducedMotion);
	}, [reducedMotion]);

	useLayoutEffect(() => {
		const slots: HandFanSlot[] = fanSlotsRef.current
			.map((el): HandFanSlot | null => (el ? { el } : null))
			.filter((s): s is HandFanSlot => s !== null);
		fanController.current?.registerSlots(slots);
	}, [cardIds]);

	function getFanController() {
		return fanController.current;
	}
	function registerFanSlot(index: number, el: HTMLDivElement | null) {
		fanSlotsRef.current[index] = el;
	}

	const effectiveDragEnabled =
		dragEnabled && Boolean(getTargetAt && isValidTarget);

	const resolvedGetTargetAt = getTargetAt ?? NO_TARGET;
	const resolvedIsValidTarget = isValidTarget ?? NO_VALID_TARGET;

	if (cardIds.length === 0) {
		return <p className="text-xs text-white/25 italic px-2">Hand is empty</p>;
	}

	return createPortal(
		<div
			className="fixed inset-x-0 lg:right-(--rail-inset) bottom-0 z-30 flex justify-center pointer-events-none"
			style={
				{
					"--card-vw-share": HAND_CARD_VW_SHARE,
					"--hand-card-w": `clamp(${CARD_MIN_WIDTH_PX}px, var(--card-vw-share), ${HAND_CARD_SIZE}px)`,
					"--hand-card-h": "calc(var(--hand-card-w) * 88 / 63)",
					// negative margin pulls cards partly offscreen for fan arc
					marginBottom: "calc(var(--hand-card-h) * -0.35)",
				} as React.CSSProperties
			}
		>
			<div className="relative pointer-events-none">
				<div
					ref={handRef}
					className="hand-fan-hover-scope flex justify-center overflow-visible px-1 py-3 pointer-events-auto"
					style={{ touchAction: "pan-x" }}
					onPointerEnter={() => getFanController()?.setHandHovering(true)}
					onPointerLeave={() => getFanController()?.setHandHovering(false)}
				>
					{cardIds.map((moveId, i) => (
						<ConnectedHandCardSlot
							key={stableKeys[i]}
							moveId={moveId}
							index={i}
							getCost={getCost}
							getPlayable={getPlayable}
							selectedId={selectedId}
							armedId={armedId}
							disabled={disabled}
							onSelect={onSelect}
							inspect={inspect}
							inspectCycleItems={inspectCycleItems}
							dragEnabled={effectiveDragEnabled}
							getTargetAt={resolvedGetTargetAt}
							isValidTarget={resolvedIsValidTarget}
							onDrop={onDrop}
							positionStore={positionStore}
							onDragVisualChange={setDragVisual}
							registerFanSlot={registerFanSlot}
							getFanController={getFanController}
						/>
					))}
				</div>

				<DragPortal positionStore={positionStore}>
					{dragVisual && (
						<Card
							{...dragVisual.cardProps}
							size={HAND_CARD_SIZE}
							playable={dragVisual.playable}
							selected={dragVisual.selected}
							armed={dragVisual.armed}
						/>
					)}
				</DragPortal>

				{inspectModal}
			</div>
		</div>,
		document.body,
	);
}

function NO_TARGET(): null {
	return null;
}
function NO_VALID_TARGET(): false {
	return false;
}

function ConnectedHandCardSlot<T>({
	moveId,
	index,
	getCost,
	getPlayable,
	selectedId,
	armedId,
	disabled,
	onSelect,
	inspect,
	inspectCycleItems,
	dragEnabled,
	getTargetAt,
	isValidTarget,
	onDrop,
	positionStore,
	onDragVisualChange,
	registerFanSlot,
	getFanController,
}: {
	moveId: string;
	index: number;
	getCost: (moveId: string) => number;
	getPlayable?: (moveId: string) => boolean;
	selectedId?: string | null;
	armedId?: string | null;
	disabled?: boolean;
	onSelect?: (moveId: string, index: number) => void;
	inspect: (cardProps: CardProps, cycle?: InspectCycle) => void;
	inspectCycleItems: readonly CardProps[];
	dragEnabled: boolean;
	getTargetAt: (point: DragPosition, moveId: string) => T | null;
	isValidTarget: (candidate: T, moveId: string) => boolean;
	onDrop?: (moveId: string, target: T) => void;
	positionStore: DragPositionStore;
	onDragVisualChange: (state: HandDragVisualState | null) => void;
	registerFanSlot: (index: number, el: HTMLDivElement | null) => void;
	getFanController: () => HandFanController | null;
}) {
	const cost = getCost(moveId);
	const isPlayableMove = getPlayable ? getPlayable(moveId) : false;
	const cardDisabled = Boolean(disabled);

	// suppress glow on all cards while another card is being dragged
	const draggedMoveId = useDraggedMoveId();
	const isAnotherCardDragging =
		draggedMoveId !== null && draggedMoveId !== moveId;

	const playable =
		Boolean(getPlayable) &&
		isPlayableMove &&
		!disabled &&
		!isAnotherCardDragging;

	const cardProps = moveToCard(getMoveDisplay(moveId), cost);

	function handleSelect() {
		onSelect?.(moveId, index);
	}
	function handleLongPress() {
		inspect(cardProps, { items: inspectCycleItems, index });
	}
	function handleDrop(target: T) {
		onDrop?.(moveId, target);
	}

	return (
		<HandCardSlot
			moveId={moveId}
			index={index}
			cardProps={cardProps}
			selected={selectedId === moveId && !isAnotherCardDragging}
			armed={armedId === moveId && !isAnotherCardDragging}
			disabled={cardDisabled}
			playable={playable}
			onSelect={handleSelect}
			onLongPress={handleLongPress}
			getTargetAt={getTargetAt}
			isValidTarget={isValidTarget}
			onDrop={handleDrop}
			dragEnabled={dragEnabled}
			positionStore={positionStore}
			onDragVisualChange={onDragVisualChange}
			registerFanSlot={registerFanSlot}
			getFanController={getFanController}
		/>
	);
}