import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode,
} from "react";
import "../board.css";
import { cn } from "../../../lib/utils/cn";
import { modal } from "../../../lib/utils/modal";
import { toast } from "../../../lib/utils/toast";
import {
	BOSS_DISPLAY,
	CREW_DISPLAY,
	MOVE_DISPLAY,
	isDraftable,
} from "@shared/games/face-turn/card-display";
import type { CrewClass, MoveType } from "@shared/games/face-turn/types";
import { FACETURN_CONSTANTS } from "@shared/games/face-turn/constants";
import {
	encodeDeckCode,
	decodeDeckCode,
} from "@shared/games/face-turn/deck-code";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { Card, type CardProps } from "../components/card/Card";
import { useCardInspect } from "../components/card/useCardInspect";
import { CARD_VARIANT_THEME } from "../components/card/cardVariants";
import {
	bossToCard,
	crewToCard,
	moveToCard,
	MOVE_TAG_LABEL,
} from "../components/card/cardAdapters";
import { PickedSidebarSections, type PickedEntry } from "./drafting/SidebarRow";
import { MyDecksMenu } from "./drafting/MyDecksMenu";
import { SaveDeckControl } from "./drafting/SaveDeckControl";
import { DraftFooter } from "./drafting/DraftFooter";
import { PicksDrawer } from "./drafting/PicksDrawer";
import { MobileBrowseHeader } from "./drafting/MobileBrowseHeader";
import {
	DraftInspectPanel,
	type DraftInspectCycle,
	type DraftInspectTarget,
} from "./drafting/DraftInspectPanel";
import {
	DESKTOP_GRID,
	DESKTOP_GRID_COMPACT,
	MOBILE_GRID,
	useIsDraftMobile,
} from "./drafting/useResponsiveCardSize";
import {
	draftDropTargetRegistry,
	setDraftDraggedOverTarget,
	type DraftDropKind,
} from "./drafting/draftDropTargets";
import { recordRecentDeck, type SavedDeck } from "../savedDecks";
import { useCardDrag, type DragPosition } from "../hooks/useCardDrag";
import {
	createDragPositionStore,
	type DragPositionStore,
} from "../hooks/dragPositionStore";
import { DragPortal } from "../components/hand/DragPortal";

const SIDEBAR_EXPANDED_KEY = "huddle_faceturn_sidebar_expanded:v1";
const SIDEBAR_WIDTH_COMPACT = 340;
const SIDEBAR_WIDTH_EXPANDED = 720;
const EXPANDED_CARD_SIZE = 166;

function readSidebarExpanded(): boolean {
	try {
		return localStorage.getItem(SIDEBAR_EXPANDED_KEY) === "1";
	} catch {
		return false;
	}
}

function writeSidebarExpanded(value: boolean): void {
	try {
		localStorage.setItem(SIDEBAR_EXPANDED_KEY, value ? "1" : "0");
	} catch {
		// best effort
	}
}

const CREW_SLOTS = FACETURN_CONSTANTS.CREW_SLOTS;
const RESERVE_CREW_SLOTS = FACETURN_CONSTANTS.RESERVE_CREW_SLOTS;
const MOVES_PER_DECK = FACETURN_CONSTANTS.MOVES_PER_DECK;

function reserveSlotCountFor(bossId: string | null): number {
	return bossId === "the-dealer" ? RESERVE_CREW_SLOTS + 1 : RESERVE_CREW_SLOTS;
}

const DRAFTABLE_CREW = CREW_DISPLAY.filter(isDraftable);

type DraftTab = "boss" | "crew" | "moves" | "all";

const SORT_OPTIONS = ["type", "name", "cost"] as const;
type SortValue = (typeof SORT_OPTIONS)[number];
const SORT_LABEL: Record<SortValue, string> = {
	name: "Name",
	type: "Type",
	cost: "Cash cost",
};

const SORT_DIRECTIONS = ["asc", "desc"] as const;
type SortDirection = (typeof SORT_DIRECTIONS)[number];
const SORT_DIRECTION_LABEL: Record<SortDirection, string> = {
	asc: "Ascending",
	desc: "Descending",
};

function sortBosses(
	bosses: typeof BOSS_DISPLAY,
	_sort: SortValue,
	direction: SortDirection,
) {
	const arr = [...bosses].sort((a, b) => a.name.localeCompare(b.name));
	return direction === "desc" ? arr.reverse() : arr;
}
function sortCrew(
	crew: typeof DRAFTABLE_CREW,
	sort: SortValue,
	direction: SortDirection,
) {
	const arr = [...crew];
	if (sort === "type") {
		arr.sort(
			(a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name),
		);
	} else {
		arr.sort((a, b) => a.name.localeCompare(b.name));
	}
	return direction === "desc" ? arr.reverse() : arr;
}
function sortMoves(
	moves: typeof MOVE_DISPLAY,
	sort: SortValue,
	direction: SortDirection,
) {
	const arr = [...moves];
	if (sort === "type") {
		arr.sort(
			(a, b) =>
				a.moveType.localeCompare(b.moveType) || a.name.localeCompare(b.name),
		);
	} else if (sort === "cost") {
		arr.sort((a, b) => a.baseCost - b.baseCost || a.name.localeCompare(b.name));
	} else {
		arr.sort((a, b) => a.name.localeCompare(b.name));
	}
	return direction === "desc" ? arr.reverse() : arr;
}

function buildHaystack(name: string, ...effectParts: (string | undefined)[]) {
	return [name, ...effectParts.filter(Boolean)].join(" ").toLowerCase();
}

// search also includes ability keywords
const BOSS_SEARCH_TEXT = new Map(
	BOSS_DISPLAY.map((b) => [
		b.id,
		buildHaystack(
			b.name,
			b.effectText.faceTurn,
			b.effectText.command,
			b.effectText.passive,
			"face turn",
			"command",
			"passive",
			"boss",
		),
	]),
);
const CREW_SEARCH_TEXT = new Map(
	CREW_DISPLAY.map((c) => [
		c.id,
		buildHaystack(
			c.name,
			c.effectText.revealed,
			c.effectText.passive,
			c.effectText.revealed ? "revealed" : undefined,
			c.effectText.passive ? "passive" : undefined,
			c.class,
			CARD_VARIANT_THEME[c.class].label,
		),
	]),
);
const MOVE_SEARCH_TEXT = new Map(
	MOVE_DISPLAY.map((m) => [
		m.id,
		buildHaystack(m.name, m.effectText, m.moveType, MOVE_TAG_LABEL[m.moveType]),
	]),
);

