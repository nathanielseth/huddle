import { useCountdown } from "../../../hooks/core/useCountdown";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { cn } from "../../../lib/utils/cn";

const URGENT_THRESHOLD_MS = 5_000;

function formatRemaining(ms: number): string {
	const totalSeconds = Math.ceil(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function PhaseTimer() {
	const { timer } = useFaceturnState();
	const remainingMs = useCountdown(timer);

	if (!timer) return null;

	const urgent = remainingMs < URGENT_THRESHOLD_MS;

	return (
		<span
			className={cn(
				"ft-eyebrow tabular-nums text-xs",
				urgent ? "text-[#ff5656]" : "text-white/60",
			)}
			data-urgent={urgent || undefined}
			role="timer"
			aria-label="Time remaining this phase"
		>
			{formatRemaining(remainingMs)}
		</span>
	);
}