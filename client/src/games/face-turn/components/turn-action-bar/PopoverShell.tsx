import { useEffect, useEffectEvent, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Rect {
	top: number;
	left: number;
	width: number;
	height: number;
}

function measure(el: HTMLElement): Rect {
	const r = el.getBoundingClientRect();
	return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function PopoverShell({
	anchorEl,
	onDismiss,
	children,
}: {
	anchorEl: HTMLElement;
	onDismiss: () => void;
	children: React.ReactNode;
}) {
	const [, setReMeasureTick] = useState(0);
	const rect = measure(anchorEl);
	const popoverRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		function reMeasure() {
			setReMeasureTick((t) => t + 1);
		}
		window.addEventListener("resize", reMeasure);
		window.addEventListener("scroll", reMeasure, true);
		return () => {
			window.removeEventListener("resize", reMeasure);
			window.removeEventListener("scroll", reMeasure, true);
		};
	}, []);

	const onDismissEvent = useEffectEvent(onDismiss);

	useEffect(() => {
		function handlePointerDown(e: PointerEvent) {
			if (!popoverRef.current) return;
			if (!(e.target instanceof Node)) return;
			if (popoverRef.current.contains(e.target)) return;
			if (anchorEl.contains(e.target)) return;
			onDismissEvent();
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onDismissEvent();
		}
		window.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [anchorEl]);

	return createPortal(
		<div
			ref={popoverRef}
			className="fixed flex flex-col gap-2 rounded-xl border border-white/15 px-3 py-3 shadow-2xl shadow-black/70"
			style={{
				top: rect.top,
				left: Math.max(8, rect.left - 268),
				width: 260,
				zIndex: 1050,
				backgroundColor: "#0a0a0a",
				backgroundImage:
					"radial-gradient(circle at 50% 100%, transparent 20%, #071013 21%, #071013 34%, transparent 35%)",
				backgroundSize: "30px 22px",
			}}
		>
			{children}
		</div>,
		document.body,
	);
}