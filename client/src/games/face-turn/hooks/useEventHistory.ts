import { useState } from "react";
import type { ResolutionResult } from "@shared/games/face-turn/types";

const MAX_HISTORY = 25;

export function useEventHistory(
	resolution: ResolutionResult | null,
): readonly ResolutionResult[] {
	const [history, setHistory] = useState<ResolutionResult[]>([]);
	const [lastContent, setLastContent] = useState<string | null>(null);

	if (resolution) {
		const content = JSON.stringify(resolution);
		if (content !== lastContent) {
			setLastContent(content);
			setHistory((prev) => [resolution, ...prev].slice(0, MAX_HISTORY));
		}
	}

	return history;
}
