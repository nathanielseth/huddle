import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type PanInfo } from "motion/react";
import { useStore } from "zustand";
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { toastStore, type Toast } from "../../lib/utils/toast";
import { useReducedMotion } from "../../hooks/a11y/useReducedMotion";

const VARIANTS = {
	success: {
		Icon: CheckCircle2,
		bar: "bg-emerald-500",
		icon: "text-emerald-400",
		action: "text-emerald-400",
	},
	error: {
		Icon: XCircle,
		bar: "bg-red-500",
		icon: "text-red-400",
		action: "text-red-400",
	},
	warning: {
		Icon: AlertTriangle,
		bar: "bg-amber-400",
		icon: "text-amber-400",
		action: "text-amber-400",
	},
	info: {
		Icon: Info,
		bar: "bg-sky-500",
		icon: "text-sky-400",
		action: "text-sky-400",
	},
} as const;

const SPRING = {
	type: "spring" as const,
	stiffness: 420,
	damping: 32,
	mass: 0.85,
};

function getAnimationProps(reduced: boolean) {
	if (reduced) {
		return {
			initial: { opacity: 0 },
			animate: { opacity: 1 },
			exit: { opacity: 0 },
			transition: { duration: 0.15 },
		};
	}
	return {
		initial: { opacity: 0, x: 48, scale: 0.94 },
		animate: { opacity: 1, x: 0, scale: 1 },
		exit: { opacity: 0, scale: 0.94, transition: { duration: 0.2 } },
		transition: SPRING,
	};
}

// ToastItem

interface ToastItemProps {
	t: Toast;
	onDismiss: (id: string) => void;
	reducedMotion: boolean;
}

