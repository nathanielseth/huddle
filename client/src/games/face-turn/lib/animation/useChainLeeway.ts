import { useEffect, useState } from "react";
import type { MoveChainEntry } from "@shared/games/face-turn/types";
import { useReducedMotion } from "../../../../hooks/a11y/useReducedMotion";

const LEEWAY_MS = 900;
const REDUCED_MOTION_LEEWAY_MS = 120;

export interface LeewayChainEntry extends MoveChainEntry {
	resolving: boolean;
}

export function useChainLeeway(
	serverChain: readonly MoveChainEntry[] | null | undefined,
): readonly LeewayChainEntry[] {
	const reducedMotion = useReducedMotion();
	const leewayMs = reducedMotion ? REDUCED_MOTION_LEEWAY_MS : LEEWAY_MS;

	const [displayed, setDisplayed] = useState<readonly LeewayChainEntry[]>(() =>
		(serverChain ?? []).map((e) => ({ ...e, resolving: false })),
	);
	const [lastServer, setLastServer] = useState(serverChain);

	if (serverChain !== lastServer) {
		const nextServer = serverChain ?? [];

		if (displayed.length === 0) {
			// fresh chain from closed state, nothing to animate out
			setDisplayed(nextServer.map((e) => ({ ...e, resolving: false })));
		} else {
			const merged: LeewayChainEntry[] = nextServer.map((e) => ({
				...e,
				resolving: false,
			}));
			for (let i = nextServer.length; i < displayed.length; i++) {
				merged.push({ ...displayed[i], resolving: true });
			}
			setDisplayed(merged);
		}

		setLastServer(serverChain);
	}

	useEffect(() => {
		if (!displayed.some((e) => e.resolving)) return;

		const timer = setTimeout(() => {
			setDisplayed((prev) => prev.filter((e) => !e.resolving));
		}, leewayMs);

		return () => clearTimeout(timer);
	}, [displayed, leewayMs]);

	return displayed;
}