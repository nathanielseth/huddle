import "../../board.css";
import { useCallback, useEffect } from "react";
import { getMovePostPlacementTarget } from "@shared/games/face-turn/card-display";
import { SectionTitle } from "../SectionTitle";
import type { DragPosition } from "../../hooks/useCardDrag";
import {
	boardTargetRegistry,
	type BoardTarget,
} from "../../hooks/boardTargetRegistry";
import { setDraggedOverTarget } from "../../hooks/draggedOverTargetStore";
import { isValidMoveTarget } from "../../lib/moveTargetLegality";
import { useArmedMove, useArmedMoveStore } from "../../hooks/useArmedMove";
import { useHandControllerStore } from "../../hooks/handControllerStore";
import type { FaceturnsState } from "@shared/games/face-turn/types";

export function PlayMoveSection({
	getCost,
	getPlayable,
	selectedMoveId,
	onSelectMove,
	playerId,
	state,
	locked,
	cash,
	hasSellCards,
	onDropPlay,
	onDropSell,
	onArm,
}: {
	getCost: (moveId: string) => number;
	getPlayable: (moveId: string) => boolean;
	selectedMoveId: string | null;
	onSelectMove: (moveId: string) => void;
	playerId: string;
	state: FaceturnsState;
	locked: boolean;
	cash: number;
	hasSellCards: boolean;
	onDropPlay: (moveId: string, primaryTarget: BoardTarget) => void;
	onDropSell: (moveId: string) => void;
	onArm: () => void;
}) {
	const arm = useArmedMoveStore((s) => s.arm);
	const armed = useArmedMove();
	const setHandController = useHandControllerStore((s) => s.setHandController);

	// getTargetAt fires continuously during a drag
	useEffect(() => {
		const clear = () => setDraggedOverTarget(null);
		window.addEventListener("pointerup", clear);
		window.addEventListener("pointercancel", clear);
		return () => {
			window.removeEventListener("pointerup", clear);
			window.removeEventListener("pointercancel", clear);
		};
	}, []);

	// board geometry only, legality handled per-card in isValidTarget
	const getTargetAt = useCallback((point: DragPosition): BoardTarget | null => {
		const target = boardTargetRegistry.getTargetAt(point);
		setDraggedOverTarget(target);
		return target;
	}, []);

	const isValidTarget = useCallback(
		(target: BoardTarget, moveId: string): boolean => {
			// sell is unconditional on card playability, gated only on hasSellCards
			if (target.kind === "discard") return hasSellCards;
			return isValidMoveTarget(moveId, target, {
				state,
				selfPlayerId: playerId,
			});
		},
		[hasSellCards, state, playerId],
	);

	const cost = selectedMoveId ? getCost(selectedMoveId) : 0;

	const handleDrop = useCallback(
		(moveId: string, target: BoardTarget) => {
			if (target.kind === "discard") {
				onDropSell(moveId);
				return;
			}
			if (getMovePostPlacementTarget(moveId) !== null) {
				// needs a secondary pick, arm instead of completing
				arm(moveId, target);
				onArm();
				return;
			}
			onDropPlay(moveId, target);
		},
		[onDropSell, arm, onArm, onDropPlay],
	);

	// register hand controller and slots together; disable drag while armed to prevent overlap
	// boardtarget passes as object, handcontroller<T> generic avoids string serialization for movechainbar
	useEffect(() => {
		setHandController<BoardTarget>({
			getPlayable,
			selectedId: selectedMoveId,
			armedId: armed?.moveId ?? null,
			disabled: locked,
			onSelect: onSelectMove,
			dragEnabled: !locked && !armed,
			getTargetAt,
			isValidTarget,
			onDrop: handleDrop,
		});
		return () => setHandController(null);
	}, [
		setHandController,
		getPlayable,
		selectedMoveId,
		armed,
		locked,
		onSelectMove,
		getTargetAt,
		isValidTarget,
		handleDrop,
	]);

	return (
		<div className="flex flex-col gap-1">
			<SectionTitle>
				Play a move
				{hasSellCards && (
					<span className="text-white/30">
						{" "}
						— or drag to the discard pile to sell
					</span>
				)}
			</SectionTitle>
			{selectedMoveId && cost > cash && (
				<p className="text-[10px] text-white/25">
					Need ₱{cost}, you have ₱{cash}
				</p>
			)}
		</div>
	);
}