function CountBadge({ current, max }: { current: number; max: number }) {
	return (
		<span
			className={cn(
				"text-xs font-black tabular-nums px-2 py-0.5 rounded-full border",
				current === max
					? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
					: "border-amber-400/40 bg-amber-400/10 text-amber-300",
			)}
		>
			{current}/{max}
		</span>
	);
}

function ReserveStamp() {
	return (
		<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
			<span className="-rotate-6 px-4 py-1.5 rounded border-[3px] border-amber-400/90 text-amber-300 text-base font-black uppercase tracking-widest bg-black/55 backdrop-blur-[1px] shadow-[0_0_0_1px_rgba(0,0,0,0.4)]">
				Reserve
			</span>
		</div>
	);
}

function InspectCornerButton({
	onInspect,
	alwaysVisible,
}: {
	onInspect: () => void;
	alwaysVisible: boolean;
}) {
	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				onInspect();
			}}
			aria-label="Inspect card"
			title="Inspect"
			className={cn(
				"absolute top-5 right-5 z-20 w-7 h-7 rounded-md flex items-center justify-center bg-black/60 text-white/60 border border-white/10 hover:opacity-100! hover:text-white hover:bg-black/80 transition-all cursor-pointer",
				alwaysVisible ? "opacity-100" : "opacity-0 group-hover:opacity-100",
			)}
		>
			<svg
				viewBox="0 0 24 24"
				className="w-5.5 h-5.5"
				fill="none"
				stroke="currentColor"
				strokeWidth={2.5}
			>
				<path
					d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</button>
	);
}

const PICKED_FILTERS = ["all", "picked", "unpicked"] as const;
type PickedFilterValue = (typeof PICKED_FILTERS)[number];

const CREW_CLASS_OPTIONS: readonly CrewClass[] = [
	"striker",
	"defender",
	"collector",
	"hider",
];
const MOVE_TYPE_OPTIONS: readonly MoveType[] = ["burst", "slow", "active"];

function ToolbarPopover({
	label,
	icon,
	active,
	open,
	onToggle,
	children,
	panelClassName,
	disabled,
	iconOnly,
}: {
	label: string;
	icon: ReactNode;
	active: boolean;
	open: boolean;
	onToggle: () => void;
	children: ReactNode;
	panelClassName?: string;
	disabled?: boolean;
	iconOnly?: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onClickOutside(e: globalThis.MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node)) onToggle();
		}
		function onKeyDown(e: globalThis.KeyboardEvent) {
			if (e.key === "Escape") onToggle();
		}
		document.addEventListener("mousedown", onClickOutside);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("mousedown", onClickOutside);
			document.removeEventListener("keydown", onKeyDown);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				disabled={disabled}
				onClick={onToggle}
				title={iconOnly ? label : undefined}
				aria-label={iconOnly ? label : undefined}
				className={cn(
					"flex items-center justify-center gap-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all",
					iconOnly ? "w-8 h-8" : "px-3 py-1.5",
					disabled
						? "border-white/10 text-white/20 cursor-not-allowed"
						: cn(
								"cursor-pointer",
								active || open
									? "border-white/30 bg-white/10 text-white"
									: "border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
							),
				)}
			>
				{icon}
				{!iconOnly && label}
			</button>

			{open && !disabled && (
				<div
					className={cn(
						"absolute z-30 top-full right-0 mt-1 rounded-lg border ft-draft-panel shadow-xl overflow-hidden",
						panelClassName ?? "w-64",
					)}
				>
					{children}
				</div>
			)}
		</div>
	);
}

function SortPanel({
	sort,
	onChange,
	direction,
	onDirectionChange,
	iconOnly,
}: {
	sort: SortValue;
	onChange: (value: SortValue) => void;
	direction: SortDirection;
	onDirectionChange: (value: SortDirection) => void;
	iconOnly?: boolean;
}) {
	const [open, setOpen] = useState(false);

	return (
		<ToolbarPopover
			label="Sort"
			active={direction !== "asc"}
			open={open}
			onToggle={() => setOpen((v) => !v)}
			panelClassName="w-44"
			iconOnly={iconOnly}
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-3.5 h-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
				>
					<path
						d="M6 8h12M9 13h6M11 18h2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			}
		>
			<div className="p-1.5 flex flex-col gap-0.5">
				{SORT_OPTIONS.map((opt) => (
					<button
						key={opt}
						type="button"
						onClick={() => {
							onChange(opt);
							setOpen(false);
						}}
						className={cn(
							"flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-bold text-left transition-colors cursor-pointer",
							sort === opt
								? "bg-white/10 text-white"
								: "text-white/60 hover:bg-white/5 hover:text-white/80",
						)}
					>
						{SORT_LABEL[opt]}
						{sort === opt && (
							<svg
								viewBox="0 0 24 24"
								className="w-3.5 h-3.5 text-emerald-300"
								fill="none"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									d="M5 13l4 4L19 7"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
						)}
					</button>
				))}
			</div>

			<div className="border-t border-white/10 p-1.5 flex flex-col gap-0.5">
				{SORT_DIRECTIONS.map((dir) => (
					<label
						key={dir}
						className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-white/5 cursor-pointer"
					>
						<input
							type="radio"
							name="sort-direction"
							checked={direction === dir}
							onChange={() => onDirectionChange(dir)}
							className="accent-emerald-400"
						/>
						<span className="text-xs text-white/80">
							{SORT_DIRECTION_LABEL[dir]}
						</span>
					</label>
				))}
			</div>
		</ToolbarPopover>
	);
}

