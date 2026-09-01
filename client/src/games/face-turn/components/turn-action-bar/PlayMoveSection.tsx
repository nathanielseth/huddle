import "../../board.css";
import { useCallback, useEffect } from "react";
import { getMovePostPlacementTarget } from "@shared/games/face-turn/card-display";
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
	getPlayable,
	playerId,
	state,
	locked,
	hasSellCards,
	onDropPlay,
	onDropSell,
	onArm,
}: {
	getPlayable: (moveId: string) => boolean;
	playerId: string;
	state: FaceturnsState;
	locked: boolean;
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
			disabled: locked,
			armedId: armed?.moveId ?? null,
			dragEnabled: !locked && !armed,
			getTargetAt,
			isValidTarget,
			onDrop: handleDrop,
		});
		return () => setHandController(null);
	}, [setHandController, getPlayable, armed, locked, getTargetAt, isValidTarget, handleDrop]);

	return null;
}
