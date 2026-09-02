import "../board.css";
import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { getMoveDisplay } from "@shared/games/face-turn/card-display";
import { cn } from "../../../lib/utils/cn";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useReducedMotion } from "../../../hooks/a11y/useReducedMotion";
import { useBoardTarget } from "../hooks/boardTargetRegistry";
import { useIsLegalDropTarget } from "../lib/moveTargetLegality";
import { useArmedMove, useArmedMoveStore } from "../hooks/useArmedMove";
import { useMovePlayFlash } from "../hooks/useMovePlayFlash";
import { useChainLeeway } from "../lib/animation/useChainLeeway";
import { useChainReplay } from "../lib/animation/useChainReplay";
import { describeChainResolutionStep } from "../lib/describeEvent";
import { Card } from "./card/Card";
import { moveToCard } from "./card/cardAdapters";
import { useCardInspect } from "./card/useCardInspect";
import { useHoverPreview } from "./hand/useHoverPreview";
import { ChainStack, type ChainStackEntry } from "./move-chain/ChainStack";

const FLASH_CARD_SIZE = 170;
const ARMED_CARD_SIZE = 170;

export function RailMoveArea() {
	const { ft, playerId, playerMap, isChainParticipant } = useFaceturnState();

	const ref = useBoardTarget({ kind: "own_board_area", playerId });
	const dropHighlighted = useIsLegalDropTarget({
		kind: "own_board_area",
		playerId,
	});
	const armed = useArmedMove();
	const flash = useMovePlayFlash(ft?.log ?? []);

	const chainOpen = Boolean(
		ft && ft.phase === "move_chain_window" && ft.moveChain,
	);
	const leewayEntries = useChainLeeway(ft?.moveChain?.chain);

	const [wasParticipant, setWasParticipant] = useState(false);
	if (chainOpen && wasParticipant !== isChainParticipant) {
		setWasParticipant(isChainParticipant);
	}
	const replay = useChainReplay(
		ft?.lastChainResolution,
		wasParticipant,
		ft?.phase === "finished" || chainOpen,
	);

	if (!ft) return null;

	const chainRelevant = chainOpen && isChainParticipant;
	const showChain = chainRelevant || (replay.active && wasParticipant);
	const showArmed = Boolean(armed);
	const showFlash = Boolean(flash.current) && !showArmed && !showChain;

	return (
		<div
			ref={ref}
			className={cn(
				"flex-1 min-h-0 flex flex-col gap-2 px-4 py-3 border-b border-white/10 transition-all",
				dropHighlighted && "ft-drop-zone-legal",
			)}
		>
			{!showChain && (
				<span className="ft-eyebrow text-[9px] font-black tracking-widest uppercase text-white/25">
					Move area
				</span>
			)}

			<div
				className="flex-1 min-h-0 flex flex-col overflow-hidden"
			>
				{showChain ? (
					<div className="flex flex-col items-center justify-start h-full pt-1">
						<ChainAreaContent
							chainOpen={chainRelevant}
							replayActive={replay.active}
							replayResolution={replay.resolution}
							replayStepIndex={replay.stepIndex}
							resolutionOrder={[...leewayEntries].reverse()}
							isChainParticipant={isChainParticipant}
							playerMap={playerMap}
						/>
					</div>
				) : showArmed ? (
					<div className="flex items-center justify-center h-full">
						<ArmedCardPreview moveId={armed!.moveId} />
					</div>
				) : showFlash ? (
					<div className="flex items-center justify-center h-full">
						<MovePlayFlashCard
							key={flash.current!.id}
							flash={flash.current!}
							playerMap={playerMap}
							onExited={flash.onExited}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}

function ArmedCardPreview({ moveId }: { moveId: string }) {
	const move = getMoveDisplay(moveId);
	const cardProps = moveToCard(move);
	const disarm = useArmedMoveStore((s) => s.disarm);
	const { inspect } = useCardInspect();
	const hoverPreviewProps = useHoverPreview(cardProps);

	return (
		<div className="flex flex-col items-center gap-2">
			<div
				onContextMenu={(e) => {
					e.preventDefault();
					inspect(cardProps);
				}}
				{...hoverPreviewProps}
			>
				<Card {...cardProps} size={ARMED_CARD_SIZE} armed />
			</div>
			<div className="flex items-center gap-2">
				<span className="ft-eyebrow text-[11px] text-amber-200/90">
					Pick a target
				</span>
				<span className="text-white/20">·</span>
				<button
					type="button"
					onClick={disarm}
					className="ft-eyebrow text-[11px] text-white/40 hover:text-white/70 cursor-pointer"
				>
					Cancel
				</button>
			</div>
		</div>
	);
}

const FLIP_REVEAL_DELAY_MS = 120;

function MovePlayFlashCard({
	flash,
	playerMap,
	onExited,
}: {
	flash: NonNullable<ReturnType<typeof useMovePlayFlash>["current"]>;
	playerMap: Record<string, { name: string }>;
	onExited: () => void;
}) {
	const reducedMotion = useReducedMotion();
	const move = getMoveDisplay(flash.moveId);
	const cardProps = moveToCard(move);
	const { inspect } = useCardInspect();
	const hoverPreviewProps = useHoverPreview(cardProps);
	const actorName = playerMap[flash.actorId]?.name ?? flash.actorId;
	const targetName = flash.targetPlayerId
		? (playerMap[flash.targetPlayerId]?.name ?? flash.targetPlayerId)
		: null;

	const [revealed, setRevealed] = useState(reducedMotion);
	useEffect(() => {
		if (reducedMotion) return;
		const t = setTimeout(() => setRevealed(true), FLIP_REVEAL_DELAY_MS);
		return () => clearTimeout(t);
	}, [reducedMotion]);

	const transition = { duration: reducedMotion ? 0 : 0.2, ease: [0.4, 0, 0.2, 1] as const };

	return (
		<AnimatePresence mode="wait" onExitComplete={onExited}>
			<m.div
				key={flash.id}
				initial={{ opacity: 0, scale: 0.9 }}
				animate={{ opacity: 1, scale: 1, transition }}
				exit={{ opacity: 0, scale: 0.95, transition }}
				className="flex flex-col items-center gap-2"
			>
				<div
					onContextMenu={(e) => {
						e.preventDefault();
						inspect(cardProps);
					}}
					{...hoverPreviewProps}
				>
					<Card {...cardProps} size={FLASH_CARD_SIZE} flipped={!revealed} />
				</div>
				<div className="flex items-center gap-1.5 leading-tight">
					<span className="ft-eyebrow text-[11px] text-white/80">
						{actorName}
					</span>
					{targetName && (
						<>
							<span className="text-white/20">→</span>
							<span className="text-[11px] text-white/50">{targetName}</span>
						</>
					)}
				</div>
			</m.div>
		</AnimatePresence>
	);
}

function ChainAreaContent({
	chainOpen,
	replayActive,
	replayResolution,
	replayStepIndex,
	resolutionOrder,
	isChainParticipant,
	playerMap,
}: {
	chainOpen: boolean;
	replayActive: boolean;
	replayResolution: ReturnType<typeof useChainReplay>["resolution"];
	replayStepIndex: number | null;
	resolutionOrder: ReturnType<typeof useChainLeeway>;
	isChainParticipant: boolean;
	playerMap: Record<string, { id: string; name: string; score: number }>;
}) {
	if (replayActive && replayResolution && replayStepIndex !== null) {
		const step = replayResolution.steps[replayStepIndex];
		const moveId = step.kind === "executed" ? step.moveId : step.negatorMoveId;
		const actorId =
			step.kind === "executed" ? step.actorId : step.negatorActorId;
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
			<div className="flex flex-col items-center gap-2 w-full">
				<ChainStack entries={[entry]} playerMap={playerMap} variant="host" />
				<span className="ft-eyebrow text-[10px] text-amber-200/80">
					{describeChainResolutionStep(step, playerMap)}
				</span>
			</div>
		);
	}

	if (!chainOpen || !isChainParticipant) return null;

	return (
		<ChainStack
			entries={resolutionOrder}
			playerMap={playerMap}
			variant="responder"
		/>
	);
}