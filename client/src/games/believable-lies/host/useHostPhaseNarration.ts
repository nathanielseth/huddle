import { useEffect, useRef } from "react";
import type { BelievableLiesState } from "@shared/games/believable-lies/index";
import { useHostNarrator } from "./audio/useHostNarrator";
import { pickResultStinger } from "./audio/manifest";

export function useHostPhaseNarration(
	state: BelievableLiesState | null,
	contentKey: string,
) {
	const { say, sayCategory } = useHostNarrator();

	// Stable refs so effects don't re-run just because say/sayCategory
	// are new function references on each render.
	const sayRef = useRef(say);
	const sayCategoryRef = useRef(sayCategory);
	useEffect(() => {
		sayRef.current = say;
	});
	useEffect(() => {
		sayCategoryRef.current = sayCategory;
	});

	const lastKeyRef = useRef<string | null>(null);
	const lastResultRef = useRef<BelievableLiesState["lastResult"] | null>(null);

	useEffect(() => {
		if (!state) return;
		if (lastKeyRef.current === contentKey) return;
		lastKeyRef.current = contentKey;

		switch (state.phase) {
			case "question_select":
				sayRef.current("phase-question-select");
				break;
			case "lie_input":
				sayRef.current("phase-lie-input");
				break;
			case "picking":
				sayRef.current("phase-picking");
				break;
			case "result":
				sayRef.current("phase-result");
				break;
			case "round_end":
				sayRef.current("phase-round-end");
				break;
			case "finished":
				sayRef.current("phase-finished");
				break;
		}
	}, [state, contentKey]); // say intentionally excluded — using ref

	useEffect(() => {
		if (!state?.lastResult) return;
		if (lastResultRef.current === state.lastResult) return;
		lastResultRef.current = state.lastResult;

		const totalPlayers = Object.keys(state.players).length;
		const stingerKey = pickResultStinger(
			state.lastResult.truthPickerIds,
			totalPlayers,
		);

		const id = setTimeout(() => { sayRef.current(stingerKey); }, 1800);
		return () => { clearTimeout(id); };
	}, [state]); // say intentionally excluded — using ref

	return {
		notifyCategorySelected: (cat: string) => { sayCategoryRef.current(cat); },
	};
}