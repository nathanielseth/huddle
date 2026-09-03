import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../../../lib/utils/cn";
import type { CrewClass, MoveType } from "@shared/games/face-turn/types";
import { CARD_VARIANT_THEME } from "../../components/card/cardVariants";

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

function CountBadge({ current, max }: { current: number; max: number }) {
	return (
		<span
			className={cn(
				"text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full border",
				current === max
					? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
					: "border-amber-400/40 bg-amber-400/10 text-amber-300",
			)}
		>
			{current}/{max}
		</span>
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

// shared shell for the sort / filter / clear popovers, mirrors the desktop
// toolbar so mobile and desktop feel like the same component at different sizes
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
					"flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border transition-all",
					disabled
						? "border-white/10 text-white/20 cursor-not-allowed"
						: cn(
								"active:scale-95 cursor-pointer",
								active || open
									? "border-white/30 bg-white/10 text-white"
									: "border-white/15 bg-white/5 text-white/60",
							),
				)}
				aria-label={label}
				title={label}
			>
				{icon}
			</button>

			{open && !disabled && (
				<div
					className={cn(
						"absolute z-30 top-full right-0 mt-1 rounded-lg border ft-draft-panel shadow-xl overflow-hidden",
						panelClassName ?? "w-72",
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
					className="w-4 h-4"
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
							"flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-bold text-left transition-colors cursor-pointer",
							sort === opt
								? "bg-white/10 text-white"
								: "text-white/60 active:bg-white/5",
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
						className="flex items-center gap-2 px-2.5 py-2 rounded-md active:bg-white/5 cursor-pointer"
					>
						<input
							type="radio"
							name="sort-direction-mobile"
							checked={direction === dir}
							onChange={() => onDirectionChange(dir)}
							className="accent-emerald-400 w-4 h-4"
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

// mobile filter panel, opens from a single button instead of always-visible chips
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
					className="w-4 h-4"
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
			<div className="max-h-96 overflow-y-auto p-3 flex flex-col gap-4">
				<FilterSection label="Status">
					<div className="flex flex-col gap-1">
						{PICKED_FILTERS.map((opt) => (
							<label
								key={opt}
								className="flex items-center gap-2 px-2 py-2 rounded-md active:bg-white/5"
							>
								<input
									type="radio"
									name="picked-filter-mobile"
									checked={pickedFilter === opt}
									onChange={() => onPickedChange(opt)}
									className="accent-emerald-400 w-4 h-4"
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
						"w-full px-2 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-colors",
						activeCount > 0
							? "bg-white/10 active:bg-white/20 text-white/80 cursor-pointer"
							: "bg-white/5 text-white/25 cursor-not-allowed",
					)}
				>
					Reset filters
				</button>
			</div>
		</ToolbarPopover>
	);
}

// clear confirmation as a popover, consistent with sort/filter — no modal
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
			label="Clear draft"
			active={false}
			open={open}
			disabled={disabled}
			onToggle={() => setOpen((v) => !v)}
			panelClassName="w-56"
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-4 h-4"
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
						className="flex-1 px-2 py-2 rounded text-[10px] font-black uppercase tracking-widest bg-white/5 active:bg-white/10 text-white/70 cursor-pointer transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => {
							setOpen(false);
							onConfirm();
						}}
						className="flex-1 px-2 py-2 rounded text-[10px] font-black uppercase tracking-widest bg-red-500/15 active:bg-red-500/25 border border-red-400/30 text-red-300 cursor-pointer transition-colors"
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
				"px-2.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer active:scale-95",
				active ? "text-white" : "border-white/10 bg-white/3 text-white/40",
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

export function MobileBrowseHeader({
	tab,
	setTab,
	bossDone,
	crewCount,
	crewMax,
	moveCount,
	moveMax,
	query,
	setQuery,
	sort,
	setSort,
	sortDirection,
	setSortDirection,
	pickedFilter,
	setPickedFilter,
	variantFilter,
	onToggleVariant,
	onResetFilters,
	onRandomize,
	randomizeDisabled,
	onClear,
	clearDisabled,
	onCopyCode,
	copyCodeDisabled,
}: {
	tab: DraftTab;
	setTab: (tab: DraftTab) => void;
	bossDone: boolean;
	crewCount: number;
	crewMax: number;
	moveCount: number;
	moveMax: number;
	query: string;
	setQuery: (query: string) => void;
	sort: SortValue;
	setSort: (sort: SortValue) => void;
	sortDirection: SortDirection;
	setSortDirection: (direction: SortDirection) => void;
	pickedFilter: PickedFilterValue;
	setPickedFilter: (filter: PickedFilterValue) => void;
	variantFilter: ReadonlySet<CrewClass | MoveType>;
	onToggleVariant: (value: CrewClass | MoveType) => void;
	onResetFilters: () => void;
	onRandomize: () => void;
	randomizeDisabled: boolean;
	onClear: () => void;
	clearDisabled: boolean;
	onCopyCode: () => void;
	copyCodeDisabled: boolean;
}) {
	return (
		<div className="flex flex-col gap-2 px-4 pt-2.5 pb-2 border-b border-white/10">
			{/* tabs, full width, largest targets on screen */}
			<div className="grid grid-cols-4 gap-1.5">
				<button
					type="button"
					onClick={() => {
						setTab("all");
					}}
					className={cn(
						"flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer active:scale-[0.97]",
						tab === "all"
							? "bg-white/10 text-white"
							: "bg-white/5 text-white/40",
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
						"flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer active:scale-[0.97]",
						tab === "boss"
							? "bg-white/10 text-white"
							: "bg-white/5 text-white/40",
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
						"flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer active:scale-[0.97]",
						tab === "crew"
							? "bg-white/10 text-white"
							: "bg-white/5 text-white/40",
					)}
				>
					Crew <CountBadge current={crewCount} max={crewMax} />
				</button>
				<button
					type="button"
					onClick={() => {
						setTab("moves");
					}}
					className={cn(
						"flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all cursor-pointer active:scale-[0.97]",
						tab === "moves"
							? "bg-white/10 text-white"
							: "bg-white/5 text-white/40",
					)}
				>
					Moves <CountBadge current={moveCount} max={moveMax} />
				</button>
			</div>

			{/* search + copy + randomize */}
			<div className="flex items-center gap-2">
				<div className="relative flex-1 min-w-0">
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
						inputMode="search"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
						}}
						placeholder="Search cards…"
						className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white placeholder:text-white/30 outline-none focus:border-white/30 transition-colors"
					/>
				</div>
				<button
					type="button"
					disabled={copyCodeDisabled}
					onClick={onCopyCode}
					title="Copy your current draft as a shareable code"
					aria-label="Copy deck code"
					className={cn(
						"flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border transition-all",
						!copyCodeDisabled
							? "border-white/15 bg-white/5 text-white/60 active:scale-95 cursor-pointer"
							: "border-white/10 text-white/20 cursor-not-allowed",
					)}
				>
					<svg
						viewBox="0 0 24 24"
						className="w-4 h-4"
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
				</button>
				<button
					type="button"
					disabled={randomizeDisabled}
					onClick={onRandomize}
					title="Randomly fill whatever's still empty"
					aria-label="Randomize remaining picks"
					className={cn(
						"flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border transition-all",
						!randomizeDisabled
							? "border-white/15 bg-white/5 text-white/60 active:scale-95 cursor-pointer"
							: "border-white/10 text-white/20 cursor-not-allowed",
					)}
				>
					<svg
						viewBox="0 0 24 24"
						className="w-4 h-4"
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
				</button>
				<ClearPopover disabled={clearDisabled} onConfirm={onClear} />
			</div>

			{/* sort + filter, consistent across every tab */}
			<div className="flex justify-end gap-2">
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
					onToggleVariant={onToggleVariant}
					onReset={onResetFilters}
				/>
			</div>
		</div>
	);
}