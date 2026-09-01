import "./rps.css";
import { cn } from "../../../../lib/utils/cn";
import { RpsGlyph } from "./RpsGlyph";
import type { RpsChoice } from "@shared/games/face-turn/types";

export interface RpsCardProps {
	choice?: RpsChoice;
	revealed: boolean;
	size?: number;
	tone?: "neutral" | "selected" | "win" | "lose";
	className?: string;
}

const TONE_RING: Record<NonNullable<RpsCardProps["tone"]>, string> = {
	neutral: "border-white/15",
	selected: "border-amber-400",
	win: "border-sky-400",
	lose: "border-rose-500",
};

const TONE_GLOW: Record<NonNullable<RpsCardProps["tone"]>, string> = {
	neutral: "",
	selected: "shadow-[0_0_18px_rgba(251,191,36,0.35)]",
	win: "shadow-[0_0_22px_rgba(56,189,248,0.4)]",
	lose: "shadow-[0_0_22px_rgba(244,63,94,0.35)]",
};

export function RpsCard({
	choice,
	revealed,
	size = 88,
	tone = "neutral",
	className,
}: RpsCardProps) {
	return (
		<div
			className={cn("rps-flip", revealed && "is-flipped", className)}
			style={{ width: size, height: size * 1.4 }}
		>
			<div className="rps-flip-inner">
				{/* back: face-down, always the "unrevealed" state */}
				<div
					className={cn(
						"rps-face-back rps-cardback-pattern ft-panel-ink border-2 transition-colors",
						TONE_RING[tone],
						TONE_GLOW[tone],
					)}
				>
					<div
						className={cn(
							"w-1/2 h-1/2 rounded-full border border-white/20",
							!revealed && tone === "neutral" && "rps-cardback-shimmer",
						)}
					/>
				</div>
				{/* front: revealed hand-sign */}
				<div
					className={cn(
						"rps-face-front border-2 bg-[#f4efe4] text-[#1b1712] transition-colors",
						TONE_RING[tone],
						TONE_GLOW[tone],
					)}
				>
					{choice && <RpsGlyph choice={choice} className="w-3/5 h-3/5" />}
				</div>
			</div>
		</div>
	);
}
