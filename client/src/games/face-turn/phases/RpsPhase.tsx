import "./rps/rps.css";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import type { RpsChoice, RpsState } from "@shared/games/face-turn/types";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";
import { useReducedMotion } from "../../../hooks/a11y/useReducedMotion";
import { RpsCard } from "./rps/RpsCard";
import { RpsOutcomeLabel } from "./rps/RpsOutcomeLabel";
import { RPS_LABEL } from "./rps/rpsLabels";
import { rpsTeamColorForIndex, type RpsTeamColor } from "./rps/rpsTeamColors";

const CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];
const OPTION_SIZE = 92;
const REVEAL_SIZE = 150;

// once both choices are in, wait a beat before the cards flip — a dead-flat
// simultaneous flip with zero anticipation reads as a glitch, not a reveal
const REVEAL_HOLD_MS = 350;

// Who-goes-first suspense lives on the order-choice screen now
// (RpsOrderChoicePhase.tsx), not here — this phase just picks and reveals.

// true once the hold beat has passed and both cards should show their face
function useShowFaces(resolved: boolean, reducedMotion: boolean) {
	const [showFaces, setShowFaces] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const start = useEffectEvent((nowResolved: boolean, noMotion: boolean) => {
		if (timerRef.current) clearTimeout(timerRef.current);

		if (!nowResolved) {
			timerRef.current = setTimeout(() => {
				setShowFaces(false);
			}, 0);
			return;
		}

		if (noMotion) {
			timerRef.current = setTimeout(() => {
				setShowFaces(true);
			}, 0);
			return;
		}

		timerRef.current = setTimeout(() => {
			setShowFaces(true);
		}, REVEAL_HOLD_MS);
	});

	useEffect(() => {
		start(resolved, reducedMotion);
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, [resolved, reducedMotion]);

	return showFaces;
}

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

	// optimistic: set the instant you click, before the server round-trip
	// confirms it as myChoice — this is what lets the picked card fly into
	// the reveal slot immediately instead of waiting on network latency.
	// Cleared on a rejection, or once a real round starts fresh.
	const [pendingChoice, setPendingChoice] = useState<RpsChoice | null>(null);
	const { locked, runLocked } = useActionLock(myChoice, undefined, () => {
		setPendingChoice(null);
	});
	const displayChoice = myChoice ?? pendingChoice;

	const resolved = Boolean(ft?.rps && ft.rps.result !== null);
	const showFaces = useShowFaces(resolved, reducedMotion);

	// fresh round (rps object identity/choices both cleared server-side):
	// drop any stale pending choice from a previous round
	const handleFreshRound = useEffectEvent((rps: RpsState | null) => {
		if (rps && rps.player1Choice === null && rps.player2Choice === null) {
			setTimeout(() => {
				setPendingChoice(null);
			}, 0);
		}
	});
	useEffect(() => {
		handleFreshRound(ft?.rps ?? null);
	}, [ft?.rps]);

	if (!ft || (ft.phase !== "rps" && ft.phase !== "rps_reveal") || !ft.rps)
		return null;

	// playerOrder[0]/[1] always land on teamIndex 0/1 respectively in every
	// mode (see buildTeamsAndTurnOrder), so this is server-derived, not a
	// client guess — and it lines up with real team color when mode is teams
	const repATeamColor = rpsTeamColorForIndex(ft.players[repA]?.teamIndex ?? 0);
	const repBTeamColor = rpsTeamColorForIndex(ft.players[repB]?.teamIndex ?? 1);
	const myTeamColor = playerId === repA ? repATeamColor : repBTeamColor;
	const opponentTeamColor = playerId === repA ? repBTeamColor : repATeamColor;

	const iWon =
		resolved && ft.rps.result === (playerId === repA ? "player1" : "player2");
	const p1Won = ft.rps.result === "player1";

	if (!isRep) {
		const bothPicked =
			ft.rps.player1Choice !== null && ft.rps.player2Choice !== null;
		return (
			<div className="ft-panel-ink flex flex-col items-center gap-4 rounded-2xl border border-white/15 px-6 py-7">
				<p className="ft-eyebrow text-xs text-white/40">
					{resolved
						? p1Won
							? `${playerMap[repA]?.name ?? repA} goes first`
							: `${playerMap[repB]?.name ?? repB} goes first`
						: "Rock Paper Scissors"}
				</p>
				<AnimatePresence mode="wait" initial={false}>
					{bothPicked ? (
						<m.div
							key="revealing"
							className="rps-vs-row flex items-end gap-8"
							initial={reducedMotion ? undefined : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: reducedMotion ? 0 : 0.2 }}
						>
							<SpectatorSide
								name={playerMap[repA]?.name ?? repA}
								choice={ft.rps.player1Choice}
								showFace={showFaces}
								settled={resolved}
								teamColor={repATeamColor}
								outcome={resolved ? (p1Won ? "win" : "lose") : null}
							/>
							<p className="ft-eyebrow text-sm text-white/30 pb-9">vs</p>
							<SpectatorSide
								name={playerMap[repB]?.name ?? repB}
								choice={ft.rps.player2Choice}
								showFace={showFaces}
								settled={resolved}
								teamColor={repBTeamColor}
								outcome={resolved ? (!p1Won ? "win" : "lose") : null}
							/>
						</m.div>
					) : (
						<m.p
							key="waiting"
							className="text-sm text-white/60"
							initial={reducedMotion ? undefined : { opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={reducedMotion ? { opacity: 0 } : { opacity: 0 }}
							transition={{ duration: reducedMotion ? 0 : 0.2 }}
						>
							deciding who goes first…
						</m.p>
					)}
				</AnimatePresence>
			</div>
		);
	}

	return (
		<div className="ft-panel-ink flex flex-col items-center gap-5 rounded-2xl border border-amber-400/40 px-6 py-7">
			<p className="ft-eyebrow text-xs text-amber-300/80">
				{resolved
					? iWon
						? "You go first"
						: "Opponent goes first"
					: displayChoice
						? "Waiting for opponent…"
						: "Choose — winner goes first"}
			</p>

			{/* single switch: picking <-> revealing, never both on screen at
			    once — mode="wait" holds the exiting child until it's fully
			    gone before the next one mounts */}
			<AnimatePresence mode="wait" initial={false}>
				{!displayChoice ? (
					<m.div
						key="picking"
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
										setPendingChoice(choice);
										sendFaceturnAction({ type: "rps_choice", choice });
									});
								}}
								className={`rps-option flex flex-col items-center gap-1.5 transition-transform ${
									locked
										? "cursor-not-allowed opacity-40"
										: "is-selectable cursor-pointer"
								}`}
							>
								<RpsCard
									choice={choice}
									revealed
									teamColor={myTeamColor}
									size={OPTION_SIZE}
								/>
								<span className="ft-eyebrow text-xs text-white/40">
									{RPS_LABEL[choice]}
								</span>
							</button>
						))}
					</m.div>
				) : (
					<m.div
						key="revealing"
						className="rps-vs-row flex items-end gap-8"
						initial={reducedMotion ? undefined : { opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: reducedMotion ? 0 : 0.2 }}
					>
						{/* opponent plate: face-down until the reveal beat */}
						<RepSlot
							label={playerMap[opponentId]?.name ?? "Opponent"}
							card={
								<RpsCard
									choice={opponentChoice ?? undefined}
									revealed={showFaces}
									teamColor={opponentTeamColor}
									size={REVEAL_SIZE}
									tone={resolved ? (iWon ? "lose" : "win") : "neutral"}
								/>
							}
							outcome={resolved ? (iWon ? "lose" : "win") : null}
						/>

						<p className="ft-eyebrow text-sm text-white/30 pb-12">vs</p>

						{/* your plate: mounts face-down once you've picked, only
						    after the picker row has fully faded out (mode="wait"
						    above), so there's never a frame with both visible */}
						<RepSlot
							label="You"
							card={
								<RpsCard
									choice={displayChoice}
									revealed={showFaces}
									teamColor={myTeamColor}
									size={REVEAL_SIZE}
									tone={resolved ? (iWon ? "win" : "lose") : "selected"}
								/>
							}
							outcome={resolved ? (iWon ? "win" : "lose") : null}
						/>
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
		<div className="flex flex-col items-center gap-2.5">
			<span className="ft-eyebrow text-xs text-white/40">{label}</span>
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
	showFace,
	settled,
	teamColor,
	outcome,
}: {
	name: string;
	choice: RpsChoice | null;
	showFace: boolean;
	settled: boolean;
	teamColor: RpsTeamColor;
	outcome: "win" | "lose" | null;
}) {
	return (
		<RepSlot
			label={name}
			outcome={outcome}
			card={
				<RpsCard
					choice={choice ?? undefined}
					revealed={showFace}
					teamColor={teamColor}
					size={REVEAL_SIZE}
					tone={
						!settled
							? "neutral"
							: outcome === "win"
								? "win"
								: outcome === "lose"
									? "lose"
									: "neutral"
					}
				/>
			}
		/>
	);
}