function FilterPanel({
	pickedFilter,
	onPickedChange,
	variantFilter,
	onToggleVariant,
	onReset,
	iconOnly,
}: {
	pickedFilter: PickedFilterValue;
	onPickedChange: (value: PickedFilterValue) => void;
	variantFilter: ReadonlySet<CrewClass | MoveType>;
	onToggleVariant: (value: CrewClass | MoveType) => void;
	onReset: () => void;
	iconOnly?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const activeCount = (pickedFilter !== "all" ? 1 : 0) + variantFilter.size;

	return (
		<ToolbarPopover
			label="Filter"
			active={activeCount > 0}
			open={open}
			onToggle={() => setOpen((v) => !v)}
			iconOnly={iconOnly}
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-3.5 h-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
				>
					<path
						d="M4 5h16M7 12h10M10 19h4"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			}
		>
			<div className="max-h-96 overflow-y-auto ft-scroll p-3 flex flex-col gap-4">
				<FilterSection label="Status">
					<div className="flex flex-col gap-1">
						{PICKED_FILTERS.map((opt) => (
							<label
								key={opt}
								className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer"
							>
								<input
									type="radio"
									name="picked-filter"
									checked={pickedFilter === opt}
									onChange={() => onPickedChange(opt)}
									className="accent-emerald-400"
								/>
								<span className="text-xs text-white/80 capitalize">
									{opt === "all" ? "All cards" : opt}
								</span>
							</label>
						))}
					</div>
				</FilterSection>

				<FilterSection label="Crew class">
					<div className="flex flex-wrap gap-1.5">
						{CREW_CLASS_OPTIONS.map((cls) => (
							<VariantToggle
								key={cls}
								value={cls}
								active={variantFilter.has(cls)}
								onToggle={onToggleVariant}
							/>
						))}
					</div>
				</FilterSection>

				<FilterSection label="Move type">
					<div className="flex flex-wrap gap-1.5">
						{MOVE_TYPE_OPTIONS.map((type) => (
							<VariantToggle
								key={type}
								value={type}
								active={variantFilter.has(type)}
								onToggle={onToggleVariant}
							/>
						))}
					</div>
				</FilterSection>
			</div>

			<div className="border-t border-white/10 p-2">
				<button
					type="button"
					disabled={activeCount === 0}
					onClick={onReset}
					className={cn(
						"w-full px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors",
						activeCount > 0
							? "bg-white/10 hover:bg-white/20 text-white/80 cursor-pointer"
							: "bg-white/5 text-white/25 cursor-not-allowed",
					)}
				>
					Reset filters
				</button>
			</div>
		</ToolbarPopover>
	);
}

function ClearPopover({
	disabled,
	onConfirm,
	iconOnly,
}: {
	disabled: boolean;
	onConfirm: () => void;
	iconOnly?: boolean;
}) {
	const [open, setOpen] = useState(false);

	return (
		<ToolbarPopover
			label="Clear"
			active={false}
			open={open}
			disabled={disabled}
			onToggle={() => setOpen((v) => !v)}
			panelClassName="w-56"
			iconOnly={iconOnly}
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-3.5 h-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			}
		>
			<div className="p-3 flex flex-col gap-2.5">
				<p className="text-xs text-white/70 leading-snug">
					Unselect everything you've picked so far?
				</p>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="flex-1 px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-widest bg-white/5 hover:bg-white/10 text-white/70 cursor-pointer transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => {
							setOpen(false);
							onConfirm();
						}}
						className="flex-1 px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-widest bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-300 cursor-pointer transition-colors"
					>
						Clear
					</button>
				</div>
			</div>
		</ToolbarPopover>
	);
}

function ExportPanel({
	disabled,
	code,
	onCopy,
	iconOnly,
}: {
	disabled: boolean;
	code: string;
	onCopy: () => void;
	iconOnly?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	return (
		<ToolbarPopover
			label="Export"
			active={false}
			open={open}
			disabled={disabled}
			onToggle={() => setOpen((v) => !v)}
			panelClassName="w-72"
			iconOnly={iconOnly}
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-3.5 h-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						d="M9 9h10a1 1 0 011 1v10a1 1 0 01-1 1H9a1 1 0 01-1-1V10a1 1 0 011-1z"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d="M5 15H4a1 1 0 01-1-1V4a1 1 0 011-1h10a1 1 0 011 1v1"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			}
		>
			<div className="p-3 flex flex-col gap-2">
				<p className="text-[10px] text-white/40 leading-relaxed">
					Share this code so someone else can load your exact draft.
				</p>
				<input
					ref={inputRef}
					readOnly
					value={code}
					onFocus={(e) => e.currentTarget.select()}
					spellCheck={false}
					className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/15 text-xs text-white/90 outline-none font-mono"
				/>
				<button
					type="button"
					onClick={() => {
						inputRef.current?.select();
						onCopy();
					}}
					className="px-2.5 py-1.5 rounded bg-emerald-500/80 hover:bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
				>
					Copy
				</button>
			</div>
		</ToolbarPopover>
	);
}

function ImportPanel({
	disabled,
	onImport,
	iconOnly,
}: {
	disabled: boolean;
	onImport: (deck: {
		bossId: string | null;
		crewIds: string[];
		moveIds: string[];
	}) => void;
	iconOnly?: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");

	function handleLoad() {
		const result = decodeDeckCode(text);
		if (!result.ok) {
			toast.error(
				result.error === "empty"
					? "Paste a deck code first."
					: "That code doesn't look right - check for typos.",
			);
			return;
		}
		onImport(result.deck);
		setText("");
		setOpen(false);
	}

	return (
		<ToolbarPopover
			label="Import"
			active={false}
			open={open}
			disabled={disabled}
			onToggle={() => {
				setOpen((v) => !v);
				setText("");
			}}
			panelClassName="w-72"
			iconOnly={iconOnly}
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-3.5 h-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						d="M12 3v12m0 0l-4-4m4 4l4-4"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			}
		>
			<div className="p-3 flex flex-col gap-2">
				<p className="text-[10px] text-white/40 leading-relaxed">
					Paste a deck code to load it - this replaces your current picks.
				</p>
				<input
					autoFocus
					value={text}
					onChange={(e) => {
						setText(e.target.value);
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") handleLoad();
					}}
					placeholder="Paste a deck code..."
					spellCheck={false}
					className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/15 text-xs text-white/90 placeholder:text-white/30 outline-none focus:border-white/40 font-mono"
				/>
				<button
					type="button"
					onClick={handleLoad}
					disabled={!text.trim()}
					className="px-2.5 py-1.5 rounded bg-emerald-500/80 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-black text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed"
				>
					Load
				</button>
			</div>
		</ToolbarPopover>
	);
}

function FilterSection({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<p className="text-[10px] font-black uppercase tracking-widest text-white/30">
				{label}
			</p>
			{children}
		</div>
	);
}

