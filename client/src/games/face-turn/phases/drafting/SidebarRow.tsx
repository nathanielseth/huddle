import type { CSSProperties, ReactNode } from "react";
import { CARD_VARIANT_THEME } from "../../components/card/cardVariants";
import { CARD_VARIANT_ICON } from "../../components/card/cardIconRegistry";
import { MOVE_TAG_LABEL } from "../../components/card/cardAdapters";
import { Card, type CardProps } from "../../components/card/Card";
import { cn } from "../../../../lib/utils/cn";
import type { CrewClass, MoveType } from "@shared/games/face-turn/types";
import {
	useDraftDropTarget,
	useIsDraftDraggedOverTarget,
} from "./draftDropTargets";

export type PickedEntry =
	| { kind: "boss"; id: string; name: string; artSrc?: string }
	| {
			kind: "crew";
			id: string;
			name: string;
			crewClass: CrewClass;
			isReserve?: boolean;
			artSrc?: string;
	  }
	| {
			kind: "move";
			id: string;
			name: string;
			baseCost: number;
			moveType: MoveType;
			artSrc?: string;
	  };

function entryVariant(entry: PickedEntry) {
	if (entry.kind === "boss") return "boss" as const;
	if (entry.kind === "crew") return entry.crewClass;
	return entry.moveType;
}

function entryVariantLabel(entry: PickedEntry): string {
	if (entry.kind === "boss") return "Boss";
	if (entry.kind === "crew") return CARD_VARIANT_THEME[entry.crewClass].label;
	return MOVE_TAG_LABEL[entry.moveType];
}

function ArtThumb({ entry }: { entry: PickedEntry }) {
	return (
		<span className="shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-black/30 border border-white/10">
			{entry.artSrc ? (
				<img
					src={entry.artSrc}
					alt=""
					draggable={false}
					className="w-full h-full object-cover"
					onError={(e) => {
						e.currentTarget.style.display = "none";
					}}
				/>
			) : null}
		</span>
	);
}

function TrailingBadge({ entry }: { entry: PickedEntry }) {
	const variant = entryVariant(entry);
	const theme = CARD_VARIANT_THEME[variant];

	if (entry.kind === "move") {
		return (
			<span
				className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-black tabular-nums text-white border border-white/25 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
				style={{ backgroundColor: theme.badgeCircle }}
			>
				{entry.baseCost}
			</span>
		);
	}

	const VariantIcon = CARD_VARIANT_ICON[variant];
	return (
		<span
			title={entryVariantLabel(entry)}
			className="shrink-0 flex items-center justify-center w-6 h-6 rounded-full border"
			style={{
				borderColor: `${theme.accent}aa`,
				backgroundColor: theme.badgeCircle,
			}}
		>
			<VariantIcon className="w-3.5 h-3.5" />
		</span>
	);
}

export function SidebarRow({
	entry,
	onDeselect,
	onInspect,
}: {
	entry: PickedEntry;
	onDeselect: () => void;
	onInspect?: (entry: PickedEntry) => void;
}) {
	const theme = CARD_VARIANT_THEME[entryVariant(entry)];

	return (
		<button
			type="button"
			onClick={onDeselect}
			onContextMenu={(e) => {
				if (!onInspect) return;
				e.preventDefault();
				onInspect(entry);
			}}
			title={`${entryVariantLabel(entry)} · click to remove · right-click to inspect`}
			className="w-full flex items-center gap-3 px-4 py-2 border-b border-black/20 text-left transition-colors cursor-pointer"
			style={{ backgroundColor: `${theme.accent}1f` }}
			onMouseEnter={(e) => {
				e.currentTarget.style.backgroundColor = `${theme.accent}38`;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.backgroundColor = `${theme.accent}1f`;
			}}
		>
			<ArtThumb entry={entry} />
			<span className="min-w-0 flex-1 flex items-center gap-2">
				<span className="text-sm font-bold text-white/90 truncate">
					{entry.name}
				</span>
				{entry.kind === "crew" && entry.isReserve && (
					<span className="shrink-0 ml-auto px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-amber-400/40 bg-amber-400/10 text-amber-300">
						Reserve
					</span>
				)}
			</span>
			<TrailingBadge entry={entry} />
		</button>
	);
}

function ExpandedPickedCard({
	entry,
	cardProps,
	cardSize,
	onDeselect,
	onInspect,
}: {
	entry: PickedEntry;
	cardProps: CardProps | undefined;
	cardSize: number;
	onDeselect: () => void;
	onInspect?: (entry: PickedEntry) => void;
}) {
	if (!cardProps) return null;
	return (
		<div
			className="relative min-w-0"
			onContextMenu={(e) => {
				if (!onInspect) return;
				e.preventDefault();
				onInspect(entry);
			}}
		>
			{entry.kind === "crew" && entry.isReserve && (
				<span className="absolute top-1 left-1 z-1 px-1 py-px rounded text-[7px] font-black uppercase tracking-wide border border-amber-400/50 bg-amber-400/15 text-amber-300 shadow-sm">
					Reserve
				</span>
			)}
			<Card {...cardProps} size={cardSize} onClick={onDeselect} />
		</div>
	);
}

