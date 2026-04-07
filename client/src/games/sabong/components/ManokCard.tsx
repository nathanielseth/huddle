import { cn } from "../../../utils/cn";
import type { ManokView } from "@shared/sabong";

interface ManokCardProps {
	manok: ManokView;
	selected?: boolean;
	winner?: boolean;
	loser?: boolean;
	onClick?: () => void;
	disabled?: boolean;
	compact?: boolean;
}

function formatStat(val: number | null): string {
	return val === null ? "??" : String(val);
}

function formatOdds(ml: number): string {
	if (ml === 0) return "—";
	return ml > 0 ? `+${ml}` : `${ml}`;
}

const STATS = [
	{ key: "health", label: "HP" },
	{ key: "attack", label: "ATK" },
	{ key: "defense", label: "DEF" },
	{ key: "speed", label: "SPD" },
	{ key: "critRate", label: "CRIT" },
] as const;

export function ManokCard({
	manok,
	selected = false,
	winner = false,
	loser = false,
	onClick,
	disabled = false,
	compact = false,
}: ManokCardProps) {
	const clickable = !!onClick && !disabled;

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || !onClick}
			className={cn(
				"relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-150 w-full",
				// base
				"bg-surface-raised",
				// border state
				selected &&
					"border-orange-400 shadow-[0_0_0_1px_var(--color-orange-400)]",
				winner && "border-green-400  shadow-[0_0_0_1px_var(--color-green-400)]",
				loser && "border-white/10   opacity-40",
				!selected && !winner && !loser && "border-border",
				// interaction
				clickable &&
					"cursor-pointer hover:border-white/30 hover:bg-surface-raised/80",
				!clickable && "cursor-default",
			)}
		>
			{/* name + odds row */}
			<div className="flex items-start justify-between gap-2">
				<span
					className={cn(
						"font-display font-black uppercase leading-none",
						compact ? "text-lg" : "text-2xl",
					)}
				>
					{manok.name}
				</span>
				{manok.moneylineOdds !== 0 && (
					<span
						className={cn(
							"shrink-0 rounded-md px-2 py-0.5 font-display text-sm font-bold tabular-nums",
							manok.moneylineOdds > 0
								? "bg-green-500/15 text-green-400"
								: "bg-red-500/15 text-red-400",
						)}
					>
						{formatOdds(manok.moneylineOdds)}
					</span>
				)}
			</div>

			{/* stats grid */}
			<div className="grid grid-cols-5 gap-1">
				{STATS.map(({ key, label }) => {
					const val = manok.stats[key];
					const hidden = val === null;
					return (
						<div key={key} className="flex flex-col items-center gap-0.5">
							<span className="text-[9px] font-semibold tracking-widest uppercase text-white/30">
								{label}
							</span>
							<span
								className={cn(
									"font-display text-base font-bold tabular-nums leading-none",
									hidden ? "text-white/20" : "text-white",
								)}
							>
								{formatStat(val)}
							</span>
						</div>
					);
				})}
			</div>

			{/* hp bar */}
			<div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
				<div
					className="h-full rounded-full bg-orange-400 transition-all duration-300"
					style={{
						width: `${(manok.maxHp / 150) * 100}%`, // 150 = STAT_RANGES.health max
					}}
				/>
			</div>
		</button>
	);
}
