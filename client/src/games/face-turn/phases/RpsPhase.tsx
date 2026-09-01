import "./rps/rps.css";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import type { RpsChoice } from "@shared/games/face-turn/types";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { useReducedMotion } from "../../../hooks/a11y/useReducedMotion";
import { RpsCard } from "./rps/RpsCard";
import { RpsOutcomeLabel } from "./rps/RpsOutcomeLabel";
import { RPS_LABEL } from "./rps/rpsLabels";

const CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];
const OPTION_SIZE = 64;
const REVEAL_SIZE = 92;

export function RpsPhase() {
	const { ft, playerId, playerMap } = useFaceturnState();
	const reducedMotion = useReducedMotion();

	const [repA, repB] = ft?.playerOrder ?? ["", ""];
	const isRep = playerId === repA || playerId === repB;
	const opponentId = playerId === repA ? repB : repA;

	const myChoice =
		ft?.rps && playerId === repA
			? ft.rps.player1Choice
			: ft?.rps && playerId === repB
				? ft.rps.player2Choice
				: null;
	const opponentChoice =
		ft?.rps && playerId === repA
			? ft.rps.player2Choice
			: ft?.rps && playerId === repB
				? ft.rps.player1Choice
				: null;

	const { locked, runLocked } = useActionLock(myChoice);

	if (!ft || (ft.phase !== "rps" && ft.phase !== "rps_reveal") || !ft.rps)
		return null;

	const resolved = ft.rps.result !== null;
	const iWon =
		resolved && ft.rps.result === (playerId === repA ? "player1" : "player2");

	if (!isRep) {
		const [p1Choice, p2Choice] = [ft.rps.player1Choice, ft.rps.player2Choice];
		const p1Won = ft.rps.result === "player1";
		return (
			<div className="ft-panel-ink flex flex-col items-center gap-4 rounded-2xl border border-white/15 px-5 py-6">
				<p className="ft-eyebrow text-[10px] text-white/40">
					Rock Paper Scissors
				</p>
				<div className="flex items-end gap-8">
					<SpectatorSide
						name={playerMap[repA]?.name ?? repA}
						choice={p1Choice}
						revealed={resolved}
						outcome={resolved ? (p1Won ? "win" : "lose") : null}
					/>
					<p className="ft-eyebrow text-xs text-white/30 pb-8">vs</p>
					<SpectatorSide
						name={playerMap[repB]?.name ?? repB}
						choice={p2Choice}
						revealed={resolved}
						outcome={resolved ? (!p1Won ? "win" : "lose") : null}
					/>
				</div>
				{!resolved && (
					<p className="text-sm text-white/60">deciding who goes first…</p>
				)}
			</div>
		);
	}

	return (
		<div className="ft-panel-ink flex flex-col items-center gap-5 rounded-2xl border border-amber-400/40 px-5 py-6">
			<p className="ft-eyebrow text-[10px] text-amber-300/80">
				{resolved
					? iWon
						? "You go first"
						: "Opponent goes first"
					: myChoice
						? "Waiting for opponent…"
						: "Choose — winner goes first"}
			</p>

			<div className="flex items-end gap-8">
				{/* opponent plate: face-down until resolved, regardless of stage */}
				<RepSlot
					label={playerMap[opponentId]?.name ?? "Opponent"}
					card={
						<RpsCard
							choice={opponentChoice ?? undefined}
							revealed={resolved}
							size={REVEAL_SIZE}
							tone={resolved ? (iWon ? "lose" : "win") : "neutral"}
						/>
					}
					outcome={resolved ? (iWon ? "lose" : "win") : null}
				/>

				<p className="ft-eyebrow text-xs text-white/30 pb-10">vs</p>

				{/* your plate: locked-choice / revealed, or the picker below */}
				<RepSlot
					label="You"
					card={
						myChoice ? (
							<RpsCard
								choice={myChoice}
								revealed={resolved}
								size={REVEAL_SIZE}
								tone={resolved ? (iWon ? "win" : "lose") : "selected"}
							/>
						) : (
							<div style={{ width: REVEAL_SIZE, height: REVEAL_SIZE * 1.4 }} />
						)
					}
					outcome={resolved ? (iWon ? "win" : "lose") : null}
				/>
			</div>

			{/* option row only while nothing's locked in yet */}
			<AnimatePresence mode="wait">
				{!myChoice && (
					<m.div
						key="options"
						className="flex gap-3"
						initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
						transition={{ duration: reducedMotion ? 0 : 0.2 }}
					>
						{CHOICES.map((choice) => (
							<button
								key={choice}
								type="button"
								disabled={locked}
								onClick={() => {
									runLocked(() => {
										sendFaceturnAction({ type: "rps_choice", choice });
									});
								}}
								className={`rps-option flex flex-col items-center gap-1.5 transition-transform ${
									locked
										? "cursor-not-allowed opacity-40"
										: "is-selectable cursor-pointer"
								}`}
							>
								<RpsCard choice={choice} revealed size={OPTION_SIZE} />
								<span className="ft-eyebrow text-[9px] text-white/40">
									{RPS_LABEL[choice]}
								</span>
							</button>
						))}
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function RepSlot({
	label,
	card,
	outcome,
}: {
	label: string;
	card: React.ReactNode;
	outcome: "win" | "lose" | null;
}) {
	return (
		<div className="flex flex-col items-center gap-2">
			<span className="ft-eyebrow text-[9px] text-white/40">{label}</span>
			{card}
			<div className="h-6 flex items-center">
				{outcome && <RpsOutcomeLabel outcome={outcome} />}
			</div>
		</div>
	);
}

function SpectatorSide({
	name,
	choice,
	revealed,
	outcome,
}: {
	name: string;
	choice: RpsChoice | null;
	revealed: boolean;
	outcome: "win" | "lose" | null;
}) {
	return (
		<div className="flex flex-col items-center gap-2">
			<span className="ft-eyebrow text-[9px] text-white/40">{name}</span>
			<RpsCard
				choice={choice ?? undefined}
				revealed={revealed}
				size={REVEAL_SIZE}
				tone={
					!revealed
						? "neutral"
						: outcome === "win"
							? "win"
							: outcome === "lose"
								? "lose"
								: "neutral"
				}
			/>
			<div className="h-6 flex items-center">
				{outcome && <RpsOutcomeLabel outcome={outcome} />}
			</div>
		</div>
	);
}