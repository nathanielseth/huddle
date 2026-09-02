import { useRef, useState } from "react";
import { cn } from "../../../lib/utils/cn";
import type { FaceturnsPlayerView } from "@shared/games/face-turn/types";
import { FACETURN_CONSTANTS } from "@shared/games/face-turn/constants";
import {
	BossPanel,
	CrewSlotBadge,
	ActiveMoveSlots,
	CashChip,
	CREW_SLOT_CARD_SIZE,
	OpponentHandStrip,
} from "./BoardPrimitives";
import { HandIcon, DeckIcon, DiscardIcon, PoisonIcon } from "./card/CardIcons";
import { CrewClassGuessPopover } from "./interaction-prompts/CrewClassGuessPopover";
import { useBoardTarget, type BoardTarget } from "../hooks/boardTargetRegistry";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useFaceturnInteraction } from "../hooks/useFaceturnInteraction";
import { useBossCommandPopoverStore } from "../hooks/bossCommandPopoverStore";
import { useClassActionPopoverStore } from "../hooks/classActionPopoverStore";
import { useArmedMove, useArmedMoveStore } from "../hooks/useArmedMove";
import {
	useTargetPickerSession,
	useTargetPickerStore,
	usePendingClassGuessTarget,
	isTargetPickerEligible,
} from "../hooks/targetPickerStore";
import { isValidSecondaryTarget } from "../lib/postPlacementLegality";
import { isPlayerExposed } from "../lib/challengeEligibility";
import { useIsLegalDropTarget } from "../lib/moveTargetLegality";
import { useDraggedMoveId } from "../hooks/draggedMoveStore";
import { useIsActiveMoveDragging } from "../hooks/activeMoveDragStore";
import type { CrewSlotView } from "@shared/games/face-turn/types";

const HAND_LIMIT = FACETURN_CONSTANTS.HAND_LIMIT;

// discard pile scaled to footer row, not crew grid, echoes sm active slot size
const DISCARD_PILE_PX = 44;

function DiscardPile({
	playerId,
	discardSize,
	sellable,
}: {
	playerId: string;
	discardSize: number;
	sellable: boolean;
}) {
	const ref = useBoardTarget({ kind: "discard", playerId });
	const draggedMoveId = useDraggedMoveId();
	const activeMoveDragging = useIsActiveMoveDragging();
	const highlighted =
		(sellable && draggedMoveId !== null) || activeMoveDragging;

	return (
		<div
			ref={ref}
			title="Discard pile"
			style={{ width: DISCARD_PILE_PX, height: DISCARD_PILE_PX }}
			className={cn(
				"ft-panel-ink flex flex-col items-center justify-center gap-0.5 rounded-lg border border-white/10 shrink-0 transition-all",
				highlighted && "ft-drop-zone-legal",
			)}
		>
			<DiscardIcon className="w-4 h-4 text-white/40" />
			<span className="ft-eyebrow text-[9px] text-white/40 tabular-nums">
				{discardSize}
			</span>
		</div>
	);
}

