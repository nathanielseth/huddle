import { cn } from "../../../lib/utils/cn";
import type { ManokView } from "@shared/games/sabong/index";

interface ManokCardProps {
	manok: ManokView;
	corner?: "red" | "blue";
	selected?: boolean;
	winner?: boolean;
	loser?: boolean;
	onClick?: () => void;
	disabled?: boolean;
	compact?: boolean;
	sabotaged?: boolean;
	currentHp?: number;
}

const STAT_CONFIG = [
	{ key: "health" as const, label: "HP", max: 150 },
	{ key: "attack" as const, label: "ATK", max: 100 },
	{ key: "defense" as const, label: "DEF", max: 90 },
	{ key: "speed" as const, label: "SPD", max: 100 },
	{ key: "critRate" as const, label: "CRIT", max: 85 },
];

const CORNER = {
	red: {
		label: "RED CORNER",
		accent: "#ef4444",
		border: "border-red-500/50",
		glow: "shadow-[0_0_0_1.5px_#ef4444,0_0_28px_rgba(239,68,68,0.2)]",
		text: "text-red-400",
		bar: "bg-red-400",
		bg: "bg-[radial-gradient(ellipse_120%_80%_at_0%_50%,rgba(239,68,68,0.07),transparent_60%)]",
	},
	blue: {
		label: "BLUE CORNER",
		accent: "#60a5fa",
		border: "border-blue-400/50",
		glow: "shadow-[0_0_0_1.5px_#60a5fa,0_0_28px_rgba(96,165,250,0.2)]",
		text: "text-blue-400",
		bar: "bg-blue-400",
		bg: "bg-[radial-gradient(ellipse_120%_80%_at_100%_50%,rgba(96,165,250,0.07),transparent_60%)]",
	},
} as const;

function StatBar({
	label,
	value,
	max,
	compact,
	barClass,
}: {
	label: string;
	value: number | null;
	max: number;
	compact?: boolean;
	barClass?: string;
}) {
	const hidden = value === null;
	const pct = hidden ? 0 : Math.min((value / max) * 100, 100);

	return (
		<div className="flex items-center gap-2">
			<span className="w-7 shrink-0 text-[9px] font-black tracking-[0.15em] uppercase text-white/25">
				{label}
			</span>
			<div className="relative flex-1 h-1.25 rounded-full bg-white/8 overflow-hidden">
				{!hidden && (
					<div
						className={cn(
							"h-full rounded-full transition-all duration-300",
							barClass ?? "bg-white/35",
						)}
						style={{ width: `${pct}%` }}
					/>
				)}
			</div>
			<span
				className={cn(
					"w-6 shrink-0 text-right font-display font-bold tabular-nums leading-none",
					compact ? "text-xs" : "text-sm",
					hidden ? "text-white/20" : "text-white/60",
				)}
			>
				{hidden ? "??" : value}
			</span>
		</div>
	);
}

function formatOdds(ml: number) {
	return ml > 0 ? `+${ml}` : `${ml}`;
}

