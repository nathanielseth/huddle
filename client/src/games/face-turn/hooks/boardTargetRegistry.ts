import { useEffect, useRef } from "react";

export type BoardTarget =
	| { kind: "boss"; playerId: string }
	| { kind: "crew"; playerId: string; slotIndex: number }
	| { kind: "active"; playerId: string; slotIndex: number }
	| { kind: "player"; playerId: string }
	| { kind: "own_board_area"; playerId: string }
	| { kind: "discard"; playerId: string };

interface RegistryEntry {
	target: BoardTarget;
	el: HTMLElement;
}

export function targetKey(target: BoardTarget): string {
	switch (target.kind) {
		case "boss":
		case "player":
		case "own_board_area":
		case "discard":
			return `${target.kind}:${target.playerId}`;
		case "crew":
		case "active":
			return `${target.kind}:${target.playerId}:${target.slotIndex}`;
	}
}

class BoardTargetRegistry {
	private entries = new Map<string, RegistryEntry>();

	register(target: BoardTarget, el: HTMLElement): () => void {
		const key = targetKey(target);

		if (import.meta.env.DEV && this.entries.has(key)) {
			console.warn(
				`[BoardTargetRegistry] duplicate registration for "${key}" — ` +
					"overwriting previous entry. This usually means two cells " +
					"are registering the same (kind, playerId, slotIndex).",
			);
		}

		this.entries.set(key, { target, el });

		return () => {
			const current = this.entries.get(key);
			if (current && current.el === el) {
				this.entries.delete(key);
			}
		};
	}

	getTargetAt(point: { x: number; y: number }): BoardTarget | null {
		const matchesByKind: Partial<Record<BoardTarget["kind"], BoardTarget>> = {};

		for (const { target, el } of this.entries.values()) {
			if (matchesByKind[target.kind]) continue;

			const rect = el.getBoundingClientRect();
			const hit =
				point.x >= rect.left &&
				point.x <= rect.right &&
				point.y >= rect.top &&
				point.y <= rect.bottom;
			if (!hit) continue;

			matchesByKind[target.kind] = target;
		}

		return (
			matchesByKind.crew ??
			matchesByKind.active ??
			matchesByKind.boss ??
			matchesByKind.discard ??
			matchesByKind.player ??
			matchesByKind.own_board_area ??
			null
		);
	}
}

export const boardTargetRegistry = new BoardTargetRegistry();

export function useBoardTarget(
	target: BoardTarget,
): (el: HTMLElement | null) => void {
	const elRef = useRef<HTMLElement | null>(null);
	const unregisterRef = useRef<(() => void) | null>(null);

	function setRef(el: HTMLElement | null) {
		elRef.current = el;
	}

	const key = targetKey(target);

	useEffect(() => {
		unregisterRef.current?.();
		unregisterRef.current = elRef.current
			? boardTargetRegistry.register(target, elRef.current)
			: null;
		return () => {
			unregisterRef.current?.();
			unregisterRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return setRef;
}