import "../../board.css";
import { cn } from "../../../../lib/utils/cn";
import type { PendingInteractionView } from "@shared/games/face-turn/types";
import { getMoveDisplay } from "@shared/games/face-turn/card-display";
import { Card } from "../card/Card";
import { moveToCard } from "../card/cardAdapters";
import type { useFaceturnInteraction } from "../../hooks/useFaceturnInteraction";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useTargetPickerSite } from "../../hooks/useTargetPickerSite";
import {
	useTargetPickerStore,
	useTargetPickerSession,
} from "../../hooks/targetPickerStore";
import {
	crewReactivateTargets,
	chooseCrewToTurnTargets,
	tacticalSupportHideTargets,
	truthSerumRevealTargets,
	switchUpTargets,
	tagOutOwnTargets,
	tagOutTeammateTargets,
	targetedSlotsToPickerTargets,
} from "../../hooks/crewSlotPickerAdapters";

type ResolveFn = ReturnType<typeof useFaceturnInteraction>["resolve"];
type DeclineFn = ReturnType<typeof useFaceturnInteraction>["decline"];

// shared display primitives, reused by stateful prompts and challenge bar
const PROMPT_TONE = {
	amber: { rule: "#ffc53d", title: "text-amber-300/80" },
	red: { rule: "#ff5656", title: "text-red-300/80" },
	sky: { rule: "#38bdf8", title: "text-sky-300/80" },
	violet: { rule: "#a78bfa", title: "text-violet-300/80" },
} as const;

export function PromptShell({
	title,
	tone = "amber",
	children,
}: {
	title: string;
	tone?: keyof typeof PROMPT_TONE;
	children: React.ReactNode;
}) {
	const { rule, title: titleClass } = PROMPT_TONE[tone];
	return (
		<div
			className="relative flex w-full flex-col gap-3 rounded-xl border border-white/20 bg-[#0c1730] px-5 py-4 pt-4.5 shadow-2xl shadow-black/70 overflow-hidden"
			style={{ "--prompt-accent": rule } as React.CSSProperties}
		>
			<div
				className="absolute inset-0 pointer-events-none"
				style={{
					background:
						"linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 45%)",
				}}
			/>
			<div
				className="absolute top-0 left-0 right-0 h-0.75"
				style={{ backgroundColor: "var(--prompt-accent)" }}
			/>
			<p className={cn("ft-eyebrow text-sm relative", titleClass)}>{title}</p>
			<div className="relative flex flex-col gap-3">{children}</div>
		</div>
	);
}

export function SlotButton({
	label,
	selected,
	onClick,
	disabled,
}: {
	label: string;
	selected?: boolean;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"ft-panel-ink px-4 py-2 rounded-lg border text-sm font-bold transition-all",
				disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
				selected
					? "border-amber-400 text-amber-200 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.3)]"
					: "border-white/15 text-white/70 hover:border-white/30",
			)}
		>
			{label}
		</button>
	);
}

const PICK_CARD_SIZE = 180;

export function CardPickButton({
	cardId,
	selected,
	disabled,
	onClick,
}: {
	cardId: string;
	selected?: boolean;
	disabled?: boolean;
	onClick: () => void;
}) {
	const cardProps = moveToCard(getMoveDisplay(cardId));
	return (
		<Card
			{...cardProps}
			size={PICK_CARD_SIZE}
			selected={selected}
			disabled={disabled}
			onClick={onClick}
		/>
	);
}

export function CardPickGrid({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="flex w-full flex-row flex-wrap justify-center gap-3"
			style={{ "--card-vw-share": "28vw" } as React.CSSProperties}
		>
			{children}
		</div>
	);
}

export function StepperButton({
	symbol,
	onClick,
	disabled,
}: {
	symbol: "−" | "+";
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"ft-panel-ink w-8 h-8 rounded-lg border border-white/15 text-white/70 font-bold transition-all",
				disabled
					? "cursor-not-allowed opacity-50"
					: "cursor-pointer hover:border-white/30",
			)}
		>
			{symbol}
		</button>
	);
}

export function PlayerButton({
	label,
	onClick,
	disabled,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"ft-panel-ink px-4 py-2 rounded-lg border border-white/15 text-sm font-bold text-white/70 transition-all",
				disabled
					? "cursor-not-allowed opacity-50"
					: "cursor-pointer hover:border-amber-400/60 hover:text-white",
			)}
		>
			{label}
		</button>
	);
}

