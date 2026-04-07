import { useCountdown } from "../../../hooks/useCountDown";
import type { GameTimer } from "@shared/types";
import { cn } from "../../../utils/cn";

interface TimerBarProps {
	timer: GameTimer | null;
	className?: string;
}

export function TimerBar({ timer, className }: TimerBarProps) {
	const remaining = useCountdown(timer);
	const total = timer?.duration ?? 1;
	const pct = (remaining / total) * 100;
	const secs = Math.ceil(remaining / 1000);
	const urgent = secs <= 10;

	return (
		<div className={cn("flex items-center gap-3", className)}>
			<div className="relative flex-1 h-1.5 overflow-hidden rounded-full bg-white/8">
				<div
					className={cn(
						"absolute inset-y-0 left-0 rounded-full transition-all duration-300",
						urgent ? "bg-red-400" : "bg-orange-400",
					)}
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span
				className={cn(
					"font-display text-sm font-bold tabular-nums w-8 text-right",
					urgent ? "text-red-400" : "text-white/50",
				)}
			>
				{secs}s
			</span>
		</div>
	);
}
