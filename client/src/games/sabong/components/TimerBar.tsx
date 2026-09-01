import { useCountdown } from "../../../hooks/core/useCountdown";
import { m, AnimatePresence } from "motion/react";
import type { GameTimer } from "@shared/core/room";
import { cn } from "../../../lib/utils/cn";

interface TimerBarProps {
	timer: GameTimer | null;
	className?: string;
}

export function TimerBar({ timer, className }: TimerBarProps) {
	const remaining = useCountdown(timer);
	const total = timer?.duration ?? 1;
	const pct = Math.max((remaining / total) * 100, 0);
	const secs = Math.ceil(remaining / 1000);
	const urgent = secs <= 10;
	const critical = secs <= 5;

	return (
		<div className={cn("flex items-center gap-3", className)}>
			{/* bar track */}
			<div className="relative flex-1 h-1.5 overflow-hidden rounded-full bg-white/8">
				<div
					className={cn(
						"absolute inset-y-0 left-0 rounded-full transition-all duration-300",
						critical ? "bg-red-400" : "bg-orange-400",
					)}
					style={{ width: `${pct}%` }}
				/>
				{/* pulse overlay when urgent */}
				{urgent && (
					<m.div
						className="absolute inset-0 rounded-full bg-red-400/25"
						animate={{ opacity: [0, 1, 0] }}
						transition={{ repeat: Infinity, duration: 0.9, ease: "easeInOut" }}
					/>
				)}
			</div>

			{/* second counter - pops on each tick when critical */}
			<AnimatePresence mode="wait">
				<m.span
					key={secs}
					className={cn(
						"font-display font-black tabular-nums w-10 text-right leading-none",
						critical
							? "text-red-400 text-lg"
							: urgent
								? "text-orange-400 text-base"
								: "text-white/40 text-sm",
					)}
					initial={critical ? { scale: 1.3, opacity: 0.6 } : { opacity: 0.6 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ duration: 0.15, ease: "easeOut" }}
				>
					{secs}s
				</m.span>
			</AnimatePresence>
		</div>
	);
}