export function DeclineButton({
	onClick,
	disabled,
}: {
	onClick: () => void;
	disabled?: boolean;
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"px-4 py-2 rounded-lg border border-white/10 text-xs font-bold uppercase tracking-widest self-start transition-all",
				disabled
					? "cursor-not-allowed opacity-50"
					: "cursor-pointer text-white/40 hover:text-white/70 hover:border-white/20",
			)}
		>
			No thanks
		</button>
	);
}

// ready and locked separate because semantics differ even if rendering is same
export function ConfirmButton({
	label,
	onClick,
	ready,
	locked,
	size = "md",
	className,
}: {
	label: React.ReactNode;
	onClick: () => void;
	ready: boolean;
	locked?: boolean;
	size?: "md" | "lg";
	className?: string;
}) {
	const disabled = !ready || Boolean(locked);
	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"ft-panel-ink rounded-lg border font-bold self-start transition-all",
				size === "lg" ? "px-8 py-4 text-lg rounded-xl" : "px-4 py-2 text-sm",
				disabled
					? "border-white/10 text-white/20 cursor-not-allowed"
					: "border-amber-400/60 text-amber-200 cursor-pointer shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]",
				className,
			)}
		>
			{label}
		</button>
	);
}

export function CrewReactivatePrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "crew_reactivate" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	useTargetPickerSite(
		{
			mode: "single",
			eligible: crewReactivateTargets(pi.eligibleSlots, pi.actorId),
		},
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			resolve("crew_reactivate", { crewSlot: result.target.slotIndex });
		},
	);

	return (
		<PromptShell title="Reactivate a face-up Crew's turned effect">
			<p className="text-sm text-white/70">
				Click a face-up Crew on your board.
			</p>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

export function PoisonTargetPickPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "poison_target_pick" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { playerMap } = useFaceturnState();
	return (
		<PromptShell title={`Choose who takes ${pi.damagePerRound} poison / round`}>
			<div className="flex gap-2 flex-wrap">
				{pi.eligibleTargetIds.map((id) => (
					<PlayerButton
						key={id}
						label={playerMap[id]?.name ?? id}
						disabled={locked}
						onClick={() => {
							resolve("poison_target_pick", { targetPlayerId: id });
						}}
					/>
				))}
			</div>
		</PromptShell>
	);
}

export function BearBonesStealPickPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "bear_bones_steal_pick" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { playerMap } = useFaceturnState();
	return (
		<PromptShell title={`Steal ${pi.amount} Cash from...`}>
			<div className="flex gap-2 flex-wrap">
				{pi.eligibleTargetIds.map((id) => (
					<PlayerButton
						key={id}
						label={playerMap[id]?.name ?? id}
						disabled={locked}
						onClick={() => {
							resolve("bear_bones_steal_pick", { targetPlayerId: id });
						}}
					/>
				))}
			</div>
		</PromptShell>
	);
}

export function ChooseCrewToTurnPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "choose_crew_to_turn" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { playerMap } = useFaceturnState();
	const nameOf = (id: string) => playerMap[id]?.name ?? id;

	useTargetPickerSite(
		{
			mode: "single",
			eligible: chooseCrewToTurnTargets(pi.eligibleSlots, pi.targetPlayerId),
		},
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			resolve("choose_crew_to_turn", { crewSlot: result.target.slotIndex });
		},
	);

	return (
		<PromptShell
			title={
				pi.isStrike
					? `Choose which of ${nameOf(pi.targetPlayerId)}'s Crew turns face-up (strike)`
					: `Choose which of ${nameOf(pi.targetPlayerId)}'s Crew turns face-up`
			}
		>
			<p className="text-sm text-white/70">
				Click a face-down Crew on {nameOf(pi.targetPlayerId)}'s board.
			</p>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

export function ChooseFromDiscardPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "choose_from_discard" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	return (
		<PromptShell title="Return a card from the discard pile to your hand">
			<CardPickGrid>
				{pi.discardPileSnapshot.map((cardId, i) => (
					<CardPickButton
						key={`${cardId}-${i}`}
						cardId={cardId}
						disabled={locked}
						onClick={() => {
							resolve("choose_from_discard", { cardId });
						}}
					/>
				))}
			</CardPickGrid>
		</PromptShell>
	);
}

