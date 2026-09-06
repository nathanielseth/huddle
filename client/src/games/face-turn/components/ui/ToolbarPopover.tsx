import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../../../../lib/utils/cn";

// shared anchored toolbar dropdown; portal escapes clipped ancestors, direction up for bottom triggers, use modal for confirmations
interface Rect {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

interface ToolbarPopoverProps {
	label: string;
	icon: ReactNode;
	active: boolean;
	open: boolean;
	onToggle: () => void;
	children: ReactNode;
	panelClassName?: string;
	align?: "left" | "right";
	// panel opens below trigger by default; "up" for triggers near bottom of scroll area
	direction?: "down" | "up";
	disabled?: boolean;
	// portal to body for triggers inside overflow-hidden ancestors
	portal?: boolean;
}

function ToolbarPopoverBase({
	iconOnly,
	label,
	icon,
	active,
	open,
	onToggle,
	children,
	panelClassName,
	align = "right",
	direction = "down",
	disabled,
	portal,
}: ToolbarPopoverProps & { iconOnly: boolean }) {
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const [rect, setRect] = useState<Rect | null>(null);

	// panelRef needed so clicks inside panel don't dismiss
	useEffect(() => {
		if (!open) return;
		function onPointerDown(e: globalThis.PointerEvent) {
			const target = e.target as Node;
			if (triggerRef.current?.contains(target)) return;
			if (panelRef.current?.contains(target)) return;
			onToggle();
		}
		function onKeyDown(e: globalThis.KeyboardEvent) {
			if (e.key === "Escape") onToggle();
		}
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	// keep portaled panel tracking trigger on scroll/resize
	useLayoutEffect(() => {
		if (!open || !portal) return;
		function measure() {
			const el = triggerRef.current;
			if (!el) return;
			const r = el.getBoundingClientRect();
			setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
		}
		measure();
		window.addEventListener("resize", measure);
		window.addEventListener("scroll", measure, true);
		return () => {
			window.removeEventListener("resize", measure);
			window.removeEventListener("scroll", measure, true);
		};
	}, [open, portal]);

	const resolvedPanelClassName = panelClassName ?? (iconOnly ? "w-72" : "w-64");

	return (
		<div className="relative shrink-0">
			<button
				ref={triggerRef}
				type="button"
				disabled={disabled}
				onClick={onToggle}
				aria-label={label}
				title={iconOnly ? label : undefined}
				className={cn(
					"flex items-center transition-all",
					iconOnly
						? "justify-center w-9 h-9 shrink-0 rounded-lg border"
						: "gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest",
					disabled
						? "border-white/10 text-white/20 cursor-not-allowed"
						: cn(
								"cursor-pointer",
								iconOnly && "active:scale-95",
								active || open
									? "border-white/30 bg-white/10 text-white"
									: "border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white",
							),
				)}
			>
				{icon}
				{!iconOnly && label}
			</button>

			{open && !disabled && !portal && (
				<div
					ref={panelRef}
					className={cn(
						"absolute z-30 rounded-lg border ft-draft-panel shadow-xl overflow-hidden",
						direction === "up" ? "bottom-full mb-1" : "top-full mt-1",
						align === "right" ? "right-0" : "left-0",
						resolvedPanelClassName,
					)}
				>
					{children}
				</div>
			)}

			{open &&
				!disabled &&
				portal &&
				rect &&
				createPortal(
					<div
						ref={panelRef}
						className={cn(
							"fixed rounded-lg border ft-draft-panel shadow-2xl shadow-black/70 overflow-hidden",
							resolvedPanelClassName,
						)}
						style={{
							...(direction === "up"
								? { bottom: window.innerHeight - rect.top + 4 }
								: { top: rect.bottom + 4 }),
							zIndex: 1050,
							...(align === "right"
								? { right: Math.max(8, window.innerWidth - rect.right) }
								: { left: Math.max(8, rect.left) }),
						}}
					>
						{children}
					</div>,
					document.body,
				)}
		</div>
	);
}

export function ToolbarPopover(props: ToolbarPopoverProps) {
	return <ToolbarPopoverBase {...props} iconOnly={false} />;
}

export function IconToolbarPopover(props: ToolbarPopoverProps) {
	return <ToolbarPopoverBase {...props} iconOnly={true} />;
}