// drop target: registers for pointer drag, clickable to jump to tab, hover via registry or css
function DropSlot({
	kind,
	label,
	compact,
	onNavigateToTab,
}: {
	kind: PickedEntry["kind"];
	label: string;
	compact: boolean;
	onNavigateToTab?: (kind: PickedEntry["kind"]) => void;
}) {
	const ref = useDraftDropTarget(kind);
	const draggedOver = useIsDraftDraggedOverTarget(kind);

	return (
		<button
			type="button"
			ref={ref}
			onClick={() => onNavigateToTab?.(kind)}
			title={`Add ${label.toLowerCase()} - click to browse, or drag a card here`}
			className={cn(
				"flex items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors cursor-pointer",
				compact
					? "mx-5 my-2 h-14 px-31 text-[10px] font-black uppercase tracking-widest"
					: "aspect-63/88 text-[9px] font-black uppercase tracking-wide leading-tight px-1",
				draggedOver
					? "border-white/50 bg-white/12 text-white"
					: "border-white/15 bg-black/35 text-white/40 hover:border-white/50 hover:bg-white/12 hover:text-white",
			)}
		>
			{`Add ${label.toLowerCase()}`}
		</button>
	);
}

const EXPANDED_GRID_COLUMNS = 4;
const EXPANDED_GRID_GAP = 8;
const EXPANDED_GRID_PADDING_X = 14;

function ExpandedGrid({
	cardSize,
	children,
}: {
	cardSize: number;
	children: ReactNode;
}) {
	return (
		<div
			className="grid"
			style={
				{
					gridTemplateColumns: `repeat(${EXPANDED_GRID_COLUMNS}, ${cardSize}px)`,
					gap: `${EXPANDED_GRID_GAP}px`,
					padding: `${EXPANDED_GRID_GAP}px ${EXPANDED_GRID_PADDING_X}px`,
					// set var to pin exact card size, clamp alone won't hold to track
					"--card-vw-share": `${cardSize}px`,
				} as CSSProperties
			}
		>
			{children}
		</div>
	);
}

function SectionHeader({
	label,
	current,
	max,
	accent,
}: {
	label: string;
	current: number;
	max: number;
	accent: string;
}) {
	return (
		<div className="sticky top-0 z-1 flex items-center gap-2 px-4 py-1.5 bg-black/70 backdrop-blur-sm border-b border-white/5">
			<span
				className="w-1.5 h-1.5 rounded-full shrink-0"
				style={{ backgroundColor: accent }}
			/>
			<p className="text-[10px] font-black tracking-widest uppercase text-white/40 flex-1">
				{label}
			</p>
			<span
				className={cn(
					"text-[10px] font-black tabular-nums",
					current === max ? "text-emerald-300" : "text-white/30",
				)}
			>
				{current}/{max}
			</span>
		</div>
	);
}

export function PickedSidebarSections({
	entries,
	crewMax,
	moveMax,
	onDeselect,
	onInspect,
	dropEnabled = false,
	onNavigateToTab,
	variant = "compact",
	cardPropsByKey,
	cardSize,
}: {
	entries: readonly PickedEntry[];
	crewMax: number;
	moveMax: number;
	onDeselect: (entry: PickedEntry) => void;
	onInspect?: (entry: PickedEntry) => void;
	dropEnabled?: boolean;
	onNavigateToTab?: (kind: PickedEntry["kind"]) => void;
	variant?: "compact" | "expanded";
	cardPropsByKey?: ReadonlyMap<string, CardProps>;
	cardSize?: number;
}) {
	const boss = entries.find((e) => e.kind === "boss");
	const crew = entries.filter((e) => e.kind === "crew");
	const moves = entries.filter((e) => e.kind === "move");
	const expanded = variant === "expanded" && cardPropsByKey && cardSize;

	function renderEntry(entry: PickedEntry) {
		if (expanded) {
			return (
				<ExpandedPickedCard
					key={`${entry.kind}-${entry.id}`}
					entry={entry}
					cardProps={cardPropsByKey.get(`${entry.kind}-${entry.id}`)}
					cardSize={cardSize}
					onDeselect={() => onDeselect(entry)}
					onInspect={onInspect}
				/>
			);
		}
		return (
			<SidebarRow
				key={`${entry.kind}-${entry.id}`}
				entry={entry}
				onDeselect={() => onDeselect(entry)}
				onInspect={onInspect}
			/>
		);
	}

	function renderSection(
		label: string,
		kind: PickedEntry["kind"],
		items: PickedEntry[],
		max: number,
	) {
		const dropSlot =
			dropEnabled && items.length < max ? (
				<DropSlot
					key={`drop-${kind}`}
					kind={kind}
					label={label}
					compact={!expanded}
					onNavigateToTab={onNavigateToTab}
				/>
			) : null;

		if (items.length === 0 && !dropSlot) {
			return (
				<p className="px-4 py-3 text-[11px] text-white/25">Not picked yet</p>
			);
		}

		const rendered = [...items.map(renderEntry), dropSlot];
		return expanded ? (
			<ExpandedGrid cardSize={cardSize}>{rendered}</ExpandedGrid>
		) : (
			rendered
		);
	}

	return (
		<div>
			<div>
				<SectionHeader
					label="Boss"
					current={boss ? 1 : 0}
					max={1}
					accent={CARD_VARIANT_THEME.boss.accent}
				/>
				{renderSection("Boss", "boss", boss ? [boss] : [], 1)}
			</div>

			<div>
				<SectionHeader
					label="Crew"
					current={crew.length}
					max={crewMax}
					accent={CARD_VARIANT_THEME.striker.accent}
				/>
				{renderSection("Crew", "crew", crew, crewMax)}
			</div>

			<div>
				<SectionHeader
					label="Moves"
					current={moves.length}
					max={moveMax}
					accent={CARD_VARIANT_THEME.burst.accent}
				/>
				{renderSection("Moves", "move", moves, moveMax)}
			</div>
		</div>
	);
}