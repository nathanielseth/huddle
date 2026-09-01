import "../board.css";
import { useCallback, useEffect, useState } from "react";
import { getMovePostPlacementTarget } from "@shared/games/face-turn/card-display";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { useCardFlip } from "../lib/animation/useCardFlip";
import {
	useChainLeeway,
	type LeewayChainEntry,
} from "../lib/animation/useChainLeeway";
import { useChainReplay } from "../lib/animation/useChainReplay";
import { describeChainResolutionStep } from "../lib/describeEvent";
import { useHandControllerStore } from "../hooks/handControllerStore";
import { ChainStack, type ChainStackEntry } from "./move-chain/ChainStack";
import type { DragPosition } from "../hooks/useCardDrag";
import {
	boardTargetRegistry,
	type BoardTarget,
} from "../hooks/boardTargetRegistry";
import { setDraggedOverTarget } from "../hooks/draggedOverTargetStore";
import { isValidMoveTarget } from "../lib/moveTargetLegality";
import { useArmedMove, useArmedMoveStore } from "../hooks/useArmedMove";
import { resolveChainPlayAction } from "../lib/resolvePlayMoveAction";

export function MoveChainBar() {
	const { ft, playerId, isChainParticipant, isChainResponder, playerMap } =
		useFaceturnState();

	const leewayEntries = useChainLeeway(ft?.moveChain?.chain);

	const chainOpen = Boolean(
		ft && ft.phase === "move_chain_window" && ft.moveChain,
	);

	// keep participant state after chain closes for replay
	const [wasParticipant, setWasParticipant] = useState(false);
	if (chainOpen && wasParticipant !== isChainParticipant) {
		setWasParticipant(isChainParticipant);
	}

	const replay = useChainReplay(
		ft?.lastChainResolution,
		wasParticipant,
		ft?.phase === "finished" || chainOpen,
	);

	if (!chainOpen && !replay.active) return null;
	if (!chainOpen && replay.active && !wasParticipant) return null;

	if (replay.active && replay.resolution && replay.stepIndex !== null) {
		return (
			<ChainReplayBar
				resolution={replay.resolution}
				stepIndex={replay.stepIndex}
				playerMap={playerMap}
			/>
		);
	}

	if (!ft || !ft.moveChain) return null;
	if (!isChainParticipant) return null;

	const chain = ft.moveChain;
	const resolutionOrder = [...leewayEntries].reverse();

	return (
		<ChainParticipantBar
			resolutionOrder={resolutionOrder}
			chainLength={chain.chain.length}
			isResponder={isChainResponder}
			playerId={playerId}
			playerMap={playerMap}
		/>
	);
}

function ChainReplayBar({
	resolution,
	stepIndex,
	playerMap,
}: {
	resolution: NonNullable<ReturnType<typeof useChainReplay>["resolution"]>;
	stepIndex: number;
	playerMap: ReturnType<typeof useFaceturnState>["playerMap"];
}) {
	const step = resolution.steps[stepIndex];
	const moveId = step.kind === "executed" ? step.moveId : step.negatorMoveId;
	const actorId = step.kind === "executed" ? step.actorId : step.negatorActorId;
	const entry: ChainStackEntry = {
		moveId,
		actorId,
		targetCrewSlot: null,
		targetAllySlot: null,
		targetPlayerId: null,
		cashCost: 0,
		resolving: false,
	};

	return (
		<div className="flex flex-col gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/5 px-5 py-4">
			<ChainStack entries={[entry]} playerMap={playerMap} variant="host" />
			<span className="ft-eyebrow text-[11px] text-amber-200/80 text-center">
				{describeChainResolutionStep(step, playerMap)}
			</span>
		</div>
	);
}

function ChainParticipantBar({
	resolutionOrder,
	chainLength,
	isResponder,
	playerId,
	playerMap,
}: {
	resolutionOrder: readonly LeewayChainEntry[];
	chainLength: number;
	isResponder: boolean;
	playerId: string;
	playerMap: ReturnType<typeof useFaceturnState>["playerMap"];
}) {
	const { secret, ft } = useFaceturnState();

	const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null);

	const armed = useArmedMove();
	const arm = useArmedMoveStore((s) => s.arm);
	const disarm = useArmedMoveStore((s) => s.disarm);
	const setOnComplete = useArmedMoveStore((s) => s.setOnComplete);

	const { ref: chainAreaRef, play: playChainAreaFlip } = useCardFlip();

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
			playChainAreaFlip();
			runLocked(() => {
				sendFaceturnAction(
					resolveChainPlayAction(moveId, primaryTarget, secondaryPick),
				);
			});
			setSelectedMoveId(null);
		},
		[playChainAreaFlip, runLocked],
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

	const setHandController = useHandControllerStore((s) => s.setHandController);
	useEffect(() => {
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

	const topEntry = ft?.moveChain?.chain[ft.moveChain.chain.length - 1] ?? null;

	return (
		<div
			ref={chainAreaRef as React.RefObject<HTMLDivElement>}
			className="ft-panel-ink relative flex flex-col gap-3 rounded-2xl border border-white/15 px-5 py-4 pt-4.5 overflow-hidden"
		>
			<div className="absolute top-0 left-0 right-0 h-0.75 bg-sky-400" />
			<ChainStack
				entries={resolutionOrder}
				playerMap={playerMap}
				variant="responder"
			/>
			{isResponder ? (
				<span className="ft-eyebrow text-[10px] text-amber-200/80 text-center">
					Drag a card onto the board to respond, or pass
				</span>
			) : (
				<span className="ft-eyebrow text-[10px] text-white/40 text-center">
					Waiting on{" "}
					{playerMap[topEntry?.actorId ?? ""]?.name ?? "your opponent"} to pass
					or add another move
				</span>
			)}
			<button
				type="button"
				disabled={locked || !isResponder}
				title={isResponder ? undefined : "It's not your turn to pass"}
				onClick={() => {
					runLocked(() => {
						sendFaceturnAction({ type: "chain_pass" });
					});
				}}
				className={`self-start px-4 py-2 rounded-lg border text-sm font-bold transition-all ${
					locked || !isResponder
						? "border-white/5 text-white/10 cursor-not-allowed"
						: "ft-panel-ink border-white/15 text-white/60 cursor-pointer hover:text-white/90"
				}`}
			>
				Pass
			</button>
		</div>
	);
}