function BossCell({
	playerId,
	boss,
	exposed,
	isMe,
}: {
	playerId: string;
	boss: FaceturnsPlayerView["boss"];
	exposed: boolean;
	isMe: boolean;
}) {
	const elRef = useRef<HTMLElement | null>(null);
	const registerTarget = useBoardTarget({ kind: "boss", playerId });
	const setRef = (el: HTMLElement | null) => {
		elRef.current = el;
		registerTarget(el);
	};

	const bossHighlighted = useIsLegalDropTarget({ kind: "boss", playerId });
	const bossTargetTuple = { kind: "boss" as const, playerId };
	const pickerSession = useTargetPickerSession();
	const pickTarget = useTargetPickerStore((s) => s.pickTarget);
	const pickerClickable = isTargetPickerEligible(
		pickerSession,
		bossTargetTuple,
	);

	const { isMyTurn, myPlayer } = useFaceturnState();
	const toggleCommandPopover = useBossCommandPopoverStore((s) => s.toggle);
	const commandPopoverOpen = useBossCommandPopoverStore(
		(s) => s.openForPlayerId === playerId,
	);
	const armedMove = useArmedMove();
	const disarmMove = useArmedMoveStore((s) => s.disarm);
	// own boss, my turn, command not yet spent: clicking opens the command popover
	const canOpenCommand =
		isMe && isMyTurn && Boolean(boss.id) && myPlayer
			? !myPlayer.boss.commandUsed
			: false;

	const isPulsing = pickerClickable || commandPopoverOpen;
	const onClick = canOpenCommand
		? () => {
				if (armedMove) disarmMove();
				if (elRef.current) toggleCommandPopover(playerId, elRef.current);
			}
		: pickerClickable
			? () => pickTarget(bossTargetTuple)
			: undefined;

	return (
		<div ref={setRef}>
			<BossPanel
				boss={boss}
				highlighted={bossHighlighted || isPulsing}
				exposed={exposed}
				onClick={onClick}
			/>
		</div>
	);
}

function CrewSlotCell({
	slot,
	target,
	knownCrewId,
}: {
	slot: CrewSlotView;
	target: BoardTarget;
	knownCrewId?: string | null;
}) {
	const ref = useBoardTarget(target);
	const crewTarget =
		target.kind === "crew"
			? { playerId: target.playerId, slotIndex: target.slotIndex }
			: null;
	const armed = useArmedMove();
	const pickSecondaryTarget = useArmedMoveStore((s) => s.pickSecondaryTarget);
	const { ft, playerId, isMyTurn, myPlayer } = useFaceturnState();
	const { locked: interactionLocked } = useFaceturnInteraction();
	const toggleClassActionPopover = useClassActionPopoverStore((s) => s.toggle);
	const classActionPopoverOpen = useClassActionPopoverStore(
		(s) =>
			crewTarget !== null &&
			crewTarget.playerId === playerId &&
			s.openForSlotIndex === crewTarget.slotIndex,
	);

	const isArmedTarget =
		Boolean(armed) &&
		crewTarget !== null &&
		ft !== null &&
		isValidSecondaryTarget(armed!.moveId, crewTarget, {
			state: ft,
			selfPlayerId: playerId,
		});

	const pickerSession = useTargetPickerSession();
	const pickTarget = useTargetPickerStore((s) => s.pickTarget);
	const isPickerTarget =
		crewTarget !== null &&
		isTargetPickerEligible(pickerSession, { kind: "crew", ...crewTarget });

	const pendingClassGuessTarget = usePendingClassGuessTarget();
	const confirmClassGuess = useTargetPickerStore((s) => s.confirmClassGuess);
	const cancelClassGuess = useTargetPickerStore((s) => s.close);
	const isClassGuessAnchor =
		crewTarget !== null &&
		pendingClassGuessTarget !== null &&
		pendingClassGuessTarget.kind === "crew" &&
		pendingClassGuessTarget.playerId === crewTarget.playerId &&
		pendingClassGuessTarget.slotIndex === crewTarget.slotIndex;
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

	// drag-legal highlight separate from armed/picker, same gold visual
	const isDragLegalTarget = useIsLegalDropTarget(target);

	// own face-down crew, my turn, nothing else already being resolved:
	// clicking opens the Collect/Strike/Hide popover for that card
	const isOwnFaceDownActionable =
		crewTarget !== null &&
		crewTarget.playerId === playerId &&
		slot.status === "face_down" &&
		isMyTurn &&
		Boolean(myPlayer) &&
		!armed &&
		!pickerSession;
	const canOpenClassAction = isOwnFaceDownActionable || classActionPopoverOpen;

	const clickable = isArmedTarget || isPickerTarget || canOpenClassAction;
	const isPulsing = isArmedTarget || isPickerTarget || classActionPopoverOpen;

	return (
		<div
			ref={(el) => {
				ref(el);
				setAnchorEl(el);
			}}
		>
			<CrewSlotBadge
				slot={slot}
				knownCrewId={knownCrewId}
				selectable={clickable}
				armed={isPulsing || isDragLegalTarget}
				onClick={
					clickable
						? () => {
								if (isArmedTarget) pickSecondaryTarget(slot.slotIndex);
								// resolve both systems if both eligible, avoid stranding a prompt
								if (isPickerTarget && crewTarget)
									pickTarget({ kind: "crew", ...crewTarget });
								if (canOpenClassAction && crewTarget && anchorEl) {
									toggleClassActionPopover(crewTarget.slotIndex, anchorEl);
								}
							}
						: undefined
				}
			/>
			{isClassGuessAnchor && (
				<CrewClassGuessPopover
					anchorEl={anchorEl}
					onConfirm={confirmClassGuess}
					onCancel={cancelClassGuess}
					locked={interactionLocked}
				/>
			)}
		</div>
	);
}