function ToastItem({ t, onDismiss, reducedMotion }: ToastItemProps) {
	const [progress, setProgress] = useState(1);
	const isPersistent = t.duration === 0;

	const remainingRef = useRef(t.duration);
	const lastTickRef = useRef(0);
	const rafRef = useRef<number | null>(null);
	const dismissedRef = useRef(false);
	const tickRef = useRef<((now: number) => void) | null>(null);

	const [swipeX, setSwipeX] = useState<number | null>(null);
	const isSwipingAwayRef = useRef(false);

	useEffect(() => {
		if (isPersistent) return;

		remainingRef.current = t.duration;
		dismissedRef.current = false;

		const tick = (now: number) => {
			const delta = Math.min(now - lastTickRef.current, 50);
			lastTickRef.current = now;
			remainingRef.current = Math.max(0, remainingRef.current - delta);
			setProgress(remainingRef.current / t.duration);

			if (remainingRef.current <= 0 && !dismissedRef.current) {
				dismissedRef.current = true;
				toastStore.getState()._dismiss(t.id);
				return;
			}

			rafRef.current = requestAnimationFrame(tick);
		};

		tickRef.current = tick;
		lastTickRef.current = performance.now();
		rafRef.current = requestAnimationFrame(tick);

		return () => {
			tickRef.current = null;
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [t.duration, t.createdAt, t.id, isPersistent]);

	function handlePause() {
		if (isPersistent || rafRef.current === null) return;
		cancelAnimationFrame(rafRef.current);
		rafRef.current = null;
	}

	function handleResume() {
		if (
			isPersistent ||
			rafRef.current !== null ||
			dismissedRef.current ||
			!tickRef.current
		)
			return;
		lastTickRef.current = performance.now();
		rafRef.current = requestAnimationFrame(tickRef.current);
	}

	function handleDismiss() {
		dismissedRef.current = true;
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		onDismiss(t.id);
	}

	function handleDragEnd(_: unknown, info: PanInfo) {
		if (Math.abs(info.offset.x) > 60 || Math.abs(info.velocity.x) > 500) {
			dismissedRef.current = true;
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			isSwipingAwayRef.current = true;
			setSwipeX(window.innerWidth + 100);
		} else {
			handleResume();
		}
	}

	const cfg = VARIANTS[t.variant];
	const { Icon } = cfg;
	const animProps = getAnimationProps(reducedMotion);

	return (
		<motion.li
			layout
			layoutId={t.id}
			initial={animProps.initial}
			animate={swipeX !== null ? { x: swipeX, opacity: 0 } : animProps.animate}
			exit={animProps.exit}
			transition={
				swipeX !== null
					? { duration: 0.28, ease: [0.32, 0, 0.67, 0] }
					: animProps.transition
			}
			onAnimationComplete={() => {
				if (isSwipingAwayRef.current) {
					onDismiss(t.id);
				}
			}}
			onMouseEnter={handlePause}
			onMouseLeave={handleResume}
			drag={reducedMotion ? false : "x"}
			dragConstraints={{ left: 0, right: 0 }}
			dragElastic={0.7}
			onDragStart={handlePause}
			onDragEnd={handleDragEnd}
			whileDrag={{ scale: 1.02, cursor: "grabbing" }}
			className="relative w-85 max-w-[calc(100vw-2.5rem)] touch-pan-y overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
			role="alert"
			aria-live={t.variant === "error" ? "assertive" : "polite"}
			aria-atomic="true"
		>
			<span
				className={`absolute inset-y-0 left-0 w-0.75 rounded-l-xl ${cfg.bar}`}
			/>

			<div className="flex items-start gap-3 px-4 py-3 pl-4.5">
				<Icon
					size={16}
					strokeWidth={2.3}
					className={`mt-px shrink-0 ${cfg.icon}`}
					aria-hidden
				/>

				<div className="flex min-w-0 flex-1 flex-col gap-1.5">
					<p className="text-sm font-medium leading-snug text-white cursor-grab active:cursor-grabbing">
						{t.message}
					</p>

					{t.action && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								t.action!.onClick();
								handleDismiss();
							}}
							className={`self-start text-[11px] font-bold tracking-wider uppercase transition-opacity hover:opacity-75 cursor-pointer ${cfg.action}`}
						>
							{t.action.label} →
						</button>
					)}
				</div>

				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						handleDismiss();
					}}
					aria-label="Dismiss"
					className="mt-px shrink-0 cursor-pointer text-white/25 transition-colors hover:text-white/60"
				>
					<X size={13} strokeWidth={2.5} />
				</button>
			</div>

			{!isPersistent && (
				<div className="mx-4 mb-2.5 h-px overflow-hidden rounded-full bg-white/6">
					<div
						className={`h-full origin-left rounded-full opacity-70 ${cfg.bar}`}
						style={{ transform: `scaleX(${progress})` }}
					/>
				</div>
			)}
		</motion.li>
	);
}

// Toaster

export function Toaster() {
	const toasts = useStore(toastStore, (s) => s.toasts);
	const queueLength = useStore(toastStore, (s) => s.queue.length);
	const reducedMotion = useReducedMotion();

	function dismiss(id: string) {
		toastStore.getState()._dismiss(id);
	}

	return createPortal(
		<section
			aria-label="Notifications"
			className="pointer-events-none fixed top-5 left-1/2 z-9999 flex -translate-x-1/2 flex-col items-center gap-2 sm:left-auto sm:right-5 sm:translate-x-0 sm:items-end"
		>
			<ul className="pointer-events-auto flex flex-col items-end gap-2">
				<AnimatePresence mode="popLayout" initial={false}>
					{toasts.map((t) => (
						<ToastItem
							key={t.id}
							t={t}
							onDismiss={dismiss}
							reducedMotion={reducedMotion}
						/>
					))}
				</AnimatePresence>
			</ul>

			<AnimatePresence>
				{queueLength > 0 && (
					<motion.p
						key="queue-badge"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.15 }}
						className="pointer-events-none select-none text-[10px] font-bold tracking-widest uppercase text-white/25"
					>
						+{queueLength} queued
					</motion.p>
				)}
			</AnimatePresence>
		</section>,
		document.body,
	);
}
