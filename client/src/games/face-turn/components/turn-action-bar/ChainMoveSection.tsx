import { useCallback, useEffect, useState } from "react";
import { getMovePostPlacementTarget } from "@shared/games/face-turn/card-display";
import { sendFaceturnAction } from "../../actions";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useActionLock } from "../../../../hooks/network/useActionLock";
import type { DragPosition } from "../../hooks/useCardDrag";
import {
	boardTargetRegistry,
	type BoardTarget,
} from "../../hooks/boardTargetRegistry";
import { setDraggedOverTarget } from "../../hooks/draggedOverTargetStore";
import { isValidMoveTarget } from "../../lib/moveTargetLegality";
import { useArmedMove, useArmedMoveStore } from "../../hooks/useArmedMove";
import { useHandControllerStore } from "../../hooks/handControllerStore";
import { resolveChainPlayAction } from "../../lib/resolvePlayMoveAction";

export function ChainMoveSection() {
	const { ft, secret, playerId, isChainParticipant } = useFaceturnState();

	const chainLength = ft?.moveChain?.chain.length ?? 0;

	const armed = useArmedMove();
	const arm = useArmedMoveStore((s) => s.arm);
	const disarm = useArmedMoveStore((s) => s.disarm);
	const setOnComplete = useArmedMoveStore((s) => s.setOnComplete);
	const setHandController = useHandControllerStore((s) => s.setHandController);

	const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);

	const { locked, runLocked } = useActionLock(
		chainLength,
		undefined,
		() => {
			setSelectedMoveId(null);
			disarm();
		},
		true,
	);

	// clear armed pick when chain length changes (priority moved on)
	const [prevChainLength, setPrevChainLength] = useState(chainLength);
	const chainLengthChanged = prevChainLength !== chainLength;
	if (chainLengthChanged) {
		setPrevChainLength(chainLength);
		setSelectedMoveId(null);
	}
	useEffect(() => {
		if (!chainLengthChanged) return;
		disarm();
	}, [chainLengthChanged, disarm]);

	useEffect(() => disarm, [disarm]);

	useEffect(() => {
		if (!armed) return;
		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			disarm();
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [armed, disarm]);

	// server decides what's playable, client only checks chainPlayableMoveIds
	const isPlayable = useCallback(
		(moveId: string) => secret?.chainPlayableMoveIds.includes(moveId) ?? false,
		[secret],
	);

	const playChainMove = useCallback(
		(
			moveId: string,
			primaryTarget: BoardTarget,
			secondaryPick?: { slotIndex: number },
		) => {
			runLocked(() => {
				sendFaceturnAction(
					resolveChainPlayAction(moveId, primaryTarget, secondaryPick),
				);
			});
			setSelectedMoveId(null);
		},
		[runLocked],
	);

	// armed completion mirrors TurnActionBar
	useEffect(() => {
		setOnComplete((moveId, primaryTarget, secondaryPick) => {
			// re-check priority is still ours before sending
			if (!secret?.chainPlayableMoveIds.includes(moveId)) {
				disarm();
				return;
			}
			playChainMove(moveId, primaryTarget, secondaryPick);
		});
		return () => setOnComplete(null);
	}, [setOnComplete, disarm, playChainMove, secret]);

	// board geometry only, legality per-card in isValidTarget
	const getTargetAt = useCallback((point: DragPosition): BoardTarget | null => {
		const target = boardTargetRegistry.getTargetAt(point);
		setDraggedOverTarget(target);
		return target;
	}, []);

	const isValidTarget = useCallback(
		(target: BoardTarget, moveId: string): boolean => {
			if (!ft) return false;
			return isValidMoveTarget(moveId, target, {
				state: ft,
				selfPlayerId: playerId,
			});
		},
		[ft, playerId],
	);

	const handleDrop = useCallback(
		(moveId: string, target: BoardTarget) => {
			if (!isPlayable(moveId)) return;
			if (getMovePostPlacementTarget(moveId) !== null) {
				// needs secondary pick, arm instead of completing
				arm(moveId, target);
				return;
			}
			playChainMove(moveId, target);
		},
		[isPlayable, arm, playChainMove],
	);

	const handleSelect = useCallback(
		(id: string) => {
			if (!isPlayable(id)) return;
			setSelectedMoveId((prev) => (id === prev ? null : id));
		},
		[isPlayable],
	);

	useEffect(() => {
		if (!isChainParticipant) return;
		setHandController<BoardTarget>({
			getPlayable: isPlayable,
			selectedId: selectedMoveId,
			armedId: armed?.moveId ?? null,
			disabled: locked,
			onSelect: handleSelect,
			dragEnabled: !locked && !armed,
			getTargetAt,
			isValidTarget,
			onDrop: handleDrop,
		});
		return () => setHandController(null);
	}, [
		isChainParticipant,
		setHandController,
		isPlayable,
		selectedMoveId,
		armed,
		locked,
		handleSelect,
		getTargetAt,
		isValidTarget,
		handleDrop,
	]);

	return null;
}