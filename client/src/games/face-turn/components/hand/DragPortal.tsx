import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { DragPositionStore } from "../../hooks/dragPositionStore";

export function DragPortal({
	positionStore,
	children,
}: {
	positionStore: DragPositionStore;
	children: React.ReactNode;
}) {
	const position = useSyncExternalStore(
		positionStore.subscribe,
		positionStore.getPosition,
	);

	if (!position) return null;

	return createPortal(
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
				willChange: "transform",
				zIndex: 1000,
				pointerEvents: "none",
			}}
		>
			{children}
		</div>,
		document.body,
	);
}