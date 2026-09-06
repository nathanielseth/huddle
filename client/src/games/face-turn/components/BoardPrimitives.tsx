import { useEffect, useState } from "react";
import {
	getCrewDisplay,
	getMoveDisplay,
	getBossDisplay,
} from "@shared/games/face-turn/card-display";
import type {
	BossView,
	CrewSlotView,
	ActiveMoveSlotView,
} from "@shared/games/face-turn/types";
import { Card } from "./card/Card";
import { crewToCard, moveToCard, bossToCard } from "./card/cardAdapters";
import { ShieldIcon, MutedIcon } from "./card/CardIcons";
import { useCardInspect } from "./card/useCardInspect";
import {
	boardTargetRegistry,
	useBoardTarget,
	type BoardTarget,
} from "../hooks/boardTargetRegistry";
import { useIsLegalDropTarget } from "../lib/moveTargetLegality";
import { useIsDraggedOverTarget } from "../hooks/draggedOverTargetStore";
import { useCardDrag, type DragPosition } from "../hooks/useCardDrag";
import {
	createDragPositionStore,
	type DragPositionStore,
} from "../hooks/dragPositionStore";
import { setActiveMoveDragging } from "../hooks/activeMoveDragStore";
import { useActiveMoveDiscardStore } from "../hooks/useActiveMoveDiscard";
import { DragPortal } from "./hand/DragPortal";
import { useHoverPreview } from "./hand/useHoverPreview";
import { setCardHoverPreview } from "./hand/cardHoverPreviewStore";
import { useBoardCardSize } from "../hooks/boardCardSizeStore";

export const CREW_SLOT_CARD_SIZE = 120;
export const HALF_CARD_ASPECT_RATIO = "63 / 51.72";

export function CrewSlotBadge({
	slot,
	knownCrewId,
	selectable,
	selected,
	armed,
	onClick,
}: {
	slot: CrewSlotView;
	knownCrewId?: string | null;
	selectable?: boolean;
	selected?: boolean;
	armed?: boolean;
	onClick?: () => void;
}) {
	const { inspect, modal: inspectModal } = useCardInspect();
	const cardPx = useBoardCardSize();

	const revealedId =
		slot.status === "empty"
			? null
			: slot.status === "face_up"
				? slot.crewId
				: (knownCrewId ?? null);
	const previewableCardProps = revealedId
		? crewToCard(getCrewDisplay(revealedId))
		: null;
	const hoverPreviewProps = useHoverPreview(previewableCardProps);

	useEffect(() => {
		if (revealedId == null) setCardHoverPreview(null);
	}, [revealedId]);

	if (slot.status === "empty") {
		return (
			<div
				style={{ width: cardPx, aspectRatio: "63 / 88" }}
				className="ft-panel-ink-flat rounded-lg border border-dashed border-white/15 flex items-center justify-center"
			>
				<span className="ft-eyebrow text-[8px] text-white/20">Empty</span>
			</div>
		);
	}

	const isFaceDown = slot.status === "face_down";
	const canInspect = revealedId != null;

	const cardProps = revealedId
		? crewToCard(getCrewDisplay(revealedId))
		: { variant: "unknown" as const, title: "?", abilities: [] };

	const card = (
		<Card
			{...cardProps}
			size={cardPx}
			flipped={isFaceDown}
			selected={selected}
			armed={armed}
			onClick={selectable ? onClick : undefined}
		/>
	);

	return (
		<>
			<div
				className="relative"
				onContextMenu={(e) => {
					if (!canInspect) return;
					e.preventDefault();
					inspect(cardProps);
				}}
				onMouseEnter={() => hoverPreviewProps?.onPointerEnter()}
				onMouseLeave={() => hoverPreviewProps?.onPointerLeave()}
			>
				{card}
				{slot.status === "face_up" && slot.isPassiveDisabled && (
					<span
						title="This crew's passive is currently disabled"
						className="absolute top-1 right-1 flex items-center justify-center rounded-full bg-black/70 p-0.5 pointer-events-none"
					>
						<MutedIcon className="w-2.5 h-2.5" />
					</span>
				)}
			</div>
			{inspectModal}
		</>
	);
}

