import { useActionLock } from "../../../hooks/network/useActionLock";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { ConfirmButton } from "../components/interaction-prompts/SimplePrompts";

export function RpsOrderChoicePhase() {
	const { ft, playerId, playerMap } = useFaceturnState();
	const { locked, runLocked } = useActionLock(ft?.phase);

	if (!ft || ft.phase !== "rps_order_choice" || !ft.rpsOrderChoice) return null;

	const { winnerId } = ft.rpsOrderChoice;
	const isWinner = playerId === winnerId;
	const winnerName = playerMap[winnerId]?.name ?? "Winner";

	if (!isWinner) {
		return (
			<div className="ft-panel-ink flex flex-col items-center gap-2 rounded-2xl border border-white/15 px-5 py-6">
				<p className="ft-eyebrow text-[10px] text-white/40">
					Rock Paper Scissors
				</p>
				<p className="text-sm text-white/70">
					<span className="font-bold text-white/90">{winnerName}</span> won —
					deciding who goes first…
				</p>
			</div>
		);
	}

	return (
		<div className="ft-panel-ink flex flex-col items-center gap-4 rounded-2xl border border-amber-400/40 px-5 py-6">
			<p className="ft-eyebrow text-[10px] text-amber-300/80">
				You won! Go first or second?
			</p>
			<div className="flex gap-3">
				<ConfirmButton
					label="Go first"
					ready
					locked={locked}
					onClick={() => {
						runLocked(() => {
							sendFaceturnAction({ type: "rps_order_choice", goFirst: true });
						});
					}}
				/>
				<ConfirmButton
					label="Go second"
					ready
					locked={locked}
					onClick={() => {
						runLocked(() => {
							sendFaceturnAction({ type: "rps_order_choice", goFirst: false });
						});
					}}
				/>
			</div>
		</div>
	);
}