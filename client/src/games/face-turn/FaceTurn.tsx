import "./board.css";
import { LazyMotion, domAnimation } from "motion/react";
import { useFaceturnState } from "./hooks/useFaceturnState";
import { FaceTurnHost } from "./FaceTurnHost";
import { FaceTurnPlayer } from "./FaceTurnPlayer";
import { AppCardInspect } from "./components/card/CardInspectModal";

export function FaceTurn() {
	const { ft, myPlayer } = useFaceturnState();

	if (!ft) {
		return (
			<div className="flex items-center justify-center h-dvh ft-app-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	return (
		<LazyMotion features={domAnimation} strict>
			{myPlayer ? <FaceTurnPlayer /> : <FaceTurnHost />}
			<AppCardInspect />
		</LazyMotion>
	);
}