export function TacticalSupportHideOfferPrompt({
	pi,
	resolve,
	decline,
	canDecline,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "tactical_support_hide_offer" }>;
	resolve: ResolveFn;
	decline: DeclineFn;
	canDecline: boolean;
	locked: boolean;
}) {
	const { playerMap } = useFaceturnState();
	const targetName = playerMap[pi.targetPlayerId]?.name ?? pi.targetPlayerId;

	useTargetPickerSite(
		{
			mode: "single",
			eligible: tacticalSupportHideTargets(pi.eligibleSlots, pi.targetPlayerId),
		},
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			resolve("tactical_support_hide_offer", { slot: result.target.slotIndex });
		},
	);

	return (
		<PromptShell
			title={`Tactical Support: you may turn one of ${targetName}'s face-up Crew face-down`}
		>
			<div className="flex gap-2 flex-wrap items-center">
				<p className="text-sm text-white/70">
					Click a face-up Crew on {targetName}'s board, or decline.
				</p>
				{canDecline && <DeclineButton onClick={decline} disabled={locked} />}
			</div>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

export function VoidLegsChoicePrompt({
	resolve,
	decline,
	canDecline,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "void_legs_choice" }>;
	resolve: ResolveFn;
	decline: DeclineFn;
	canDecline: boolean;
	locked: boolean;
}) {
	return (
		<PromptShell title="Void Legs: discard 1 card to deal damage?">
			<div className="flex gap-2">
				<ConfirmButton
					label="Discard & deal damage"
					ready
					locked={locked}
					onClick={() => {
						resolve("void_legs_choice", { confirmed: true });
					}}
				/>
				{canDecline && <DeclineButton onClick={decline} disabled={locked} />}
			</div>
		</PromptShell>
	);
}