export function ManokCard({
	manok,
	corner,
	selected = false,
	winner = false,
	loser = false,
	onClick,
	disabled = false,
	compact = false,
	sabotaged = false,
	currentHp,
}: ManokCardProps) {
	const clickable = !!onClick && !disabled;
	const cfg = corner ? CORNER[corner] : null;

	const hpValue = currentHp ?? manok.maxHp;
	const hpPct = Math.max((hpValue / manok.maxHp) * 100, 0);
	const hpColor =
		hpPct > 50 ? "bg-green-400" : hpPct > 25 ? "bg-yellow-400" : "bg-red-400";

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || !onClick}
			className={cn(
				"relative flex flex-col w-full overflow-hidden rounded-2xl border text-left transition-all duration-200",
				compact ? "gap-2.5 p-3" : "gap-3 p-4",
				// base
				"bg-surface-raised",
				cfg ? cfg.bg : "",
				// border
				winner && "border-gold/60",
				loser && "border-white/5",
				selected && cfg && cn(cfg.border, cfg.glow),
				selected &&
					!cfg &&
					"border-orange-400/80 shadow-[0_0_0_1.5px_#f97316,0_0_24px_rgba(249,115,22,0.25)]",
				!winner && !loser && !selected && cfg && cfg.border,
				!winner && !loser && !selected && !cfg && "border-border",
				sabotaged && !selected && !winner && "border-red-900/50",
				// winner state
				winner &&
					"shadow-[0_0_0_1.5px_#e8b93a,0_0_32px_rgba(232,185,58,0.2)] bg-[radial-gradient(ellipse_at_center,rgba(232,185,58,0.06),transparent_70%)]",
				// loser state
				loser && "opacity-30 grayscale",
				// interaction
				clickable && "cursor-pointer hover:brightness-110 active:scale-[0.98]",
				!clickable && "cursor-default",
			)}
		>
			{/* left accent bar */}
			{cfg && (
				<div
					className="absolute left-0 top-0 bottom-0 w-0.75 rounded-l-2xl"
					style={{ backgroundColor: cfg.accent }}
				/>
			)}

			{/* corner label + odds */}
			<div className="flex items-center justify-between gap-2">
				<span
					className={cn(
						"text-[9px] font-black tracking-[0.2em] uppercase",
						cfg ? cfg.text : "text-white/20",
					)}
				>
					{cfg ? cfg.label : "FIGHTER"}
				</span>

				{manok.moneylineOdds !== 0 && (
					<span
						className={cn(
							"shrink-0 rounded px-2 py-0.5 font-display text-sm font-black tabular-nums border",
							manok.moneylineOdds > 0
								? "bg-green-500/10 text-green-400 border-green-500/20"
								: "bg-red-500/8  text-red-400  border-red-500/20",
						)}
					>
						{formatOdds(manok.moneylineOdds)}
					</span>
				)}
			</div>

			{/* fighter name */}
			<div className="flex items-baseline gap-2">
				<h3
					className={cn(
						"font-display font-black uppercase leading-none tracking-tight",
						compact ? "text-2xl" : "text-[1.75rem]",
						winner ? "text-gold" : "text-white",
					)}
				>
					{manok.name}
				</h3>
				{sabotaged && <span className="text-sm leading-none">💀</span>}
				{winner && (
					<span className="text-[9px] font-black tracking-[0.2em] uppercase text-gold border border-gold/40 rounded px-1.5 py-0.5">
						WIN
					</span>
				)}
			</div>

			{/* stat bars */}
			<div className={cn("flex flex-col", compact ? "gap-1.25" : "gap-1.5")}>
				{STAT_CONFIG.map(({ key, label, max }) => (
					<StatBar
						key={key}
						label={label}
						value={manok.stats[key]}
						max={max}
						compact={compact}
						barClass={cfg?.bar}
					/>
				))}
			</div>

			{/* HP bar */}
			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<span className="text-[9px] font-black tracking-[0.15em] uppercase text-white/20">
						HEALTH
					</span>
					<span className="font-display text-[10px] font-bold tabular-nums text-white/30">
						{hpValue} / {manok.maxHp}
					</span>
				</div>
				{/* dual bar: trail behind main */}
				<div className="relative h-2 rounded-full bg-white/8 overflow-hidden">
					{/* damage trail */}
					<div
						className={cn(
							"absolute inset-y-0 left-0 rounded-full opacity-30 transition-all duration-700",
							hpColor,
						)}
						style={{ width: `${hpPct}%` }}
					/>
					{/* main bar */}
					<div
						className={cn(
							"absolute inset-y-0 left-0 rounded-full transition-all duration-300",
							hpColor,
						)}
						style={{ width: `${hpPct}%` }}
					/>
				</div>
			</div>
		</button>
	);
}
