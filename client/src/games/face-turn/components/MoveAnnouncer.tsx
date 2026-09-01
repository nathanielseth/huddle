import "../board.css";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import type { ComponentType } from "react";
import { useReducedMotion } from "../../../hooks/a11y/useReducedMotion";
import { cn } from "../../../lib/utils/cn";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useMoveAnnouncements } from "../hooks/useMoveAnnouncements";
import type { Announcement } from "../lib/announceEvent";
import {
	BurstIcon,
	HourglassIcon,
	LoopIcon,
	SwordIcon,
	CrownIcon,
	type IconProps,
} from "./card/CardIcons";

const ENTER_DURATION_S = 0.22;
const EXIT_DURATION_S = 0.16;
const EASE = [0.4, 0, 0.2, 1] as const;

const TONE_ICON: Record<Announcement["tone"], ComponentType<IconProps>> = {
	burst: BurstIcon,
	slow: HourglassIcon,
	active: LoopIcon,
	danger: SwordIcon,
	success: CrownIcon,
	neutral: LoopIcon,
};

// same palette as cardVariants
const TONE_ACCENT: Record<Announcement["tone"], string> = {
	burst: "#4C9EFF",
	slow: "#3ECF8E",
	active: "#B26CFF",
	danger: "#FF5656",
	success: "#FFC53D",
	neutral: "#8A93A0",
};

export function MoveAnnouncer() {
	const { ft, playerMap } = useFaceturnState();
	const log = ft?.log ?? [];
	const { current, onExited } = useMoveAnnouncements(log, playerMap);
	const reducedMotion = useReducedMotion();

	return (
		<div className="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center px-4">
			<AnimatePresence mode="wait" onExitComplete={onExited}>
				{current && (
					<AnnouncementCard
						key={current.id}
						announcement={current}
						reducedMotion={reducedMotion}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

function AnnouncementCard({
	announcement,
	reducedMotion,
}: {
	announcement: Announcement;
	reducedMotion: boolean;
}) {
	const Icon = TONE_ICON[announcement.tone];
	const accent = TONE_ACCENT[announcement.tone];

	const enterTransition = {
		duration: reducedMotion ? 0 : ENTER_DURATION_S,
		ease: EASE,
	};
	const exitTransition = {
		duration: reducedMotion ? 0 : EXIT_DURATION_S,
		ease: EASE,
	};

	const initial = reducedMotion
		? { opacity: 0 }
		: { opacity: 0, y: -14, scale: 0.92 };
	const animate = reducedMotion
		? { opacity: 1, transition: enterTransition }
		: { opacity: 1, y: 0, scale: 1, transition: enterTransition };
	const exit = reducedMotion
		? { opacity: 0, transition: exitTransition }
		: { opacity: 0, y: -8, scale: 0.96, transition: exitTransition };

	return (
		<m.div
			role="status"
			aria-live="polite"
			initial={initial}
			animate={animate}
			exit={exit}
			className={cn(
				"ft-panel-ink flex items-center gap-3 rounded-xl border px-4 py-2.5",
				"shadow-2xl shadow-black/60",
			)}
			style={{ borderColor: `${accent}55` }}
		>
			<span
				className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
				style={{ backgroundColor: accent }}
			>
				<Icon className="h-4 w-4" />
			</span>
			<div className="flex flex-col leading-tight">
				<span className="ft-eyebrow text-sm" style={{ color: accent }}>
					{announcement.headline}
				</span>
				{announcement.subline && (
					<span className="text-[11px] text-white/60">
						{announcement.subline}
					</span>
				)}
			</div>
		</m.div>
	);
}