import { useLayoutEffect, useRef, useState } from "react";
import { CARD_MIN_WIDTH_PX } from "../components/card/Card";
import { CREW_SLOT_CARD_SIZE } from "../components/BoardPrimitives";
import { useGameSettingsStore } from "../../../lib/settings/gameSettings";
import { useBoardCardSizeStore } from "./boardCardSizeStore";

const MAX_ITERATIONS = 6;
const FIT_SAFETY_MARGIN = 0.98;

export function useFitBoardCardSize() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const cardSizePct = useGameSettingsStore((s) => s.cardSizePct);
	const preferredMax = Math.round(CREW_SLOT_CARD_SIZE * (cardSizePct / 100));

	// only the shrink factor is state; preferred max derives live so settings changes apply instantly
	const [shrinkRatio, setShrinkRatio] = useState(1);
	const iterationRef = useRef(0);
	const cardSize = Math.max(
		CARD_MIN_WIDTH_PX,
		Math.round(preferredMax * shrinkRatio),
	);

	useLayoutEffect(() => {
		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) return;

		const available = container.clientHeight;
		const needed = content.scrollHeight;

		if (
			needed > available &&
			iterationRef.current < MAX_ITERATIONS &&
			cardSize > CARD_MIN_WIDTH_PX
		) {
			iterationRef.current += 1;
			const ratio = Math.max(0.5, (available / needed) * FIT_SAFETY_MARGIN);
			setShrinkRatio((prev) => prev * ratio);
		} else if (needed <= available && iterationRef.current > 0) {
			// fits now, reset iteration budget for future overflows
			iterationRef.current = 0;
		}
	}, [cardSize]);

	// container resize or preferred size increase restarts the fit search
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver(() => {
			iterationRef.current = 0;
			setShrinkRatio(1);
		});
		observer.observe(container);
		return () => {
			observer.disconnect();
		};
	}, []);

	// publish board-wide so every card/slot component reads the same size
	useLayoutEffect(() => {
		useBoardCardSizeStore.getState().setPx(cardSize);
	}, [cardSize]);

	return { containerRef, contentRef, cardSize };
}