export function BossPanel({
	boss,
	name,
	highlighted,
	exposed,
	onClick,
}: {
	boss: BossView;
	name?: string;
	highlighted?: boolean;
	exposed?: boolean;
	onClick?: () => void;
}) {
	const { inspect, modal: inspectModal } = useCardInspect();
	const cardPx = useBoardCardSize();
	const bossCardProps = boss.id
		? {
				...bossToCard(getBossDisplay(boss.id)),
				...(name ? { title: name } : {}),
				badgeText: String(boss.hp),
			}
		: null;
	const hoverPreviewProps = useHoverPreview(bossCardProps);

	if (!boss.id) {
		return (
			<div
				style={{ width: cardPx, aspectRatio: "63 / 88" }}
				className="ft-panel-ink-flat rounded-lg border border-dashed border-white/15 flex items-center justify-center"
			>
				<span className="ft-eyebrow text-[8px] text-white/20">No boss</span>
			</div>
		);
	}

	const hasImmunity = (boss.armorTurnsRemaining ?? 0) > 0;
	const cardProps = bossCardProps!;

	return (
		<>
			<div
				className="relative"
				onContextMenu={(e) => {
					e.preventDefault();
					inspect(cardProps);
				}}
				{...hoverPreviewProps}
			>
				<Card
					{...cardProps}
					size={cardPx}
					armed={highlighted}
					onClick={onClick}
				/>
				{exposed && (
					<span
						title="No face-down Crew left — the next lost Strike or Challenge executes this Boss"
						className="absolute top-1 right-1 rounded bg-red-600/90 px-1 py-0.5 text-[8px] font-bold tracking-wide text-white pointer-events-none"
					>
						EXPOSED
					</span>
				)}
				{(boss.armor > 0 || hasImmunity) && (
					<div className="absolute top-1 left-1 flex flex-col gap-0.5 pointer-events-none">
						{boss.armor > 0 && (
							<span className="flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] font-bold text-white/80">
								<ShieldIcon className="w-2.5 h-2.5" />
								{boss.armor}
							</span>
						)}
						{hasImmunity && (
							<span className="flex items-center gap-0.5 rounded bg-black/70 px-1 py-0.5 text-[8px] font-bold text-amber-300/90">
								<ShieldIcon className="w-2.5 h-2.5" />
								{boss.armorTurnsRemaining}t
							</span>
						)}
					</div>
				)}
			</div>
			{inspectModal}
		</>
	);
}

export function CashChip({ amount }: { amount: number }) {
	return (
		<span className="ft-panel-ink ft-eyebrow inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-white/15 text-[11px] text-white tabular-nums">
			₱{amount}
		</span>
	);
}

const HAND_STRIP_VISIBLE_MAX = 6;

function MiniCardBack({ px }: { px: number }) {
	return (
		<div
			className="flip-container is-flipped"
			style={{ width: px, aspectRatio: "63 / 88" }}
		>
			<div className="flip-perspective">
				<div className="flip-inner">
					<div className="tcg-card-back">
						<div className="back-panel" />
					</div>
				</div>
			</div>
		</div>
	);
}

export function OpponentHandStrip({
	count,
	compact,
}: {
	count: number;
	compact?: boolean;
}) {
	if (count <= 0) return null;

	const cardPx = compact ? 24 : 30;
	const overlapPx = compact ? 14 : 18;
	const visible = Math.min(count, HAND_STRIP_VISIBLE_MAX);
	const overflow = count - visible;

	return (
		<span
			className="inline-flex items-center shrink-0"
			title={`${count} card${count === 1 ? "" : "s"} in hand`}
		>
			<span className="inline-flex" style={{ paddingRight: overlapPx }}>
				{Array.from({ length: visible }, (_, i) => (
					<span
						key={i}
						className="inline-block"
						style={{
							marginLeft: i === 0 ? 0 : -overlapPx,
							zIndex: i,
						}}
					>
						<MiniCardBack px={cardPx} />
					</span>
				))}
			</span>
			{overflow > 0 && (
				<span className="ft-eyebrow text-[9px] text-white/40 tabular-nums">
					+{overflow}
				</span>
			)}
		</span>
	);
}

const ACTIVE_MOVE_SLOT_GAP = {
	md: "0.625rem",
	sm: "0.375rem",
} as const;

const ACTIVE_MOVE_SLOT_PX_SM = 44;

function RegisteredActiveMoveSlot({
	slot,
	px,
	target,
}: {
	slot: ActiveMoveSlotView;
	px: number;
	target: BoardTarget;
}) {
	const ref = useBoardTarget(target);
	const legal = useIsLegalDropTarget(target);
	const hovered = useIsDraggedOverTarget(target);
	return (
		<ActiveMoveSlotContent
			slot={slot}
			px={px}
			slotRef={ref}
			highlighted={legal && hovered}
		/>
	);
}

function ActiveMoveSlot({
	slot,
	px,
}: {
	slot: ActiveMoveSlotView;
	px: number;
}) {
	return <ActiveMoveSlotContent slot={slot} px={px} />;
}

