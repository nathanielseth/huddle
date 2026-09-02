import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { encodeDeckCode } from "@shared/games/face-turn/deck-code";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { Card } from "../components/card/Card";
import { useCardInspect } from "../components/card/useCardInspect";
import { CARD_VARIANT_THEME } from "../components/card/cardVariants";
import {
	bossToCard,
	crewToCard,
	moveToCard,
} from "../components/card/cardAdapters";
import { SidebarRow, type PickedEntry } from "./drafting/SidebarRow";
import { MyDecksMenu } from "./drafting/MyDecksMenu";
import { DraftFooter } from "./drafting/DraftFooter";
import { PicksDrawer } from "./drafting/PicksDrawer";
import { MobileBrowseHeader } from "./drafting/MobileBrowseHeader";
import {
	DESKTOP_GRID,
	MOBILE_GRID,
	useDesktopCardSize,
	useMobileCardSize,
	useIsDraftMobile,
} from "./drafting/useResponsiveCardSize";
import type { SavedDeck } from "../savedDecks";

const CREW_SLOTS = FACETURN_CONSTANTS.CREW_SLOTS;
const MOVES_PER_DECK = FACETURN_CONSTANTS.MOVES_PER_DECK;

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

// single consistent sort. "type" sorts by class/type, bosses fall back to name.
// "cost" only for moves, everything else falls back to name.
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

