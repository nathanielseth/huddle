import { useState } from "react";

interface UseHoleCardsResult {
	/** Whether the player is currently peeking at their cards. */
	peeking: boolean;
	/** Toggle peeking. */
	togglePeek: () => void;
}

export function useHoleCards(handNumber: number): UseHoleCardsResult {
	// null  = never peeked this session
	// N     = last peeked during hand N
	const [peekHand, setPeekHand] = useState<number | null>(null);

	// Derived — no effect needed. When handNumber changes, this is false.
	const peeking = peekHand === handNumber;

	return {
		peeking,
		togglePeek: () =>
			{ setPeekHand((current) => (current === handNumber ? null : handNumber)); },
	};
}