function VariantToggle({
	value,
	active,
	onToggle,
}: {
	value: CrewClass | MoveType;
	active: boolean;
	onToggle: (value: CrewClass | MoveType) => void;
}) {
	const theme = CARD_VARIANT_THEME[value];
	return (
		<button
			type="button"
			onClick={() => onToggle(value)}
			aria-pressed={active}
			className={cn(
				"px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer",
				active
					? "text-white"
					: "border-white/10 bg-white/3 text-white/40 hover:text-white/60",
			)}
			style={
				active
					? { borderColor: theme.accent, backgroundColor: `${theme.accent}26` }
					: undefined
			}
		>
			{theme.label}
		</button>
	);
}

// columns are minmax, browser sizes natively, no resize observer lag
function CardGrid({
	sizeMin,
	sizeMax,
	columns,
	gap,
	paddingX,
	children,
}: {
	sizeMin: number;
	sizeMax: number;
	columns: number;
	gap: number;
	paddingX: number;
	children: ReactNode;
}) {
	return (
		<div className="overflow-x-auto ft-scroll">
			<div
				className="grid mx-auto"
				style={{
					gridTemplateColumns: `repeat(${columns}, minmax(${sizeMin}px, ${sizeMax}px))`,
					gap: `${gap}px`,
					padding: `${gap}px ${paddingX}px`,
					maxWidth: sizeMax * columns + gap * (columns - 1) + paddingX * 2,
				}}
			>
				{children}
			</div>
		</div>
	);
}

// wraps grid card with pointer drag, disabled on mobile or already selected
function DraggableGridCard({
	dragKind,
	cardProps,
	sizeMax,
	selected,
	isReserve,
	isMobile,
	onSelectClick,
	onInspectClick,
	positionStore,
	getTargetAt,
	onDropSuccess,
	onDragVisualChange,
}: {
	dragKind: DraftDropKind;
	cardProps: CardProps;
	sizeMax: number;
	selected: boolean;
	isReserve: boolean;
	isMobile: boolean;
	onSelectClick: () => void;
	onInspectClick: () => void;
	positionStore: DragPositionStore;
	getTargetAt: (point: DragPosition) => DraftDropKind | null;
	onDropSuccess: () => void;
	onDragVisualChange: (cardProps: CardProps | null) => void;
}) {
	const { dragHandleProps } = useCardDrag<DraftDropKind>({
		positionStore,
		disabled: selected || isMobile,
		getTargetAt,
		isValidTarget: (candidate) => candidate === dragKind,
		onDrop: onDropSuccess,
		onLongPress: onInspectClick,
		onDragStateChange: (state) => {
			onDragVisualChange(state.dragging ? cardProps : null);
		},
	});

	return (
		<div
			className={cn(
				"relative group transition-opacity",
				selected && "opacity-45",
			)}
			style={{ "--card-vw-share": "100%" } as CSSProperties}
			{...dragHandleProps}
			onContextMenu={(e) => {
				e.preventDefault();
				onInspectClick();
			}}
		>
			<Card
				{...cardProps}
				size={sizeMax}
				selected={selected}
				onClick={onSelectClick}
			/>
			<InspectCornerButton
				alwaysVisible={isMobile}
				onInspect={onInspectClick}
			/>
			{isReserve && <ReserveStamp />}
		</div>
	);
}

