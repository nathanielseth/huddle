import { useLayoutEffect, useRef, useState } from "react";
import { CARD_MIN_WIDTH_PX } from "../components/card/Card";
import { CREW_SLOT_CARD_SIZE } from "../components/BoardPrimitives";

const MAX_ITERATIONS = 6;
const FIT_SAFETY_MARGIN = 0.98;

export function useFitBoardCardSize() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement | null>(null);
	const [cardSize, setCardSize] = useState(CREW_SLOT_CARD_SIZE);
	const iterationRef = useRef(0);

	// re-measure after each size change and shrink until it fits or hits floor
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
			setCardSize((prev) =>
				Math.max(CARD_MIN_WIDTH_PX, Math.floor(prev * ratio)),
			);
		}
	}, [cardSize]);

	// container resize restarts the search from the max size
	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver(() => {
			iterationRef.current = 0;
			setCardSize(CREW_SLOT_CARD_SIZE);
		});
		observer.observe(container);
		return () => {
			observer.disconnect();
		};
	}, []);

	return { containerRef, contentRef, cardSize };
}