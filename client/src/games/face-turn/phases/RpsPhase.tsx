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
import { ConfirmButton } from "../components/interaction-prompts/SimplePrompts";
import { cn } from "../../../lib/utils/cn";

const CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];
const OPTION_SIZE = 92;
const REVEAL_SIZE = 150;

// Tag Force-style reveal beat: both cards flip together, THEN — after a
// beat where both hands are just sitting there revealed — the winner
// slides in toward center and the loser gets knocked out to its own side
// and fades. Flip and knockout are deliberately two separate moments, 	// never the same frame, or it reads as a glitch instead of a reveal.
const FLIP_DELAY_MS = 350;
const SETTLE_DELAY_MS = 500;

// "go first / go second" is a genuine free pick by the rps winner (see
// beginRpsOrderChoice server-side, ties are coinflipped immediately so
// there's never a tie state to dramatize on the reveal itself). The
// randomizer/suspense flicker plays here instead, on the order-choice
// prompt, while everyone's waiting to see who actually gets the pick —
// not on the card reveal, which already has its own flip+settle beat.
const FLICKER_STEPS = 8;
const FLICKER_STEP_MS = 160;

function useOrderChoiceFlicker(active: boolean, reducedMotion: boolean) {
	const [flickering, setFlickering] = useState(false);
	const [showWinner, setShowWinner] = useState(true);
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const start = useEffectEvent((shouldFlicker: boolean, noMotion: boolean) => {
		for (const t of timersRef.current) clearTimeout(t);
		timersRef.current = [];

		if (!shouldFlicker || noMotion) {
			timersRef.current.push(setTimeout(() => setFlickering(false), 0));
			return;
		}

		timersRef.current.push(setTimeout(() => setFlickering(true), 0));
		for (let i = 0; i < FLICKER_STEPS; i++) {
			timersRef.current.push(
				setTimeout(() => setShowWinner((prev) => !prev), i * FLICKER_STEP_MS),
			);
		}
		timersRef.current.push(
			setTimeout(() => {
				setFlickering(false);
				setShowWinner(true);
			}, FLICKER_STEPS * FLICKER_STEP_MS),
		);
	});

	useEffect(() => {
		start(active, reducedMotion);
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, [active, reducedMotion]);

	return { flickering, showWinner };
}

// drives the flip -> hold -> settle sequence off `resolved` alone, one
// state machine instead of two separately-timed booleans, so "both cards
// visible" and "winner attacks" can never land on the same frame
function useRevealStage(resolved: boolean, reducedMotion: boolean) {
	const [stage, setStage] = useState<"hidden" | "flipped" | "settled">("hidden");
	const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

	const start = useEffectEvent((nowResolved: boolean, noMotion: boolean) => {
		for (const t of timersRef.current) clearTimeout(t);
		timersRef.current = [];

		if (!nowResolved) {
			timersRef.current.push(setTimeout(() => setStage("hidden"), 0));
			return;
		}

		if (noMotion) {
			timersRef.current.push(setTimeout(() => setStage("settled"), 0));
			return;
		}

		timersRef.current.push(setTimeout(() => setStage("flipped"), FLIP_DELAY_MS));
		timersRef.current.push(
			setTimeout(() => setStage("settled"), FLIP_DELAY_MS + SETTLE_DELAY_MS),
		);
	});

	useEffect(() => {
		start(resolved, reducedMotion);
		return () => {
			for (const t of timersRef.current) clearTimeout(t);
		};
	}, [resolved, reducedMotion]);

	return stage;
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
	// confirms it as myChoice, this is what lets the picked card fly into
	// the reveal slot immediately instead of waiting on network latency.
	// Cleared on a rejection, or once a real round starts fresh.
	const [pendingChoice, setPendingChoice] = useState<RpsChoice | null>(null);
	const { locked, runLocked } = useActionLock(myChoice, undefined, () => {
		setPendingChoice(null);
	});
	const displayChoice = myChoice ?? pendingChoice;

	const resolved = Boolean(ft?.rps && ft.rps.result !== null);
	const revealStage = useRevealStage(resolved, reducedMotion);
	const showFaces = revealStage !== "hidden";
	const settled = revealStage === "settled";

	const inOrderChoice = ft?.phase === "rps_order_choice";

	// order-choice winner, once the phase actually gets there (server-authoritative, see beginRpsOrderChoice)
	const winnerId = ft?.rpsOrderChoice?.winnerId ?? null;
	// only a real tie (equal/missing choices, coinflipped server-side) gets
	// the suspense flicker — a genuine rock-paper-scissors win already told
	// you who won on the reveal beat, flickering over a result you already
	// saw would just be noise
	const wasTie = ft?.rpsOrderChoice?.wasTie ?? false;
	// hooks must run every render regardless of the early-return guard
	// below (ft/phase/rps can all go missing between rounds), so these
	// live up here with the rest, not after the bail-out
	const { flickering, showWinner } = useOrderChoiceFlicker(
		inOrderChoice && wasTie,
		reducedMotion,
	);
	const { locked: orderLocked, runLocked: runOrderLocked } = useActionLock(
		ft?.phase,
	);

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

	if (
		!ft ||
		(ft.phase !== "rps" && ft.phase !== "rps_reveal" && ft.phase !== "rps_order_choice") ||
		!ft.rps
	)
		return null;

	// playerOrder[0]/[1] always land on teamIndex 0/1 respectively in every
	// mode (see buildTeamsAndTurnOrder), so this is server-derived, not a
	// client guess, and it lines up with real team color when mode is teams
	const repATeamColor = rpsTeamColorForIndex(ft.players[repA]?.teamIndex ?? 0);
	const repBTeamColor = rpsTeamColorForIndex(ft.players[repB]?.teamIndex ?? 1);
	const myTeamColor = playerId === repA ? repATeamColor : repBTeamColor;
	const opponentTeamColor = playerId === repA ? repBTeamColor : repATeamColor;

	const iWon =
		resolved && ft.rps.result === (playerId === repA ? "player1" : "player2");
	const p1Won = ft.rps.result === "player1";

	const winnerName = winnerId ? (playerMap[winnerId]?.name ?? "Winner") : null;
	const opponentName = playerMap[opponentId]?.name ?? "Opponent";

	if (!isRep) {
		const bothPicked =
			ft.rps.player1Choice !== null && ft.rps.player2Choice !== null;
		return (
			<div className="ft-panel-ink flex flex-col items-center gap-4 rounded-2xl border border-white/15 px-6 py-7">
				<p
					className={cn(
						"ft-eyebrow text-xs text-white/40",
						flickering && "rps-status-flicker",
					)}
				>
					{inOrderChoice
						? flickering
							? `${(showWinner ? winnerName : opponentName) ?? "?"} won the roll`
							: `${winnerName ?? "Winner"} is deciding who goes first…`
						: "Rock Paper Scissors"}
				</p>
				<AnimatePresence mode="wait" initial={false}>
					{inOrderChoice ? (
						<m.p
							key="order-choice"
							className="text-sm text-white/60"
							initial={reducedMotion ? undefined : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: reducedMotion ? 0 : 0.2 }}
						>
							Waiting for {winnerName} to choose…
						</m.p>
					) : bothPicked ? (
						<m.div
							key="revealing"
							className="rps-vs-row flex items-end justify-center"
							initial={reducedMotion ? undefined : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: reducedMotion ? 0 : 0.2 }}
						>
							<SpectatorSide
								name={playerMap[repA]?.name ?? repA}
								choice={ft.rps.player1Choice}
								showFace={showFaces}
								settled={settled}
								teamColor={repATeamColor}
								outcome={settled ? (p1Won ? "win" : "lose") : null}
								knockout={settled && !p1Won ? "left" : null}
								advance={settled && p1Won ? "left" : null}
							/>
							<p
								className={cn(
									"rps-vs-divider ft-eyebrow text-sm text-white/30 pb-9",
									settled && "rps-vs-divider-hidden",
								)}
							>
								vs
							</p>
							<SpectatorSide
								name={playerMap[repB]?.name ?? repB}
								choice={ft.rps.player2Choice}
								showFace={showFaces}
								settled={settled}
								teamColor={repBTeamColor}
								outcome={settled ? (!p1Won ? "win" : "lose") : null}
								knockout={settled && p1Won ? "right" : null}
								advance={settled && !p1Won ? "right" : null}
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

	const isOrderChoiceWinner = inOrderChoice && playerId === winnerId;

	return (
		<div className="ft-panel-ink flex flex-col items-center gap-5 rounded-2xl border border-amber-400/40 px-6 py-7">
			<p
				className={cn(
					"ft-eyebrow text-xs text-amber-300/80",
					flickering && "rps-status-flicker",
				)}
			>
				{inOrderChoice
					? flickering
						? (showWinner ? winnerId : opponentId) === playerId
							? "You won the roll"
							: "Opponent won the roll"
						: isOrderChoiceWinner
							? "You won! Go first or second?"
							: `${winnerName} is deciding who goes first…`
					: displayChoice
						? "Waiting for opponent…"
						: "Choose, winner goes first"}
			</p>

			{/* single switch: picking <-> revealing <-> order-choice, never
			    more than one on screen at once, mode="wait" holds the exiting
			    child until it's fully gone before the next one mounts */}
			<AnimatePresence mode="wait" initial={false}>
				{inOrderChoice ? (
					isOrderChoiceWinner ? (
						<m.div
							key="order-choice-buttons"
							className="flex gap-4"
							initial={reducedMotion ? undefined : { opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: reducedMotion ? 0 : 0.2 }}
						>
							<ConfirmButton
								label="Go first"
								ready
								locked={orderLocked}
								size="lg"
								onClick={() => {
									runOrderLocked(() => {
										sendFaceturnAction({ type: "rps_order_choice", goFirst: true });
									});
								}}
							/>
							<ConfirmButton
								label="Go second"
								ready
								locked={orderLocked}
								size="lg"
								onClick={() => {
									runOrderLocked(() => {
										sendFaceturnAction({ type: "rps_order_choice", goFirst: false });
									});
								}}
							/>
						</m.div>
					) : (
						<m.p
							key="order-choice-waiting"
							className="text-sm text-white/60"
							initial={reducedMotion ? undefined : { opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: reducedMotion ? 0 : 0.2 }}
						>
							Waiting for {winnerName}…
						</m.p>
					)
				) : !displayChoice ? (
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
						className="rps-vs-row flex items-end justify-center"
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
									tone={settled ? (iWon ? "lose" : "win") : "neutral"}
								/>
							}
							outcome={settled ? (iWon ? "lose" : "win") : null}
							knockout={settled && iWon ? "left" : null}
							advance={settled && !iWon ? "left" : null}
						/>

						<p
							className={cn(
								"rps-vs-divider ft-eyebrow text-sm text-white/30 pb-12",
								settled && "rps-vs-divider-hidden",
							)}
						>
							vs
						</p>

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
									tone={settled ? (iWon ? "win" : "lose") : "selected"}
								/>
							}
							outcome={settled ? (iWon ? "win" : "lose") : null}
							knockout={settled && !iWon ? "right" : null}
							advance={settled && iWon ? "right" : null}
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
	knockout,
	advance,
}: {
	label: string;
	card: React.ReactNode;
	outcome: "win" | "lose" | null;
	// which side this plate exits toward when it loses: "left"/"right" are
	// screen directions, not team-relative, set per-slot by the caller so
	// the loser always flies off away from center rather than toward it
	knockout: "left" | "right" | null;
	// which side this plate is sitting on when it wins, so it steps toward
	// the opposite (center) direction — the winner's half of the same hit
	advance?: "left" | "right" | null;
}) {
	return (
		<div
			className={cn(
				"rps-plate flex flex-col items-center gap-2.5",
				knockout === "left" && "rps-plate-knockout-left",
				knockout === "right" && "rps-plate-knockout-right",
				advance === "left" && "rps-plate-advance-left",
				advance === "right" && "rps-plate-advance-right",
			)}
		>
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
	knockout,
	advance,
}: {
	name: string;
	choice: RpsChoice | null;
	showFace: boolean;
	settled: boolean;
	teamColor: RpsTeamColor;
	outcome: "win" | "lose" | null;
	knockout: "left" | "right" | null;
	advance?: "left" | "right" | null;
}) {
	return (
		<RepSlot
			label={name}
			outcome={outcome}
			knockout={knockout}
			advance={advance}
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