export function WatcherHideOfferPrompt({
	pi,
	resolve,
	decline,
	canDecline,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "watcher_hide_offer" }>;
	resolve: ResolveFn;
	decline: DeclineFn;
	canDecline: boolean;
	locked: boolean;
}) {
	useTargetPickerSite(
		{
			mode: "single",
			eligible: targetedSlotsToPickerTargets(pi.eligibleTargets),
		},
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			resolve("watcher_hide_offer", {
				slot: result.target.slotIndex,
				targetPlayerId: result.target.playerId,
			});
		},
	);

	return (
		<PromptShell title="The Watcher: you may turn a face-up ally Crew face-down">
			<div className="flex gap-2 flex-wrap items-center">
				<p className="text-sm text-white/70">
					Click a face-up ally Crew on the board, or decline.
				</p>
				{canDecline && <DeclineButton onClick={decline} disabled={locked} />}
			</div>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

export function TooBigSwapPickPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "too_big_swap_pick" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	useTargetPickerSite(
		{
			mode: "single",
			eligible: targetedSlotsToPickerTargets(pi.eligibleTargets),
		},
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			resolve("too_big_swap_pick", {
				targetPlayerId: result.target.playerId,
				crewSlot: result.target.slotIndex,
			});
		},
	);

	return (
		<PromptShell title="Too Big: pick a face-up Crew to swap with">
			<p className="text-sm text-white/70">
				Click a face-up Crew to swap with.
			</p>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

export function BelladonnaCopyPickPrompt({
	pi,
	resolve,
	decline,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "belladonna_copy_pick" }>;
	resolve: ResolveFn;
	decline: DeclineFn;
	locked: boolean;
}) {
	const { playerMap } = useFaceturnState();

	return (
		<PromptShell title="Belladonna: copy an enemy's active Move?">
			<div className="flex flex-col gap-2">
				{pi.eligibleTargets.map((t) => (
					<SlotButton
						key={`${t.playerId}-${t.slot}`}
						label={`${playerMap[t.playerId]?.name ?? t.playerId} — ${getMoveDisplay(t.moveId).name}`}
						disabled={locked}
						onClick={() => {
							resolve("belladonna_copy_pick", {
								confirmed: true,
								targetPlayerId: t.playerId,
								targetActiveMoveSlot: t.slot,
							});
						}}
					/>
				))}
			</div>
			<div className="flex items-center justify-between">
				<p className="text-sm text-white/70">
					Copies the Move into an open active zone of yours.
				</p>
				<DeclineButton onClick={decline} disabled={locked} />
			</div>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

export function TruthSerumRevealPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "truth_serum_reveal" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	useTargetPickerSite(
		{
			mode: "single",
			eligible: truthSerumRevealTargets(pi.eligibleSlots, pi.targetPlayerId),
		},
		(result) => {
			if (!result.target || result.target.kind !== "crew") return;
			resolve("truth_serum_reveal", { crewSlot: result.target.slotIndex });
		},
	);

	return (
		<PromptShell title="Truth Serum: reveal the class of one of your face-down Crew">
			<p className="text-sm text-white/70">
				Click a face-down Crew on your board.
			</p>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

// two-phase: both picks on own board
export function SwitchUpPickPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "switch_up_pick" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	useTargetPickerSite(
		{
			mode: "two_phase",
			eligible: switchUpTargets(pi.faceUpSlots, pi.actorId),
			phaseTwoEligible: switchUpTargets(pi.faceDownSlots, pi.actorId),
		},
		(result) => {
			if (
				!result.phaseOnePick ||
				!result.phaseTwoPick ||
				result.phaseOnePick.kind !== "crew" ||
				result.phaseTwoPick.kind !== "crew"
			)
				return;
			resolve("switch_up_pick", {
				hideSlot: result.phaseOnePick.slotIndex,
				turnSlot: result.phaseTwoPick.slotIndex,
			});
		},
	);

	return (
		<PromptShell title="Switch Up: turn one Crew face-down, a different one face-up">
			<p className="text-sm text-white/70">
				Click a face-up Crew to turn face-down, then a face-down Crew to turn
				face-up.
			</p>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

// two-phase: own board then teammate's board
export function TagOutPickPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "tag_out_pick" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { playerMap } = useFaceturnState();
	const teammateName = playerMap[pi.teammateId]?.name ?? pi.teammateId;

	useTargetPickerSite(
		{
			mode: "two_phase",
			eligible: tagOutOwnTargets(pi.ownEligibleSlots, pi.actorId),
			phaseTwoEligible: tagOutTeammateTargets(
				pi.teammateEligibleSlots,
				pi.teammateId,
			),
		},
		(result) => {
			if (
				!result.phaseOnePick ||
				!result.phaseTwoPick ||
				result.phaseOnePick.kind !== "crew" ||
				result.phaseTwoPick.kind !== "crew"
			)
				return;
			resolve("tag_out_pick", {
				ownSlot: result.phaseOnePick.slotIndex,
				teammateSlot: result.phaseTwoPick.slotIndex,
			});
		},
	);

	return (
		<PromptShell title={`Tag Out: swap a Crew with ${teammateName}`}>
			<p className="text-sm text-white/70">
				Click a Crew on your board, then a Crew on {teammateName}'s board.
			</p>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

// multi-select: confirm reads picks from store
export function LighthouseDisablePickPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "lighthouse_disable_pick" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const maxPicks = pi.maxPicks ?? 2;
	const confirmMulti = useTargetPickerStore((s) => s.confirmMulti);
	const session = useTargetPickerSession();
	const picks = session?.mode === "multi" ? session.picks : [];

	useTargetPickerSite(
		{
			mode: "multi",
			eligible: targetedSlotsToPickerTargets(pi.eligibleTargets),
			maxPicks,
		},
		(result) => {
			if (!result.picks || result.picks.length === 0) return;
			resolve("lighthouse_disable_pick", {
				picks: result.picks.reduce<
					{ targetPlayerId: string; crewSlot: number }[]
				>((picks, p) => {
					if (p.kind === "crew") {
						picks.push({ targetPlayerId: p.playerId, crewSlot: p.slotIndex });
					}
					return picks;
				}, []),
			});
		},
	);

	return (
		<PromptShell
			title={`Lighthouse: disable up to ${maxPicks} Crew's passives`}
		>
			<div className="flex flex-col gap-2">
				<p className="text-sm text-white/70">
					Click up to {maxPicks} Crew to disable, then confirm.
				</p>
				<ConfirmButton
					label={`Confirm (${picks.length}/${maxPicks})`}
					ready={picks.length > 0}
					locked={locked}
					onClick={confirmMulti}
				/>
			</div>
		</PromptShell>
	);
}