const BOSS_SEARCH_TEXT = new Map(
	BOSS_DISPLAY.map((b) => [
		b.id,
		buildHaystack(b.name, b.effectText.command, b.effectText.passive),
	]),
);
const CREW_SEARCH_TEXT = new Map(
	CREW_DISPLAY.map((c) => [
		c.id,
		buildHaystack(c.name, c.effectText.revealed, c.effectText.passive),
	]),
);
const MOVE_SEARCH_TEXT = new Map(
	MOVE_DISPLAY.map((m) => [m.id, buildHaystack(m.name, m.effectText)]),
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

// overlay stamp for dealer reserve crew card, pointer events none so it doesn't block selection
function ReserveStamp() {
	return (
		<div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
			<span className="-rotate-6 px-4 py-1.5 rounded border-[3px] border-amber-400/90 text-amber-300 text-base font-black uppercase tracking-widest bg-black/55 backdrop-blur-[1px] shadow-[0_0_0_1px_rgba(0,0,0,0.4)]">
				Reserve
			</span>
		</div>
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

// shared shell for toolbar popovers, outside click and escape to dismiss
function ToolbarPopover({
	label,
	icon,
	active,
	open,
	onToggle,
	children,
	panelClassName,
	disabled,
}: {
	label: string;
	icon: ReactNode;
	active: boolean;
	open: boolean;
	onToggle: () => void;
	children: ReactNode;
	panelClassName?: string;
	disabled?: boolean;
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
				className={cn(
					"flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all",
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
				{label}
			</button>

			{open && !disabled && (
				<div
					className={cn(
						"absolute z-20 top-full right-0 mt-1 rounded-lg border ft-draft-panel shadow-xl overflow-hidden",
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
}: {
	sort: SortValue;
	onChange: (value: SortValue) => void;
	direction: SortDirection;
	onDirectionChange: (value: SortDirection) => void;
}) {
	const [open, setOpen] = useState(false);

	return (
		<ToolbarPopover
			label="Sort"
			active={direction !== "asc"}
			open={open}
			onToggle={() => setOpen((v) => !v)}
			panelClassName="w-44"
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
}: {
	pickedFilter: PickedFilterValue;
	onPickedChange: (value: PickedFilterValue) => void;
	variantFilter: ReadonlySet<CrewClass | MoveType>;
	onToggleVariant: (value: CrewClass | MoveType) => void;
	onReset: () => void;
}) {
	const [open, setOpen] = useState(false);
	const activeCount = (pickedFilter !== "all" ? 1 : 0) + variantFilter.size;

	return (
		<ToolbarPopover
			label="Filter"
			active={activeCount > 0}
			open={open}
			onToggle={() => setOpen((v) => !v)}
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

// clear confirmation as popover, consistent with sort/filter
function ClearPopover({
	disabled,
	onConfirm,
}: {
	disabled: boolean;
	onConfirm: () => void;
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

function CardGrid({
	cardSize,
	columns,
	gap,
	paddingX,
	children,
}: {
	cardSize: number;
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
					gridTemplateColumns: `repeat(${columns}, ${cardSize}px)`,
					gap: `${gap}px`,
					padding: `${gap}px ${paddingX}px`,
					maxWidth: cardSize * columns + gap * (columns - 1) + paddingX * 2,
				}}
			>
				{children}
			</div>
		</div>
	);
}

export function DraftingPhase() {
	const { ft, secret, playerId } = useFaceturnState();
	// width based, not pointer
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
	const desktopGrid = useDesktopCardSize();
	const mobileGrid = useMobileCardSize();
	const { containerRef, cardSize } = isMobile ? mobileGrid : desktopGrid;
	const gridMetrics = isMobile ? MOBILE_GRID : DESKTOP_GRID;

	const myDraft = ft?.draft?.[playerId];
	const { locked, runLocked } = useActionLock(myDraft?.isDraftLocked);
	const { inspect, modal: inspectModal } = useCardInspect();

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
	const isDealer = sel.bossId === "the-dealer";
	const crewMax = isDealer ? CREW_SLOTS + 1 : CREW_SLOTS;

	const bossDone = sel.bossId !== null;
	const crewDone = sel.crewIds.length === crewMax;
	const movesDone = sel.moveIds.length === MOVES_PER_DECK;
	const allDone = bossDone && crewDone && movesDone;
	const crewFull = sel.crewIds.length >= crewMax;
	const movesFull = sel.moveIds.length >= MOVES_PER_DECK;

	// dealer reserve index mirrors server assignment
	const reserveCrewId =
		isDealer && sel.crewIds.length > CREW_SLOTS
			? sel.crewIds[CREW_SLOTS]
			: null;

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

	// pick order: boss, crew, moves
	const pickedEntries: PickedEntry[] = [];
	if (sel.bossId) {
		const boss = BOSS_DISPLAY.find((b) => b.id === sel.bossId);
		if (boss)
			pickedEntries.push({ kind: "boss", id: boss.id, name: boss.name });
	}
	for (const crewId of sel.crewIds) {
		const crew = DRAFTABLE_CREW.find((c) => c.id === crewId);
		if (crew)
			pickedEntries.push({
				kind: "crew",
				id: crew.id,
				name: crew.name,
				crewClass: crew.class,
				isReserve: crew.id === reserveCrewId,
			});
	}
	for (const moveId of sel.moveIds) {
		const move = MOVE_DISPLAY.find((m) => m.id === moveId);
		if (move)
			pickedEntries.push({
				kind: "move",
				id: move.id,
				name: move.name,
				baseCost: move.baseCost,
				moveType: move.moveType,
			});
	}

	// select_boss toggles server-side
	function deselect(entry: PickedEntry) {
		if (entry.kind === "boss") {
			sendFaceturnAction({ type: "select_boss", bossId: entry.id });
		} else if (entry.kind === "crew") {
			sendFaceturnAction({ type: "deselect_crew", crewId: entry.id });
		} else if (entry.kind === "move") {
			sendFaceturnAction({ type: "deselect_move", moveId: entry.id });
		}
	}

	async function loadSavedDeck(deck: SavedDeck) {
		if (pickedEntries.length > 0) {
			const ok = await modal.confirm({
				title: `Load "${deck.name}"?`,
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

	function handleDone() {
		runLocked(() => {
			sendFaceturnAction({ type: "lock_draft" });
		});
	}

	function handleRandomize() {
		sendFaceturnAction({ type: "randomize_draft" });
	}

	async function handleCopyCode() {
		const code = encodeDeckCode({
			bossId: sel.bossId,
			crewIds: [...sel.crewIds],
			moveIds: [...sel.moveIds],
		});
		try {
			await navigator.clipboard.writeText(code);
			toast.success("Deck code copied!", { duration: 2000 });
		} catch {
			toast.error("Couldn't copy — your browser blocked clipboard access.");
		}
	}

	// unselect everything via empty load_draft; confirmation in Clear popover
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
					Waiting for other players to finish drafting…
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

	// "all" interleaves boss, crew, moves in one grid
	const allEntries =
		tab === "all"
			? [
					...allFilteredBosses.map((boss) => {
						const selected = sel.bossId === boss.id;
						return {
							key: `boss:${boss.id}`,
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
							cardProps: crewToCard(crew),
							selected,
							isReserve: crew.id === reserveCrewId,
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

	const grid = (
		<div
			ref={containerRef}
			className="flex-1 min-h-0 overflow-y-auto ft-scroll"
		>
			{noResults && (
				<p className="px-4 py-10 text-xs text-white/30 text-center">
					{query.trim()
						? `No cards match "${query.trim()}".`
						: "No cards match your filters."}
				</p>
			)}

			{tab === "all" && allEntries.length > 0 && (
				<CardGrid
					cardSize={cardSize}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allEntries.map((entry, i) => (
						<div
							key={entry.key}
							className={cn(
								"relative transition-opacity",
								entry.selected && "opacity-45",
							)}
							onContextMenu={(e) => {
								e.preventDefault();
								inspect(entry.cardProps, {
									items: allEntriesCycleItems,
									index: i,
								});
							}}
						>
							<Card
								{...entry.cardProps}
								size={cardSize}
								selected={entry.selected}
								onClick={entry.onClick}
							/>
							{entry.isReserve && <ReserveStamp />}
						</div>
					))}
				</CardGrid>
			)}

			{tab === "boss" && allFilteredBosses.length > 0 && (
				<CardGrid
					cardSize={cardSize}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allFilteredBosses.map((boss, i) => {
						const selected = sel.bossId === boss.id;
						const cardProps = bossCycleItems[i];
						return (
							<div
								key={boss.id}
								className={cn("transition-opacity", selected && "opacity-45")}
								onContextMenu={(e) => {
									e.preventDefault();
									inspect(cardProps, { items: bossCycleItems, index: i });
								}}
							>
								<Card
									{...cardProps}
									size={cardSize}
									selected={selected}
									onClick={() => {
										sendFaceturnAction({
											type: "select_boss",
											bossId: boss.id,
										});
									}}
								/>
							</div>
						);
					})}
				</CardGrid>
			)}

			{tab === "crew" && allFilteredCrew.length > 0 && (
				<CardGrid
					cardSize={cardSize}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allFilteredCrew.map((crew, i) => {
						const selected = sel.crewIds.includes(crew.id);
						const cardProps = crewCycleItems[i];
						const isReserve = crew.id === reserveCrewId;
						return (
							<div
								key={crew.id}
								className={cn(
									"relative transition-opacity",
									selected && "opacity-45",
								)}
								onContextMenu={(e) => {
									e.preventDefault();
									inspect(cardProps, { items: crewCycleItems, index: i });
								}}
							>
								<Card
									{...cardProps}
									size={cardSize}
									selected={selected}
									onClick={() => {
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
								/>
								{isReserve && <ReserveStamp />}
							</div>
						);
					})}
				</CardGrid>
			)}

			{tab === "moves" && allFilteredMoves.length > 0 && (
				<CardGrid
					cardSize={cardSize}
					columns={gridMetrics.columns}
					gap={gridMetrics.gap}
					paddingX={gridMetrics.paddingX}
				>
					{allFilteredMoves.map((move, i) => {
						const selected = sel.moveIds.includes(move.id);
						const cardProps = moveCycleItems[i];
						return (
							<div
								key={move.id}
								className={cn("transition-opacity", selected && "opacity-45")}
								onContextMenu={(e) => {
									e.preventDefault();
									inspect(cardProps, { items: moveCycleItems, index: i });
								}}
							>
								<Card
									{...cardProps}
									size={cardSize}
									selected={selected}
									onClick={() => {
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
								/>
							</div>
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
					onDeselect={deselect}
				/>

				{inspectModal}
			</div>
		);
	}

	return (
		<div className="flex h-full min-h-0 ft-draft-bg">
			<div className="w-72 shrink-0 flex flex-col min-h-0 border-r border-white/10">
				<div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
					<p className="text-[10px] font-black tracking-widest uppercase text-white/40">
						Your draft
					</p>
					<MyDecksMenu
						currentSelections={sel}
						hasCurrentPicks={pickedEntries.length > 0}
						disabled={locked}
						onLoad={(deck) => void loadSavedDeck(deck)}
					/>
				</div>

				<div className="flex-1 min-h-0 overflow-y-auto ft-scroll">
					{pickedEntries.length === 0 ? (
						<p className="px-4 py-6 text-xs text-white/30 text-center">
							Nothing drafted yet — pick a boss, crew, and moves on the right.
						</p>
					) : (
						pickedEntries.map((entry) => (
							<SidebarRow
								key={`${entry.kind}-${entry.id}`}
								entry={entry}
								onDeselect={() => {
									deselect(entry);
								}}
							/>
						))
					)}
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
				/>
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
							placeholder="Search cards…"
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
					/>
					<FilterPanel
						pickedFilter={pickedFilter}
						onPickedChange={setPickedFilter}
						variantFilter={variantFilter}
						onToggleVariant={toggleVariant}
						onReset={resetAllFilters}
					/>

					<div className="flex items-center gap-2 shrink-0 ml-auto">
						<button
							type="button"
							disabled={pickedEntries.length === 0}
							onClick={() => void handleCopyCode()}
							title={
								pickedEntries.length > 0
									? "Copy your current draft as a shareable code"
									: "Pick something first"
							}
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all shrink-0",
								pickedEntries.length > 0
									? "border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white cursor-pointer"
									: "border-white/10 text-white/20 cursor-not-allowed",
							)}
						>
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
							Copy code
						</button>

						<button
							type="button"
							disabled={allDone || locked}
							onClick={handleRandomize}
							title="Randomly fill whatever's still empty — doesn't touch what you've already picked"
							className={cn(
								"flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest transition-all shrink-0",
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
							Randomize
						</button>

						<ClearPopover
							disabled={pickedEntries.length === 0 || locked}
							onConfirm={handleClear}
						/>
					</div>
				</div>

				{grid}
			</div>

			{inspectModal}
		</div>
	);
}