export function DraftingPhase() {
	const { ft, secret, playerId } = useFaceturnState();
	const isMobile = useIsDraftMobile();
	const [tab, setTab] = useState<DraftTab>("all");
	const [sort, setSort] = useState<SortValue>("type");
	const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
	const [pickedFilter, setPickedFilter] = useState<
		"all" | "picked" | "unpicked"
	>("all");
	const [variantFilter, setVariantFilter] = useState<
		ReadonlySet<CrewClass | MoveType>
	>(new Set());
	function toggleVariant(value: CrewClass | MoveType) {
		setVariantFilter((prev) => {
			const next = new Set(prev);
			if (next.has(value)) next.delete(value);
			else next.add(value);
			return next;
		});
	}
	function resetAllFilters() {
		setPickedFilter("all");
		setVariantFilter(new Set());
	}
	const [query, setQuery] = useState("");
	const [picksOpen, setPicksOpen] = useState(false);
	const [sidebarExpanded, setSidebarExpanded] = useState(readSidebarExpanded);
	function toggleSidebarExpanded() {
		setSidebarExpanded((prev) => {
			const next = !prev;
			writeSidebarExpanded(next);
			return next;
		});
	}
	const gridMetrics = isMobile
		? MOBILE_GRID
		: sidebarExpanded
			? DESKTOP_GRID_COMPACT
			: DESKTOP_GRID;

	const myDraft = ft?.draft?.[playerId];
	const { locked, runLocked } = useActionLock(myDraft?.isDraftLocked);
	const { inspect } = useCardInspect();

	const [dragPositionStore] = useState<DragPositionStore>(() =>
		createDragPositionStore(),
	);
	const [dragVisualCardProps, setDragVisualCardProps] =
		useState<CardProps | null>(null);
	useEffect(() => {
		const clear = () => setDraftDraggedOverTarget(null);
		window.addEventListener("pointerup", clear);
		window.addEventListener("pointercancel", clear);
		return () => {
			window.removeEventListener("pointerup", clear);
			window.removeEventListener("pointercancel", clear);
		};
	}, []);

	// auto save in progress draft to recent slot, debounced
	const autoSaveBossId = secret?.draftSelections?.bossId ?? null;
	const autoSaveCrewIds = secret?.draftSelections?.crewIds ?? [];
	const autoSaveMoveIds = secret?.draftSelections?.moveIds ?? [];
	const autoSaveCrewKey = autoSaveCrewIds.join(",");
	const autoSaveMoveKey = autoSaveMoveIds.join(",");
	useEffect(() => {
		if (
			!autoSaveBossId &&
			autoSaveCrewIds.length === 0 &&
			autoSaveMoveIds.length === 0
		) {
			return;
		}
		const timeout = setTimeout(() => {
			recordRecentDeck({
				bossId: autoSaveBossId,
				crewIds: autoSaveCrewIds,
				moveIds: autoSaveMoveIds,
			});
		}, 1500);
		return () => clearTimeout(timeout);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoSaveBossId, autoSaveCrewKey, autoSaveMoveKey]);

	// desktop side by side panel, mobile swipeable modal
	const [inspectPanel, setInspectPanel] = useState<DraftInspectCycle | null>(
		null,
	);
	function openInspectPanel(
		items: readonly DraftInspectTarget[],
		index: number,
	) {
		setInspectPanel({ items, index });
	}
	function stepInspectPanel(delta: 1 | -1) {
		setInspectPanel((prev) => {
			if (!prev) return prev;
			const nextIndex = prev.index + delta;
			if (nextIndex < 0 || nextIndex >= prev.items.length) return prev;
			return { ...prev, index: nextIndex };
		});
	}

	function triggerInspect(
		cardProps: CardProps,
		cycleItems: readonly CardProps[],
		inspectItems: readonly DraftInspectTarget[],
		index: number,
	) {
		if (isMobile) {
			inspect(cardProps, { items: cycleItems, index });
		} else {
			openInspectPanel(inspectItems, index);
		}
	}

	const q = query.trim().toLowerCase();

	const filteredCrew = useMemo(() => {
		const byVariant =
			variantFilter.size > 0
				? DRAFTABLE_CREW.filter((c) => variantFilter.has(c.class))
				: DRAFTABLE_CREW;
		const searched = q
			? byVariant.filter((c) => CREW_SEARCH_TEXT.get(c.id)!.includes(q))
			: byVariant;
		return sortCrew(searched, sort, sortDirection);
	}, [variantFilter, q, sort, sortDirection]);

	const filteredMoves = useMemo(() => {
		const byVariant =
			variantFilter.size > 0
				? MOVE_DISPLAY.filter((m) => variantFilter.has(m.moveType))
				: MOVE_DISPLAY;
		const searched = q
			? byVariant.filter((m) => MOVE_SEARCH_TEXT.get(m.id)!.includes(q))
			: byVariant;
		return sortMoves(searched, sort, sortDirection);
	}, [variantFilter, q, sort, sortDirection]);

	const filteredBosses = useMemo(() => {
		const searched = q
			? BOSS_DISPLAY.filter((b) => BOSS_SEARCH_TEXT.get(b.id)!.includes(q))
			: BOSS_DISPLAY;
		return sortBosses(searched, sort, sortDirection);
	}, [q, sort, sortDirection]);

	if (!ft || ft.phase !== "drafting" || !secret?.draftSelections) return null;

	const sel = secret.draftSelections;
	const crewMax = CREW_SLOTS + reserveSlotCountFor(sel.bossId);

	const bossDone = sel.bossId !== null;
	const crewDone = sel.crewIds.length === crewMax;
	const movesDone = sel.moveIds.length === MOVES_PER_DECK;
	const allDone = bossDone && crewDone && movesDone;
	const crewFull = sel.crewIds.length >= crewMax;
	const movesFull = sel.moveIds.length >= MOVES_PER_DECK;

	const reserveCrewIds = new Set(sel.crewIds.slice(CREW_SLOTS));

	const allFilteredBosses = filteredBosses.filter((b) => {
		if (pickedFilter === "picked") return sel.bossId === b.id;
		if (pickedFilter === "unpicked") return sel.bossId !== b.id;
		return true;
	});

	const allFilteredCrew = filteredCrew.filter((c) => {
		const picked = sel.crewIds.includes(c.id);
		if (pickedFilter === "picked" && !picked) return false;
		if (pickedFilter === "unpicked" && picked) return false;
		return true;
	});

	const allFilteredMoves = filteredMoves.filter((m) => {
		const picked = sel.moveIds.includes(m.id);
		if (pickedFilter === "picked" && !picked) return false;
		if (pickedFilter === "unpicked" && picked) return false;
		return true;
	});

	const pickedEntries: PickedEntry[] = [];
	const pickedInspectTargets: DraftInspectTarget[] = [];
	if (sel.bossId) {
		const boss = BOSS_DISPLAY.find((b) => b.id === sel.bossId);
		if (boss) {
			pickedEntries.push({
				kind: "boss",
				id: boss.id,
				name: boss.name,
				artSrc: boss.artSrc,
			});
			pickedInspectTargets.push({ kind: "boss", display: boss });
		}
	}
	for (const crewId of sel.crewIds) {
		const crew = DRAFTABLE_CREW.find((c) => c.id === crewId);
		if (crew) {
			pickedEntries.push({
				kind: "crew",
				id: crew.id,
				name: crew.name,
				crewClass: crew.class,
				isReserve: reserveCrewIds.has(crew.id),
				artSrc: crew.artSrc,
			});
			pickedInspectTargets.push({ kind: "crew", display: crew });
		}
	}
	for (const moveId of sel.moveIds) {
		const move = MOVE_DISPLAY.find((m) => m.id === moveId);
		if (move) {
			pickedEntries.push({
				kind: "move",
				id: move.id,
				name: move.name,
				baseCost: move.baseCost,
				moveType: move.moveType,
				artSrc: move.artSrc,
			});
			pickedInspectTargets.push({ kind: "move", display: move });
		}
	}
	const pickedCardProps: CardProps[] = pickedInspectTargets.map((t) => {
		if (t.kind === "boss") return bossToCard(t.display);
		if (t.kind === "crew") return crewToCard(t.display);
		return moveToCard(t.display);
	});
	const pickedCardPropsByKey = new Map<string, CardProps>(
		pickedEntries.map((e, i) => [`${e.kind}-${e.id}`, pickedCardProps[i]]),
	);

	function inspectPickedEntry(entry: PickedEntry) {
		const index = pickedEntries.findIndex(
			(e) => e.kind === entry.kind && e.id === entry.id,
		);
		if (index === -1) return;
		triggerInspect(
			pickedCardProps[index],
			pickedCardProps,
			pickedInspectTargets,
			index,
		);
	}

	function deselect(entry: PickedEntry) {
		if (entry.kind === "boss") {
			sendFaceturnAction({ type: "select_boss", bossId: entry.id });
		} else if (entry.kind === "crew") {
			sendFaceturnAction({ type: "deselect_crew", crewId: entry.id });
		} else if (entry.kind === "move") {
			sendFaceturnAction({ type: "deselect_move", moveId: entry.id });
		}
	}

	function getDraftDropTargetAt(point: DragPosition): DraftDropKind | null {
		const target = draftDropTargetRegistry.getTargetAt(point);
		setDraftDraggedOverTarget(target);
		return target;
	}

	function handleDropCard(kind: PickedEntry["kind"], id: string) {
		if (kind === "boss") {
			sendFaceturnAction({ type: "select_boss", bossId: id });
			return;
		}
		if (kind === "crew") {
			if (sel.crewIds.includes(id) || crewFull) return;
			sendFaceturnAction({ type: "select_crew", crewId: id });
			return;
		}
		if (sel.moveIds.includes(id) || movesFull) return;
		sendFaceturnAction({ type: "select_move", moveId: id });
	}

	async function loadDraftSelections(
		deck: { bossId: string | null; crewIds: string[]; moveIds: string[] },
		confirmTitle: string,
	) {
		if (pickedEntries.length > 0) {
			const ok = await modal.confirm({
				title: confirmTitle,
				body: "This replaces everything you've picked so far.",
				confirmLabel: "Load deck",
			});
			if (!ok) return;
		}
		sendFaceturnAction({
			type: "load_draft",
			bossId: deck.bossId,
			crewIds: deck.crewIds,
			moveIds: deck.moveIds,
		});
	}

	function loadSavedDeck(deck: SavedDeck) {
		return loadDraftSelections(deck, `Load "${deck.name}"?`);
	}

	function loadImportedDeck(deck: {
		bossId: string | null;
		crewIds: string[];
		moveIds: string[];
	}) {
		return loadDraftSelections(deck, "Load imported deck?");
	}

	function handleDone() {
		recordRecentDeck({
			bossId: sel.bossId,
			crewIds: sel.crewIds,
			moveIds: sel.moveIds,
		});
		runLocked(() => {
			sendFaceturnAction({ type: "lock_draft" });
		});
	}

	function handleRandomize() {
		sendFaceturnAction({ type: "randomize_draft" });
	}

	const deckCode = encodeDeckCode({
		bossId: sel.bossId,
		crewIds: [...sel.crewIds],
		moveIds: [...sel.moveIds],
	});

	async function handleCopyCode() {
		try {
			await navigator.clipboard.writeText(deckCode);
			toast.success("Deck code copied!", { duration: 2000 });
		} catch {
			toast.error("Couldn't copy - your browser blocked clipboard access.");
		}
	}

	function handleClear() {
		if (pickedEntries.length === 0) return;
		sendFaceturnAction({
			type: "load_draft",
			bossId: null,
			crewIds: [],
			moveIds: [],
		});
	}

	if (myDraft?.isDraftLocked) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
				<span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
					Locked in
				</span>
				<p className="text-sm text-white/40">
					Waiting for other players to finish drafting...
				</p>
			</div>
		);
	}

	const noResults =
		(tab === "all" &&
			allFilteredBosses.length === 0 &&
			allFilteredCrew.length === 0 &&
			allFilteredMoves.length === 0) ||
		(tab === "boss" && allFilteredBosses.length === 0) ||
		(tab === "crew" && allFilteredCrew.length === 0) ||
		(tab === "moves" && allFilteredMoves.length === 0);

	const allEntries =
		tab === "all"
			? [
					...allFilteredBosses.map((boss) => {
						const selected = sel.bossId === boss.id;
						return {
							key: `boss:${boss.id}`,
							kind: "boss" as const,
							id: boss.id,
							cardProps: bossToCard(boss),
							selected,
							isReserve: false,
							onClick: () => {
								sendFaceturnAction({ type: "select_boss", bossId: boss.id });
							},
						};
					}),
					...allFilteredCrew.map((crew) => {
						const selected = sel.crewIds.includes(crew.id);
						return {
							key: `crew:${crew.id}`,
							kind: "crew" as const,
							id: crew.id,
							cardProps: crewToCard(crew),
							selected,
							isReserve: reserveCrewIds.has(crew.id),
							onClick: () => {
								if (selected) {
									sendFaceturnAction({
										type: "deselect_crew",
										crewId: crew.id,
									});
									return;
								}
								if (crewFull) return;
								sendFaceturnAction({ type: "select_crew", crewId: crew.id });
							},
						};
					}),
					...allFilteredMoves.map((move) => {
						const selected = sel.moveIds.includes(move.id);
						return {
							key: `move:${move.id}`,
							kind: "move" as const,
							id: move.id,
							cardProps: moveToCard(move),
							selected,
							isReserve: false,
							onClick: () => {
								if (selected) {
									sendFaceturnAction({
										type: "deselect_move",
										moveId: move.id,
									});
									return;
								}
								if (movesFull) return;
								sendFaceturnAction({ type: "select_move", moveId: move.id });
							},
						};
					}),
				]
			: [];

	const allEntriesCycleItems = allEntries.map((e) => e.cardProps);
	const bossCycleItems = allFilteredBosses.map((b) => bossToCard(b));
	const crewCycleItems = allFilteredCrew.map((c) => crewToCard(c));
	const moveCycleItems = allFilteredMoves.map((m) => moveToCard(m));

	const allEntriesInspectItems: DraftInspectTarget[] = [
		...allFilteredBosses.map(
			(b): DraftInspectTarget => ({ kind: "boss", display: b }),
		),
		...allFilteredCrew.map(
			(c): DraftInspectTarget => ({ kind: "crew", display: c }),
		),
		...allFilteredMoves.map(
			(m): DraftInspectTarget => ({ kind: "move", display: m }),
		),
	];
	const bossInspectItems: DraftInspectTarget[] = allFilteredBosses.map((b) => ({
		kind: "boss",
		display: b,
	}));
	const crewInspectItems: DraftInspectTarget[] = allFilteredCrew.map((c) => ({
		kind: "crew",
		display: c,
	}));
	const moveInspectItems: DraftInspectTarget[] = allFilteredMoves.map((m) => ({
		kind: "move",
		display: m,
	}));

	const grid = (
		<div className="flex-1 min-h-0 overflow-y-auto ft-scroll">
			{noResults && (
				<p className="px-4 py-10 text-xs text-white/30 text-center">
					{query.trim()
						? `No cards match "${query.trim()}".`
						: "No cards match your filters."}
				</p>
			)}

			{tab === "all" && allEntries.length > 0 && (
				<CardGrid
					sizeMin={gridMetrics.sizeMin}
					sizeMax={gridMetrics.sizeMax}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allEntries.map((entry, i) => (
						<DraggableGridCard
							key={entry.key}
							dragKind={entry.kind}
							cardProps={entry.cardProps}
							sizeMax={gridMetrics.sizeMax}
							selected={entry.selected}
							isReserve={entry.isReserve}
							isMobile={isMobile}
							onSelectClick={entry.onClick}
							onInspectClick={() =>
								triggerInspect(
									entry.cardProps,
									allEntriesCycleItems,
									allEntriesInspectItems,
									i,
								)
							}
							positionStore={dragPositionStore}
							getTargetAt={getDraftDropTargetAt}
							onDropSuccess={() => handleDropCard(entry.kind, entry.id)}
							onDragVisualChange={setDragVisualCardProps}
						/>
					))}
				</CardGrid>
			)}

			{tab === "boss" && allFilteredBosses.length > 0 && (
				<CardGrid
					sizeMin={gridMetrics.sizeMin}
					sizeMax={gridMetrics.sizeMax}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allFilteredBosses.map((boss, i) => {
						const selected = sel.bossId === boss.id;
						const cardProps = bossCycleItems[i];
						return (
							<DraggableGridCard
								key={boss.id}
								dragKind="boss"
								cardProps={cardProps}
								sizeMax={gridMetrics.sizeMax}
								selected={selected}
								isReserve={false}
								isMobile={isMobile}
								onSelectClick={() => {
									sendFaceturnAction({
										type: "select_boss",
										bossId: boss.id,
									});
								}}
								onInspectClick={() =>
									triggerInspect(cardProps, bossCycleItems, bossInspectItems, i)
								}
								positionStore={dragPositionStore}
								getTargetAt={getDraftDropTargetAt}
								onDropSuccess={() => handleDropCard("boss", boss.id)}
								onDragVisualChange={setDragVisualCardProps}
							/>
						);
					})}
				</CardGrid>
			)}

			{tab === "crew" && allFilteredCrew.length > 0 && (
				<CardGrid
					sizeMin={gridMetrics.sizeMin}
					sizeMax={gridMetrics.sizeMax}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allFilteredCrew.map((crew, i) => {
						const selected = sel.crewIds.includes(crew.id);
						const cardProps = crewCycleItems[i];
						const isReserve = reserveCrewIds.has(crew.id);
						return (
							<DraggableGridCard
								key={crew.id}
								dragKind="crew"
								cardProps={cardProps}
								sizeMax={gridMetrics.sizeMax}
								selected={selected}
								isReserve={isReserve}
								isMobile={isMobile}
								onSelectClick={() => {
									if (selected) {
										sendFaceturnAction({
											type: "deselect_crew",
											crewId: crew.id,
										});
										return;
									}
									if (crewFull) return;
									sendFaceturnAction({
										type: "select_crew",
										crewId: crew.id,
									});
								}}
								onInspectClick={() =>
									triggerInspect(cardProps, crewCycleItems, crewInspectItems, i)
								}
								positionStore={dragPositionStore}
								getTargetAt={getDraftDropTargetAt}
								onDropSuccess={() => handleDropCard("crew", crew.id)}
								onDragVisualChange={setDragVisualCardProps}
							/>
						);
					})}
				</CardGrid>
			)}

			{tab === "moves" && allFilteredMoves.length > 0 && (
				<CardGrid
					sizeMin={gridMetrics.sizeMin}
					sizeMax={gridMetrics.sizeMax}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allFilteredMoves.map((move, i) => {
						const selected = sel.moveIds.includes(move.id);
						const cardProps = moveCycleItems[i];
						return (
							<DraggableGridCard
								key={move.id}
								dragKind="move"
								cardProps={cardProps}
								sizeMax={gridMetrics.sizeMax}
								selected={selected}
								isReserve={false}
								isMobile={isMobile}
								onSelectClick={() => {
									if (selected) {
										sendFaceturnAction({
											type: "deselect_move",
											moveId: move.id,
										});
										return;
									}
									if (movesFull) return;
									sendFaceturnAction({
										type: "select_move",
										moveId: move.id,
									});
								}}
								onInspectClick={() =>
									triggerInspect(cardProps, moveCycleItems, moveInspectItems, i)
								}
								positionStore={dragPositionStore}
								getTargetAt={getDraftDropTargetAt}
								onDropSuccess={() => handleDropCard("move", move.id)}
								onDragVisualChange={setDragVisualCardProps}
							/>
						);
					})}
				</CardGrid>
			)}
		</div>
	);

	if (isMobile) {
		return (
			<div className="flex flex-col h-full min-h-0 ft-draft-bg">
				<MobileBrowseHeader
					tab={tab}
					setTab={setTab}
					bossDone={bossDone}
					crewCount={sel.crewIds.length}
					crewMax={crewMax}
					moveCount={sel.moveIds.length}
					moveMax={MOVES_PER_DECK}
					query={query}
					setQuery={setQuery}
					sort={sort}
					setSort={setSort}
					sortDirection={sortDirection}
					setSortDirection={setSortDirection}
					pickedFilter={pickedFilter}
					setPickedFilter={setPickedFilter}
					variantFilter={variantFilter}
					onToggleVariant={toggleVariant}
					onResetFilters={resetAllFilters}
					onRandomize={handleRandomize}
					randomizeDisabled={allDone || locked}
					onClear={handleClear}
					clearDisabled={pickedEntries.length === 0 || locked}
					onCopyCode={() => void handleCopyCode()}
					copyCodeDisabled={pickedEntries.length === 0}
				/>

				{grid}

				<DraftFooter
					bossDone={bossDone}
					crewCount={sel.crewIds.length}
					crewMax={crewMax}
					moveCount={sel.moveIds.length}
					moveMax={MOVES_PER_DECK}
					allDone={allDone}
					locked={locked}
					pickedCount={pickedEntries.length}
					onDone={handleDone}
					onReviewPicks={() => {
						setPicksOpen(true);
					}}
				/>

				<PicksDrawer
					open={picksOpen}
					onClose={() => {
						setPicksOpen(false);
					}}
					entries={pickedEntries}
					crewMax={crewMax}
					moveMax={MOVES_PER_DECK}
					onDeselect={deselect}
					onInspect={inspectPickedEntry}
				/>
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 ft-draft-bg">
			<div
				className="relative shrink-0 flex flex-col min-h-0 border-r border-white/10 transition-[width] duration-300 ease-out"
				style={{
					width: sidebarExpanded
						? SIDEBAR_WIDTH_EXPANDED
						: SIDEBAR_WIDTH_COMPACT,
				}}
			>
				<div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
					<p className="text-[10px] font-black tracking-widest uppercase text-white/40">
						Your draft
					</p>
					<MyDecksMenu
						disabled={locked}
						onLoad={(deck) => void loadSavedDeck(deck)}
					/>
				</div>

				<div className="flex-1 min-h-0 overflow-y-auto ft-scroll">
					<PickedSidebarSections
						entries={pickedEntries}
						crewMax={crewMax}
						moveMax={MOVES_PER_DECK}
						onDeselect={deselect}
						onInspect={inspectPickedEntry}
						dropEnabled
						onNavigateToTab={(kind) => {
							setTab(kind === "move" ? "moves" : kind);
						}}
						variant={sidebarExpanded ? "expanded" : "compact"}
						cardPropsByKey={pickedCardPropsByKey}
						cardSize={EXPANDED_CARD_SIZE}
					/>
				</div>

				<DraftFooter
					bossDone={bossDone}
					crewCount={sel.crewIds.length}
					crewMax={crewMax}
					moveCount={sel.moveIds.length}
					moveMax={MOVES_PER_DECK}
					allDone={allDone}
					locked={locked}
					pickedCount={pickedEntries.length}
					onDone={handleDone}
					showStats={false}
					saveDeckSlot={
						<SaveDeckControl
							selections={sel}
							pickedEntries={pickedEntries}
							bossName={
								pickedEntries.find((e) => e.kind === "boss")?.name ?? null
							}
							allDone={allDone}
							disabled={locked}
						/>
					}
				/>

				<button
					type="button"
					onClick={toggleSidebarExpanded}
					title={
						sidebarExpanded
							? "Collapse to compact list"
							: "Expand to full cards"
					}
					aria-label={
						sidebarExpanded
							? "Collapse deck panel"
							: "Expand deck panel to full cards"
					}
					className="absolute top-1/2 -translate-y-1/2 -right-3 z-20 w-6 h-11 rounded-full border border-white/15 bg-white/8 backdrop-blur-sm shadow-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/15 hover:border-white/30 transition-colors cursor-pointer"
				>
					<svg
						viewBox="0 0 24 24"
						className="w-3 h-3"
						fill="none"
						stroke="currentColor"
						strokeWidth={2.5}
					>
						{sidebarExpanded ? (
							<path
								d="M15 6l-6 6 6 6"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						) : (
							<path
								d="M9 6l6 6-6 6"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						)}
					</svg>
				</button>
			</div>

			<div className="flex flex-col flex-1 min-h-0">
				<div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
					<div className="relative min-w-36 flex-1 max-w-64">
						<svg
							viewBox="0 0 24 24"
							className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30"
							fill="none"
							stroke="currentColor"
							strokeWidth={2.5}
						>
							<circle cx={11} cy={11} r={7} />
							<path d="M21 21l-4.35-4.35" strokeLinecap="round" />
						</svg>
						<input
							type="text"
							value={query}
							onChange={(e) => {
								setQuery(e.target.value);
							}}
							placeholder="Search cards..."
							className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
						/>
					</div>

					<div className="flex items-center gap-1 shrink-0">
						<button
							type="button"
							onClick={() => {
								setTab("all");
							}}
							title="Browse every boss, crew, and move in one list"
							className={cn(
								"px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
								tab === "all"
									? "bg-white/10 text-white"
									: "text-white/30 hover:text-white/50",
							)}
						>
							All
						</button>
						<button
							type="button"
							onClick={() => {
								setTab("boss");
							}}
							className={cn(
								"px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
								tab === "boss"
									? "bg-white/10 text-white"
									: "text-white/30 hover:text-white/50",
							)}
						>
							Boss <CountBadge current={bossDone ? 1 : 0} max={1} />
						</button>
						<button
							type="button"
							onClick={() => {
								setTab("crew");
							}}
							className={cn(
								"px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
								tab === "crew"
									? "bg-white/10 text-white"
									: "text-white/30 hover:text-white/50",
							)}
						>
							Crew <CountBadge current={sel.crewIds.length} max={crewMax} />
						</button>
						<button
							type="button"
							onClick={() => {
								setTab("moves");
							}}
							className={cn(
								"px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer",
								tab === "moves"
									? "bg-white/10 text-white"
									: "text-white/30 hover:text-white/50",
							)}
						>
							Moves{" "}
							<CountBadge current={sel.moveIds.length} max={MOVES_PER_DECK} />
						</button>
					</div>

					<SortPanel
						sort={sort}
						onChange={setSort}
						direction={sortDirection}
						onDirectionChange={setSortDirection}
						iconOnly={sidebarExpanded}
					/>
					<FilterPanel
						pickedFilter={pickedFilter}
						onPickedChange={setPickedFilter}
						variantFilter={variantFilter}
						onToggleVariant={toggleVariant}
						onReset={resetAllFilters}
						iconOnly={sidebarExpanded}
					/>

					<div className="flex items-center gap-2 shrink-0 ml-auto">
						<ImportPanel
							disabled={locked}
							onImport={(deck) => void loadImportedDeck(deck)}
							iconOnly={sidebarExpanded}
						/>
						<ExportPanel
							disabled={pickedEntries.length === 0}
							code={deckCode}
							onCopy={() => void handleCopyCode()}
							iconOnly={sidebarExpanded}
						/>

						<button
							type="button"
							disabled={allDone || locked}
							onClick={handleRandomize}
							title="Randomly fill whatever's still empty - doesn't touch what you've already picked"
							aria-label={
								sidebarExpanded
									? "Randomly fill whatever's still empty"
									: undefined
							}
							className={cn(
								"flex items-center justify-center gap-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all shrink-0",
								sidebarExpanded ? "w-8 h-8" : "px-3 py-1.5",
								!allDone && !locked
									? "border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white cursor-pointer"
									: "border-white/10 text-white/20 cursor-not-allowed",
							)}
						>
							<svg
								viewBox="0 0 24 24"
								className="w-3.5 h-3.5"
								fill="none"
								stroke="currentColor"
								strokeWidth={2.5}
							>
								<path
									d="M17 2.1l4 4-4 4M3 12.9v-1a4 4 0 014-4h14M7 21.9l-4-4 4-4M21 11.1v1a4 4 0 01-4 4H3"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							{!sidebarExpanded && "Randomize"}
						</button>

						<ClearPopover
							disabled={pickedEntries.length === 0 || locked}
							onConfirm={handleClear}
							iconOnly={sidebarExpanded}
						/>
					</div>
				</div>

				{grid}
			</div>

			{inspectPanel && (
				<DraftInspectPanel
					cycle={inspectPanel}
					onClose={() => setInspectPanel(null)}
					onStep={stepInspectPanel}
				/>
			)}
			<DragPortal positionStore={dragPositionStore}>
				{dragVisualCardProps && (
					<Card {...dragVisualCardProps} size={EXPANDED_CARD_SIZE} />
				)}
			</DragPortal>
		</div>
	);
}