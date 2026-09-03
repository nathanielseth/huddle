import { CARD_VARIANT_THEME } from "../../components/card/cardVariants";
import { CARD_VARIANT_ICON } from "../../components/card/cardIconRegistry";
import { MOVE_TAG_LABEL } from "../../components/card/cardAdapters";
import { Card, type CardProps } from "../../components/card/Card";
import { cn } from "../../../../lib/utils/cn";
import type { CrewClass, MoveType } from "@shared/games/face-turn/types";

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

// used in the row's title tooltip and to pick which theme tints the row —
// there's no separate icon/label displaying it anymore
function entryVariantLabel(entry: PickedEntry): string {
	if (entry.kind === "boss") return "Boss";
	if (entry.kind === "crew") return CARD_VARIANT_THEME[entry.crewClass].label;
	return MOVE_TAG_LABEL[entry.moveType];
}

// plain art thumbnail, nothing overlaid on top of it — the row's own
// background already carries the type color, art stays clean
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

// cash cost badge for moves, icon badge for boss/crew — moves already carry
// their icon-equivalent info (cost) so an icon there would be redundant
// clutter; boss/crew get the crown/sword/shield/etc icon back, in a circle
// tinted with the row's own theme color
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

// all three kinds clickable to deselect, right-clickable to inspect; boss
// reuses select_boss action, no display-only carve-out. The row background
// itself carries the type color (a quiet tint of the theme accent) instead
// of a separate badge/icon/dot — title carries the type name for a11y
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

// full-card rendering for the expanded sidebar — same Card component the
// browse grid uses, so it's pixel-identical to what you drafted it from.
// Click removes it (matches the grid's own click-to-toggle), right-click
// inspects, same as the compact row.
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
			className="relative flex justify-center px-4 py-3"
			onContextMenu={(e) => {
				if (!onInspect) return;
				e.preventDefault();
				onInspect(entry);
			}}
		>
			{entry.kind === "crew" && entry.isReserve && (
				<span className="absolute top-4 left-6 z-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-amber-400/50 bg-amber-400/15 text-amber-300 shadow-sm">
					Reserve
				</span>
			)}
			<Card {...cardProps} size={cardSize} onClick={onDeselect} />
		</div>
	);
}

// section header used inside the grouped sidebar list — name, live count,
// and a colored rule so boss / crew / moves read as clearly separate zones
// rather than one undifferentiated scroll of rows
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

// groups the flat pick list into clearly separated Boss / Crew / Moves
// sections — closer to how physical deckbuilders (and games like LoR) keep
// each card category visually distinct instead of one undifferentiated
// list. Always renders all three sections, even on a totally empty draft —
// the type separation itself is the useful information, not a "start here"
// message. variant="expanded" swaps the compact rows for full Card
// renders (desktop only — needs cardPropsByKey + cardSize to do so)
export function PickedSidebarSections({
	entries,
	crewMax,
	moveMax,
	onDeselect,
	onInspect,
	variant = "compact",
	cardPropsByKey,
	cardSize,
}: {
	entries: readonly PickedEntry[];
	crewMax: number;
	moveMax: number;
	onDeselect: (entry: PickedEntry) => void;
	onInspect?: (entry: PickedEntry) => void;
	variant?: "compact" | "expanded";
	cardPropsByKey?: ReadonlyMap<string, CardProps>;
	cardSize?: number;
}) {
	const boss = entries.find((e) => e.kind === "boss");
	const crew = entries.filter((e) => e.kind === "crew");
	const moves = entries.filter((e) => e.kind === "move");

	function renderEntry(entry: PickedEntry) {
		if (variant === "expanded" && cardPropsByKey && cardSize) {
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

	return (
		<div>
			<div>
				<SectionHeader
					label="Boss"
					current={boss ? 1 : 0}
					max={1}
					accent={CARD_VARIANT_THEME.boss.accent}
				/>
				{boss ? (
					renderEntry(boss)
				) : (
					<p className="px-4 py-3 text-[11px] text-white/25">Not picked yet</p>
				)}
			</div>

			<div>
				<SectionHeader
					label="Crew"
					current={crew.length}
					max={crewMax}
					accent={CARD_VARIANT_THEME.striker.accent}
				/>
				{crew.length === 0 ? (
					<p className="px-4 py-3 text-[11px] text-white/25">Not picked yet</p>
				) : (
					crew.map(renderEntry)
				)}
			</div>

			<div>
				<SectionHeader
					label="Moves"
					current={moves.length}
					max={moveMax}
					accent={CARD_VARIANT_THEME.burst.accent}
				/>
				{moves.length === 0 ? (
					<p className="px-4 py-3 text-[11px] text-white/25">Not picked yet</p>
				) : (
					moves.map(renderEntry)
				)}
			</div>
		</div>
	);
}