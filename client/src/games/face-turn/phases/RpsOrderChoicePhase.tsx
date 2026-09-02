import { useEffect, useEffectEvent, useRef, useState } from "react";
import "./rps/rps.css";
import { cn } from "../../../lib/utils/cn";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { useReducedMotion } from "../../../hooks/a11y/useReducedMotion";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { ConfirmButton } from "../components/interaction-prompts/SimplePrompts";

// tie-only suspense: alternates which of the two buttons is highlighted a
// few times before settling into the normal interactive state. There's no
// hidden answer to land on here — the winner still freely picks go
// first/second themselves — so this never disables past the flicker window
// and never "chooses" a side; it's flavor for a coinflip win specifically.
const FLICKER_STEPS = 8;
const FLICKER_STEP_MS = 160;

function useTieFlicker(active: boolean, reducedMotion: boolean) {
	const [flickering, setFlickering] = useState(active);
	const [favorsFirst, setFavorsFirst] = useState(true);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const start = useEffectEvent((shouldFlicker: boolean, noMotion: boolean) => {
		for (const t of timersRef.current) clearTimeout(t);
		timersRef.current = [];

		if (!shouldFlicker || noMotion) {
			timersRef.current.push(
				setTimeout(() => {
					setFlickering(false);
				}, 0),
			);
			return;
		}

		timersRef.current.push(
			setTimeout(() => {
				setFlickering(true);
			}, 0),
		);
		for (let i = 0; i < FLICKER_STEPS; i++) {
			timersRef.current.push(
				setTimeout(() => {
					setFavorsFirst((prev) => !prev);
				}, i * FLICKER_STEP_MS),
			);
		}
		timersRef.current.push(
			setTimeout(() => {
				setFlickering(false);
			}, FLICKER_STEPS * FLICKER_STEP_MS),
		);
	});

	useEffect(() => {
		start(active, reducedMotion);
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, [active, reducedMotion]);

	return { flickering, favorsFirst };
}

export function RpsOrderChoicePhase() {
	const { ft, playerId, playerMap } = useFaceturnState();
	const reducedMotion = useReducedMotion();
	const { locked, runLocked } = useActionLock(ft?.phase);

	const isWinner = Boolean(
		ft?.rpsOrderChoice && playerId === ft.rpsOrderChoice.winnerId,
	);
	const wasTie = Boolean(ft?.rpsOrderChoice?.wasTie);
	const { flickering, favorsFirst } = useTieFlicker(
		isWinner && wasTie,
		reducedMotion,
	);

	if (!ft || ft.phase !== "rps_order_choice" || !ft.rpsOrderChoice) return null;

	const { winnerId } = ft.rpsOrderChoice;
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
			<div className="flex gap-4">
				<ConfirmButton
					label="Go first"
					ready
					locked={locked}
					size="lg"
					className={cn(flickering && favorsFirst && "rps-status-flicker")}
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
					size="lg"
					className={cn(flickering && !favorsFirst && "rps-status-flicker")}
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