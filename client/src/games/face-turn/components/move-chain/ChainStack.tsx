import "../../board.css";
import { getMoveDisplay } from "@shared/games/face-turn/card-display";
import { cn } from "../../../../lib/utils/cn";
import { Card } from "../card/Card";
import { moveToCard } from "../card/cardAdapters";
import { useCardInspect } from "../card/useCardInspect";
import { useHoverPreview } from "../hand/useHoverPreview";
import { useReducedMotion } from "../../../../hooks/a11y/useReducedMotion";
import type { MoveChainEntry } from "@shared/games/face-turn/types";

export type ChainStackVariant = "responder" | "spectator" | "host";

export type ChainStackEntry = MoveChainEntry & { resolving?: boolean };

const VARIANT_CARD_SIZE: Record<ChainStackVariant, number> = {
	responder: 92,
	spectator: 92,
	host: 78,
};

const VARIANT_TITLE: Record<ChainStackVariant, string> = {
	responder: "The chain",
	spectator: "Chain in progress",
	host: "Chain in progress",
};

const STACK_OVERLAP = 0.42;
const STACK_RISE_PX = 10;

function ChainStackCard({
	entry,
	index,
	entryCount,
	cardSize,
	actorName,
	reducedMotion,
	inspect,
}: {
	entry: ChainStackEntry;
	index: number;
	entryCount: number;
	cardSize: number;
	actorName: string;
	reducedMotion: boolean;
	inspect: (card: ReturnType<typeof moveToCard>) => void;
}) {
	const move = getMoveDisplay(entry.moveId);
	const cardProps = moveToCard(move);
	const hoverPreviewProps = useHoverPreview(cardProps);
	const resolving = entry.resolving ?? false;
	const resolvingLift = resolving && !reducedMotion ? 22 : 0;

	return (
		<div
			className={cn(
				"absolute bottom-0 left-0",
				reducedMotion ? "transition-opacity" : "transition-[transform,opacity]",
			)}
			style={{
				transform: `translateX(${index * cardSize * (1 - STACK_OVERLAP)}px) translateY(${-index * STACK_RISE_PX - resolvingLift}px) scale(${resolving && !reducedMotion ? 1.05 : 1})`,
				transitionDuration: reducedMotion ? "0.15s" : "0.4s",
				zIndex: resolving ? entryCount + 1 : index,
				opacity: resolving ? 0 : 1,
			}}
			title={`${index + 1}. ${move.name} — ${actorName}`}
			onContextMenu={(e) => {
				e.preventDefault();
				inspect(cardProps);
			}}
			{...hoverPreviewProps}
		>
			<Card {...cardProps} size={cardSize} />
		</div>
	);
}

export function ChainStack({
	entries,
	playerMap,
	variant,
	waitingOnName,
}: {
	// index 0 is next to resolve, drawn topmost
	entries: readonly ChainStackEntry[];
	playerMap: Record<string, { id: string; name: string; score: number }>;
	variant: ChainStackVariant;
	waitingOnName?: string | null;
}) {
	const cardSize = VARIANT_CARD_SIZE[variant];
	const reducedMotion = useReducedMotion();
	const { inspect, modal: inspectModal } = useCardInspect();

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-2">
				<span className="ft-eyebrow text-[10px] text-white/50">
					{VARIANT_TITLE[variant]}
				</span>
				{variant !== "responder" && waitingOnName && (
					<span className="ft-eyebrow text-[9px] text-white/30">
						Waiting on {waitingOnName}
					</span>
				)}
			</div>

			{entries.length === 0 ? (
				<div
					className="ft-panel-ink-flat flex items-center justify-center rounded-xl border border-dashed border-white/15"
					style={{
						width: cardSize * 1.6,
						height: (cardSize * 88) / 63,
					}}
				>
					<span className="ft-eyebrow text-[10px] text-white/25">Empty</span>
				</div>
			) : (
				<div
					className="relative flex items-end"
					style={{
						// reserve width/height for overlap, rise, and resolving lift
						width:
							cardSize + (entries.length - 1) * cardSize * (1 - STACK_OVERLAP),
						height:
							(cardSize * 88) / 63 + STACK_RISE_PX * (entries.length - 1) + 24,
					}}
				>
					{entries.map((entry, i) => (
						<ChainStackCard
							key={`${entry.moveId}-${i}`}
							entry={entry}
							index={i}
							entryCount={entries.length}
							cardSize={cardSize}
							actorName={playerMap[entry.actorId]?.name ?? entry.actorId}
							reducedMotion={reducedMotion}
							inspect={inspect}
						/>
					))}
				</div>
			)}
			{inspectModal}
		</div>
	);
}