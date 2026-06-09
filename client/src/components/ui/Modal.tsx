import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { useStore } from "zustand";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { modalStore, type ModalEntry } from "../../lib/utils/modal";
import { useReducedMotion } from "../../hooks/a11y/useReducedMotion";

// config
const VARIANTS = {
	alert: {
		Icon: Info,
		iconWrap: "bg-sky-500/10 ring-1 ring-sky-500/20",
		iconColor: "text-sky-400",
		confirmCls: "bg-sky-500 text-white hover:bg-sky-400 active:bg-sky-600",
	},
	confirm: {
		Icon: AlertTriangle,
		iconWrap: "bg-amber-400/10 ring-1 ring-amber-400/20",
		iconColor: "text-amber-400",
		confirmCls: "bg-white text-zinc-900 hover:bg-white/90 active:bg-white/80",
	},
	destructive: {
		Icon: AlertCircle,
		iconWrap: "bg-red-500/10 ring-1 ring-red-500/20",
		iconColor: "text-red-400",
		confirmCls: "bg-red-500 text-white hover:bg-red-400 active:bg-red-600",
	},
} as const;

const SPRING = {
	type: "spring" as const,
	stiffness: 380,
	damping: 28,
	mass: 0.8,
};

// compensates for scrollbar width to prevent layout shift
function lockScroll(): () => void {
	const scrollbarWidth =
		window.innerWidth - document.documentElement.clientWidth;
	const prev = document.body.style.overflow;
	const prevPad = document.body.style.paddingRight;

	document.body.style.overflow = "hidden";
	if (scrollbarWidth > 0) {
		document.body.style.paddingRight = `${scrollbarWidth}px`;
	}

	return () => {
		document.body.style.overflow = prev;
		document.body.style.paddingRight = prevPad;
	};
}

// focus trap
const FOCUSABLE =
	'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

// returns a callback ref. attach it to the panel element
// using a callback ref instead of useref + useeffect avoids the timing race where useeffect fires before the ref is populated
function useFocusTrap() {
	return useCallback((el: HTMLElement | null) => {
		if (!el) return;

		function onKeyDown(e: KeyboardEvent) {
			if (e.key !== "Tab") return;
			const nodes = Array.from(el!.querySelectorAll<HTMLElement>(FOCUSABLE));
			if (!nodes.length) return;
			const first = nodes[0];
			const last = nodes[nodes.length - 1];

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}

		el.addEventListener("keydown", onKeyDown);
		return () => el.removeEventListener("keydown", onKeyDown);
	}, []);
}

// saves the element that had focus before the modal opened
function useFocusRestoration() {
	const triggerRef = useRef<Element | null>(null);

	useEffect(() => {
		// capture on mount
		triggerRef.current = document.activeElement;

		return () => {
			// restore on unmount
			// guard: element must still be in the dom and focusable (the trigger might have been removed while the modal was open, e.g. a button that was conditionally rendered)
			const el = triggerRef.current;
			if (el instanceof HTMLElement && document.contains(el)) {
				el.focus({ preventScroll: true });
			}
			triggerRef.current = null;
		};
	}, []);
}

// modaldialog

interface ModalDialogProps {
	entry: ModalEntry;
	reducedMotion: boolean;
}

function ModalDialog({ entry, reducedMotion }: ModalDialogProps) {
	const panelTrapRef = useFocusTrap();
	const cfg = VARIANTS[entry.variant];

	useFocusRestoration();

	function resolve(value: boolean) {
		modalStore.getState()._resolve(entry.id, value);
	}

	// alert treats any implicit dismiss as acknowledged (true)
	// confirm + destructive treat backdrop / escape as cancelled (false)
	function dismiss() {
		resolve(entry.variant === "alert");
	}

	// scroll lock with scrollbar-width compensation to prevent layout shift
	useEffect(() => lockScroll(), []);

	// escape captured in capture phase so running game key-listeners don't win
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key !== "Escape") return;
			e.preventDefault();
			e.stopImmediatePropagation();
			dismiss();
		}
		document.addEventListener("keydown", onKey, { capture: true });
		return () =>
			document.removeEventListener("keydown", onKey, { capture: true });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entry.id, entry.variant]);

	return (
		<m.div
			// backdrop + centering container
			className="fixed inset-0 z-10000 flex items-center justify-center p-5 bg-black/60"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			transition={{ duration: 0.18 }}
			onPointerDown={(e) => {
				// only fire when clicking the backdrop itself, not the panel
				if (e.target === e.currentTarget) dismiss();
			}}
		>
			{/* panel */}
			<m.div
				// callback ref: safe against framer motion's forwarded-ref timing
				ref={panelTrapRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={`modal-title-${entry.id}`}
				aria-describedby={entry.body ? `modal-desc-${entry.id}` : undefined}
				className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
				initial={
					reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 }
				}
				animate={{ opacity: 1, scale: 1, y: 0 }}
				exit={
					reducedMotion
						? { opacity: 0 }
						: { opacity: 0, scale: 0.97, transition: { duration: 0.14 } }
				}
				transition={reducedMotion ? { duration: 0.15 } : SPRING}
				onPointerDown={(e) => e.stopPropagation()}
			>
				{/* body */}
				<div className="flex flex-col items-center gap-5 px-6 pb-6 pt-7 text-center">
					<div
						className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${cfg.iconWrap}`}
					>
						<cfg.Icon
							size={22}
							strokeWidth={2.1}
							className={cfg.iconColor}
							aria-hidden
						/>
					</div>

					<div className="flex flex-col gap-2">
						<h2
							id={`modal-title-${entry.id}`}
							className="text-[15px] font-semibold leading-snug text-white"
						>
							{entry.title}
						</h2>
						{entry.body && (
							<p
								id={`modal-desc-${entry.id}`}
								className="text-sm leading-relaxed text-white/50"
							>
								{entry.body}
							</p>
						)}
					</div>
				</div>

				{/* actions */}
				<div className="flex border-t border-border">
					{entry.cancelLabel !== null && (
						<button
							type="button"
							// destructive: focus cancel by default to prevent fat-finger confirms
							autoFocus={entry.variant === "destructive"}
							onClick={() => resolve(false)}
							className="flex-1 cursor-pointer border-r border-border py-3.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80 active:bg-white/10"
						>
							{entry.cancelLabel}
						</button>
					)}
					<button
						type="button"
						// alert + confirm: focus the primary action immediately
						autoFocus={entry.variant !== "destructive"}
						onClick={() => resolve(true)}
						className={`flex-1 cursor-pointer py-3.5 text-sm font-semibold transition-colors ${cfg.confirmCls}`}
					>
						{entry.confirmLabel}
					</button>
				</div>
			</m.div>
		</m.div>
	);
}

// modal (portal host)

export function Modal() {
	const stack = useStore(modalStore, (s) => s.stack);
	const reducedMotion = useReducedMotion();

	// fifo: stack[0] is always active
	// newer entries wait silently until the current one resolves and drops off the front
	// animatepresence mode="wait" ensures the exit animation for the outgoing modal completes before the next one mounts
	const current = stack[0] ?? null;

	return createPortal(
		<AnimatePresence mode="wait">
			{current && (
				<ModalDialog
					key={current.id}
					entry={current}
					reducedMotion={reducedMotion}
				/>
			)}
		</AnimatePresence>,
		document.body,
	);
}