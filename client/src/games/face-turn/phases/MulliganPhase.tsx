import type { CSSProperties } from "react";
import "../board.css";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { getMoveDisplay } from "@shared/games/face-turn/card-display";
import { Card } from "../components/card/Card";
import { moveToCard } from "../components/card/cardAdapters";
import { useCardInspect } from "../components/card/useCardInspect";
import {
	ConfirmButton,
	PlayerButton,
} from "../components/interaction-prompts/SimplePrompts";

const MULLIGAN_CARD_SIZE = 280;

export function MulliganPhase() {
	const { ft, secret, myPlayer } = useFaceturnState();
	const { locked, runLocked } = useActionLock(myPlayer?.mulliganDecided);
	const { inspect, modal: inspectModal } = useCardInspect();

	if (!ft || ft.phase !== "mulligan") return null;

	if (myPlayer?.mulliganDecided) {
		return (
			<div className="ft-panel-ink flex flex-col gap-2 rounded-2xl border border-white/15 px-5 py-4">
				<p className="ft-eyebrow text-[10px] text-white/50">Mulligan decided</p>
				<p className="text-sm text-white/50">Waiting for other players…</p>
			</div>
		);
	}

	const hand = secret?.hand ?? [];
	const cycleItems = hand.map((id) => moveToCard(getMoveDisplay(id)));

	return (
		<div className="ft-panel-ink flex flex-col gap-3 rounded-2xl border border-white/15 px-5 py-4">
			<p className="ft-eyebrow text-[10px] text-white/50">
				Mulligan — keep this hand?
			</p>
			<div
				className="flex flex-row flex-nowrap justify-center gap-2 py-1 overflow-x-auto"
				style={{ "--card-vw-share": "34vw" } as CSSProperties}
			>
				{hand.map((id, i) => {
					const cardProps = cycleItems[i];
					return (
						<div
							key={`${id}-${i}`}
							className="shrink-0"
							onContextMenu={(e) => {
								e.preventDefault();
								inspect(cardProps, { items: cycleItems, index: i });
							}}
						>
							<Card {...cardProps} size={MULLIGAN_CARD_SIZE} />
						</div>
					);
				})}
			</div>
			<div className="flex gap-2">
				<ConfirmButton
					label="Keep hand"
					ready={true}
					locked={locked}
					onClick={() => {
						runLocked(() => {
							sendFaceturnAction({ type: "mulligan", redraw: false });
						});
					}}
				/>
				<PlayerButton
					label="Redraw"
					disabled={locked}
					onClick={() => {
						runLocked(() => {
							sendFaceturnAction({ type: "mulligan", redraw: true });
						});
					}}
				/>
			</div>
			{inspectModal}
		</div>
	);
}