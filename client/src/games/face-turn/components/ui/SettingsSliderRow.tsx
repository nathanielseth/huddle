import type { ReactNode } from "react";

export function SettingsSliderRow({
	icon,
	label,
	value,
	valueLabel,
	min,
	max,
	step = 1,
	disabled,
	minCaption,
	midCaption,
	maxCaption,
	onChange,
}: {
	icon: ReactNode;
	label: string;
	value: number;
	valueLabel: string;
	min: number;
	max: number;
	step?: number;
	disabled?: boolean;
	minCaption: string;
	midCaption: string;
	maxCaption: string;
	onChange: (value: number) => void;
}) {
	return (
		<div className="flex flex-col gap-2.5 p-3 rounded-lg bg-white/[0.03] border border-white/10">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="shrink-0 text-white/50">{icon}</span>
					<span className="text-xs font-bold text-white/85 truncate">
						{label}
					</span>
				</div>
				<span className="shrink-0 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-black tabular-nums text-white/70">
					{valueLabel}
				</span>
			</div>

			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				disabled={disabled}
				onChange={(e) => {
					onChange(Number(e.target.value));
				}}
				className="ft-settings-slider w-full"
				style={
					{
						"--ft-slider-fill": `${((value - min) / (max - min)) * 100}%`,
					} as React.CSSProperties
				}
			/>

			<div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-white/25">
				<span>{minCaption}</span>
				<span>{midCaption}</span>
				<span>{maxCaption}</span>
			</div>
		</div>
	);
}