function ActiveMoveSlotContent({
	slot,
	px,
	slotRef,
	highlighted,
	dragHandleProps,
	dragSourceHidden,
}: {
	slot: ActiveMoveSlotView;
	px: number;
	slotRef?: (el: HTMLElement | null) => void;
	highlighted?: boolean;
	dragHandleProps?: { onPointerDown: (e: React.PointerEvent) => void };
	dragSourceHidden?: boolean;
}) {
	const { inspect, modal: inspectModal } = useCardInspect();
	const cardProps = slot.moveId
		? moveToCard(getMoveDisplay(slot.moveId))
		: null;
	const hoverPreviewProps = useHoverPreview(cardProps);

	if (!slot.moveId || !cardProps) {
		return (
			<div
				ref={slotRef}
				{...dragHandleProps}
				style={{ width: px, aspectRatio: HALF_CARD_ASPECT_RATIO }}
				className={[
					"ft-panel-ink-flat rounded-lg border border-dashed flex items-center justify-center transition-colors",
					highlighted
						? "border-[#ab56ff] bg-[#ab56ff]/10 shadow-[0_0_12px_rgba(171,86,255,0.45)]"
						: "border-white/15",
				].join(" ")}
			>
				<span
					className={
						highlighted
							? "ft-eyebrow text-[8px] text-[#ab56ff]"
							: "ft-eyebrow text-[8px] text-white/20"
					}
				>
					Empty
				</span>
			</div>
		);
	}

	return (
		<>
			<div
				ref={slotRef}
				{...dragHandleProps}
				onContextMenu={(e) => {
					e.preventDefault();
					inspect(cardProps);
				}}
				style={
					dragSourceHidden ? { opacity: 0, pointerEvents: "none" } : undefined
				}
				{...hoverPreviewProps}
			>
				<Card {...cardProps} size={px} armed={highlighted} halfCard />
			</div>
			{inspectModal}
		</>
	);
}

function DraggableActiveMoveSlot({
	slot,
	px,
	target,
}: {
	slot: ActiveMoveSlotView;
	px: number;
	target: BoardTarget;
}) {
	const ref = useBoardTarget(target);
	const legal = useIsLegalDropTarget(target);
	const hovered = useIsDraggedOverTarget(target);
	const highlighted = legal && hovered;

	const [positionStore] = useState<DragPositionStore>(() =>
		createDragPositionStore(),
	);

	function getTargetAt(point: DragPosition): BoardTarget | null {
		return boardTargetRegistry.getTargetAt(point);
	}

	// only drop target is own discard pile
	function isValidTarget(candidate: BoardTarget): boolean {
		return (
			candidate.kind === "discard" && candidate.playerId === target.playerId
		);
	}

	function onDrop() {
		useActiveMoveDiscardStore.getState().onDiscard?.(slot.slotIndex);
	}

	function handleDragStateChange(state: { dragging: boolean }) {
		setActiveMoveDragging(state.dragging);
		if (state.dragging) setCardHoverPreview(null);
	}

	const { dragHandleProps, dragState } = useCardDrag<BoardTarget>({
		positionStore,
		disabled: !slot.moveId,
		getTargetAt,
		isValidTarget,
		onDrop,
		onDragStateChange: handleDragStateChange,
	});

	const cardProps = slot.moveId
		? moveToCard(getMoveDisplay(slot.moveId))
		: null;

	// undo the setActiveMoveDragging(true) from handleDragStateChange if this
	// slot unmounts mid-drag
	useEffect(() => () => setActiveMoveDragging(false), []);

	return (
		<>
			<ActiveMoveSlotContent
				slot={slot}
				px={px}
				slotRef={ref}
				highlighted={highlighted || dragState.currentTarget !== null}
				dragHandleProps={dragHandleProps}
			/>
			<DragPortal positionStore={positionStore}>
				{dragState.dragging && cardProps && (
					<Card {...cardProps} size={px} halfCard />
				)}
			</DragPortal>
		</>
	);
}

export function ActiveMoveSlots({
	slots,
	size = "md",
	getTargetForSlot,
	discardEnabled = false,
}: {
	slots: readonly ActiveMoveSlotView[];
	size?: "md" | "sm";
	getTargetForSlot?: (slotIndex: number) => BoardTarget;
	discardEnabled?: boolean;
}) {
	const liveCardPx = useBoardCardSize();
	const px = size === "md" ? liveCardPx : ACTIVE_MOVE_SLOT_PX_SM;
	const gap = ACTIVE_MOVE_SLOT_GAP[size];
	return (
		<div
			className="grid"
			style={{
				gap,
				gridTemplateColumns: `repeat(${slots.length}, minmax(0, ${px}px))`,
			}}
		>
			{slots.map((s) => {
				const target = getTargetForSlot?.(s.slotIndex);
				const content = !target ? (
					<ActiveMoveSlot slot={s} px={px} />
				) : discardEnabled ? (
					<DraggableActiveMoveSlot slot={s} px={px} target={target} />
				) : (
					<RegisteredActiveMoveSlot slot={s} px={px} target={target} />
				);
				return (
					<div key={s.slotIndex} className="flex justify-center">
						{content}
					</div>
				);
			})}
		</div>
	);
}