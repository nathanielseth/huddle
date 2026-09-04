import "./rps.css";
import "../../components/card/card.css";
import type { CSSProperties } from "react";
import { m } from "motion/react";
import { cn } from "../../../../lib/utils/cn";
import { RpsGlyph } from "./RpsGlyph";
import { FaceTurnLogo } from "../../components/card/ftLogo";
import { RPS_TEAM_ACCENT, type RpsTeamColor } from "./rpsTeamColors";
import type { RpsChoice } from "@shared/games/face-turn/types";

export interface RpsCardProps {
	choice?: RpsChoice;
	revealed: boolean;
	teamColor: RpsTeamColor;
	size?: number;
	tone?: "neutral" | "selected" | "win" | "lose";
	className?: string;
	// when set, the card is rendered as a motion element sharing this id —
	// used to fly the picked option card into its reveal slot (see RpsPhase)
	layoutId?: string;
}

const TONE_GLOW: Record<NonNullable<RpsCardProps["tone"]>, string> = {
	neutral: "",
	selected: "shadow-[0_0_18px_rgba(251,191,36,0.35)]",
	win: "shadow-[0_0_22px_rgba(56,189,248,0.4)]",
	lose: "shadow-[0_0_22px_rgba(244,63,94,0.35)]",
};

export function RpsCard({
	choice,
	revealed,
	teamColor,
	size = 150,
	tone = "neutral",
	className,
	layoutId,
}: RpsCardProps) {
	const { accent, glow } = RPS_TEAM_ACCENT[teamColor];

	const Wrapper = layoutId ? m.div : "div";
	const wrapperProps = layoutId
		? {
				layoutId,
				transition: { type: "spring" as const, stiffness: 320, damping: 32 },
			}
		: {};

	return (
		<Wrapper
			className={cn("rps-flip", revealed && "is-flipped", className)}
			style={{ width: size, height: size * (88 / 63) }}
			{...wrapperProps}
		>
			<div className="rps-flip-inner">
				{/* back: face-down, always the "unrevealed" state — same card back art as everywhere else */}
				<div
					className={cn(
						"rps-face-back overflow-hidden",
						TONE_GLOW[tone],
					)}
				>
					<div className="back-panel">
						<FaceTurnLogo
							className={cn(
								"back-panel-logo",
								!revealed && tone === "neutral" && "rps-cardback-shimmer",
							)}
						/>
					</div>
				</div>
				{/* front: real card frame, minus badge/title/text — team-colored
				    "art" area holds the revealed hand-sign */}
				<div
					className={cn(
						"rps-face-front rps-art-face",
						TONE_GLOW[tone],
					)}
					style={
						{
							"--rps-accent": accent,
							"--rps-glow": glow,
						} as CSSProperties
					}
				>
					<div className="rps-art-inner">
						{choice && <RpsGlyph choice={choice} className="rps-art-glyph" />}
					</div>
				</div>
			</div>
		</Wrapper>
	);
}