export function PlayerBoard({
	player,
	name,
	isActive,
	isMe,
	knownCrewAssignments,
	compact,
}: {
	player: FaceturnsPlayerView;
	name: string;
	isActive?: boolean;
	isMe?: boolean;
	knownCrewAssignments?: Readonly<Record<number, string>>;
	compact?: boolean;
}) {
	const handFull = player.handSize >= HAND_LIMIT;
	const exposed = isPlayerExposed(player);

	const { isMyTurn } = useFaceturnState();
	const activeMoveDiscardEnabled = Boolean(isMe && isMyTurn);

	const ownBoardAreaRef = useBoardTarget({
		kind: "own_board_area",
		playerId: player.playerId,
	});
	const getActiveSlotTarget = (slotIndex: number): BoardTarget => ({
		kind: "active",
		playerId: player.playerId,
		slotIndex,
	});

	const ownBoardAreaHighlighted = useIsLegalDropTarget({
		kind: "own_board_area",
		playerId: player.playerId,
	});

	if (compact) {
		return (
			<div
				ref={ownBoardAreaRef}
				className={cn(
					"ft-panel-ink flex flex-col gap-2 rounded-xl border px-3 py-3 transition-all",
					player.isEliminated && "opacity-30 grayscale",
					isActive && !player.isEliminated
						? "border-amber-400/60 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
						: "border-white/10",
				)}
				style={
					{
						"--card-vw-share": `${CREW_SLOT_CARD_SIZE}px`,
					} as React.CSSProperties
				}
			>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5 min-w-0">
						{isActive && (
							<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
						)}
						<span
							className={cn(
								"ft-eyebrow text-xs truncate",
								isActive ? "text-amber-200" : "text-white/70",
							)}
						>
							{name}
							{isMe && <span className="text-white/30"> (you)</span>}
						</span>
					</div>
					<div className="flex items-center gap-1.5 shrink-0">
						{!isMe && <OpponentHandStrip count={player.handSize} compact />}
						<CashChip amount={player.cash} />
					</div>
				</div>

				{!isMe && (
					<ActiveMoveSlots
						slots={player.activeMoveSlots}
						size="sm"
						getTargetForSlot={getActiveSlotTarget}
						discardEnabled={activeMoveDiscardEnabled}
					/>
				)}

				<BossCell
					playerId={player.playerId}
					boss={player.boss}
					exposed={exposed}
					isMe={Boolean(isMe)}
				/>

				<div className="flex gap-1.5">
					{player.crewSlots.map((slot) => (
						<CrewSlotCell
							key={slot.slotIndex}
							slot={slot}
							target={{
								kind: "crew",
								playerId: player.playerId,
								slotIndex: slot.slotIndex,
							}}
							knownCrewId={knownCrewAssignments?.[slot.slotIndex] ?? null}
						/>
					))}
				</div>

				{isMe && (
					<ActiveMoveSlots
						slots={player.activeMoveSlots}
						size="sm"
						getTargetForSlot={getActiveSlotTarget}
						discardEnabled={activeMoveDiscardEnabled}
					/>
				)}

				<BoardFooter player={player} handFull={handFull} isMe={isMe} />
				{player.isEliminated && (
					<span className="ft-eyebrow text-[9px] text-red-400/60">
						Eliminated
					</span>
				)}
			</div>
		);
	}

	return (
		<div
			ref={ownBoardAreaRef}
			className={cn(
				"flex flex-col gap-3 px-2 py-2 rounded-xl transition-all",
				player.isEliminated && "opacity-30 grayscale",
				ownBoardAreaHighlighted && "ft-drop-zone-legal",
			)}
			style={
				{ "--card-vw-share": `${CREW_SLOT_CARD_SIZE}px` } as React.CSSProperties
			}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					{isActive && (
						<span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
					)}
					<span
						className={cn(
							"ft-eyebrow text-sm truncate",
							isActive ? "text-amber-200" : "text-white/75",
						)}
					>
						{name}
						{isMe && <span className="text-white/30"> (you)</span>}
					</span>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					{!isMe && <OpponentHandStrip count={player.handSize} />}
					<CashChip amount={player.cash} />
				</div>
			</div>

			{!isMe && (
				<ActiveMoveSlots
					slots={player.activeMoveSlots}
					size="md"
					getTargetForSlot={getActiveSlotTarget}
					discardEnabled={activeMoveDiscardEnabled}
				/>
			)}

			{/* grid: boss plus crew, equal fixed tracks sized to crew card */}
			<div
				className="grid gap-2.5"
				style={{
					gridTemplateColumns: `repeat(${player.crewSlots.length + 1}, minmax(0, ${CREW_SLOT_CARD_SIZE}px))`,
				}}
			>
				<div className="flex justify-center">
					<BossCell
						playerId={player.playerId}
						boss={player.boss}
						exposed={exposed}
						isMe={Boolean(isMe)}
					/>
				</div>
				{player.crewSlots.map((slot) => (
					<div key={slot.slotIndex} className="flex justify-center">
						<CrewSlotCell
							slot={slot}
							target={{
								kind: "crew",
								playerId: player.playerId,
								slotIndex: slot.slotIndex,
							}}
							knownCrewId={knownCrewAssignments?.[slot.slotIndex] ?? null}
						/>
					</div>
				))}
			</div>

			{isMe && (
				<ActiveMoveSlots
					slots={player.activeMoveSlots}
					size="md"
					getTargetForSlot={getActiveSlotTarget}
					discardEnabled={activeMoveDiscardEnabled}
				/>
			)}

			<div className="flex items-end justify-between gap-2">
				<BoardFooter player={player} handFull={handFull} isMe={isMe} />
			</div>
			{player.isEliminated && (
				<span className="ft-eyebrow text-[9px] text-red-400/60">
					Eliminated
				</span>
			)}
		</div>
	);
}

function BoardFooter({
	player,
	handFull,
	isMe,
}: {
	player: FaceturnsPlayerView;
	handFull: boolean;
	isMe?: boolean;
}) {
	return (
		<div className="flex items-center gap-3 text-[9px] text-white/40">
			<span
				className={cn(
					"inline-flex items-center gap-1",
					handFull && "text-amber-300/70",
				)}
				title={handFull ? "Hand full — further draws are wasted" : undefined}
			>
				<HandIcon className="w-3 h-3" />
				{player.handSize}
				{handFull ? " (full)" : ""}
			</span>
			<span className="inline-flex items-center gap-1">
				<DeckIcon className="w-3 h-3" />
				{player.deckSize}
			</span>
			{isMe ? (
				<DiscardPile
					playerId={player.playerId}
					discardSize={player.discardSize}
					sellable={player.hasSellCards}
				/>
			) : (
				<span className="inline-flex items-center gap-1">
					<DiscardIcon className="w-3 h-3" />
					{player.discardSize}
				</span>
			)}
			{player.poisonStacks > 0 && (
				<span className="inline-flex items-center gap-1 text-emerald-400/70">
					<PoisonIcon className="w-3 h-3" />
					{player.poisonStacks}/rd
				</span>
			)}
		</div>
	);
}