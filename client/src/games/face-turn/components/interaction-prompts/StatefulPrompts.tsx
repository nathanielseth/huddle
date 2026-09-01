import { useState } from "react";
import type { PendingInteractionView } from "@shared/games/face-turn/types";
import type { useFaceturnInteraction } from "../../hooks/useFaceturnInteraction";
import { useFaceturnState } from "../../hooks/useFaceturnState";
import { useTargetPickerSite } from "../../hooks/useTargetPickerSite";
import {
	backgroundCheckTargets,
	strikeTargets,
} from "../../hooks/crewSlotPickerAdapters";
import {
	PromptShell,
	SlotButton,
	CardPickButton,
	CardPickGrid,
	DeclineButton,
	ConfirmButton,
	StepperButton,
} from "./SimplePrompts";

type ResolveFn = ReturnType<typeof useFaceturnInteraction>["resolve"];
type DeclineFn = ReturnType<typeof useFaceturnInteraction>["decline"];

export function ChooseDiscardCountPrompt({
	maxCount,
	damagePerCard,
	resolve,
	locked,
}: {
	maxCount: number;
	damagePerCard: number;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const [count, setCount] = useState(0);
	return (
		<PromptShell title={`Discard cards for ${damagePerCard} damage each`}>
			<div className="flex items-center gap-3">
				<StepperButton
					symbol="−"
					disabled={locked}
					onClick={() => {
						setCount((c) => Math.max(0, c - 1));
					}}
				/>
				<span className="font-display text-lg font-black tabular-nums text-white w-10 text-center">
					{count}
				</span>
				<StepperButton
					symbol="+"
					disabled={locked}
					onClick={() => {
						setCount((c) => Math.min(maxCount, c + 1));
					}}
				/>
				<span className="text-xs text-white/30">/ {maxCount} max</span>
			</div>
			<ConfirmButton
				label={`Confirm (${count * damagePerCard} damage)`}
				ready
				locked={locked}
				onClick={() => {
					resolve("choose_discard_count", { count });
				}}
			/>
		</PromptShell>
	);
}

export function BearBonesPrompt({
	eligibleTargetIds,
	resolve,
	decline,
	locked,
}: {
	eligibleTargetIds: readonly string[];
	resolve: ResolveFn;
	decline: DeclineFn;
	locked: boolean;
}) {
	const { ft, playerMap } = useFaceturnState();
	const [targetId, setTargetId] = useState<string | null>(
		eligibleTargetIds[0] ?? null,
	);

	const targetPlayer = targetId ? (ft?.players[targetId] ?? null) : null;
	const occupiedSlots =
		targetPlayer?.crewSlots.reduce<number[]>((slots, s) => {
			if (s.status !== "empty") slots.push(s.slotIndex);
			return slots;
		}, []) ?? [];

	// clicking a slot on the target's board picks it directly
	useTargetPickerSite(
		targetId && occupiedSlots.length > 0
			? {
					mode: "single",
					eligible: strikeTargets(occupiedSlots, targetId),
				}
			: null,
		(result) => {
			if (!targetId || !result.target || result.target.kind !== "crew") {
				return;
			}
			resolve("bear_bones_bonus_strike", {
				confirmed: true,
				targetPlayerId: targetId,
				targetCrewSlot: result.target.slotIndex,
			});
		},
	);

	return (
		<div className="flex flex-col gap-2">
			{eligibleTargetIds.length > 1 && (
				<div className="flex gap-2 flex-wrap">
					{eligibleTargetIds.map((id) => (
						<SlotButton
							key={id}
							label={playerMap[id]?.name ?? id}
							selected={targetId === id}
							disabled={locked}
							onClick={() => {
								setTargetId(id);
							}}
						/>
					))}
				</div>
			)}
			{occupiedSlots.length > 0 ? (
				<p className="text-sm text-white/70">
					Click a Crew on their board to Strike it.
				</p>
			) : (
				<div className="flex gap-2">
					<ConfirmButton
						label="Strike"
						ready={targetId !== null}
						locked={locked}
						onClick={() => {
							if (!targetId) return;
							resolve("bear_bones_bonus_strike", {
								confirmed: true,
								targetPlayerId: targetId,
							});
						}}
					/>
				</div>
			)}
			<div className="flex gap-2">
				<DeclineButton onClick={decline} disabled={locked} />
			</div>
		</div>
	);
}

export function BackgroundCheckPrompt({
	pi,
	resolve,
	locked,
}: {
	pi: Extract<PendingInteractionView, { type: "background_check_guess" }>;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { playerMap } = useFaceturnState();

	// clicking a board slot opens the class guess popover
	useTargetPickerSite(
		{
			mode: "single",
			eligible: backgroundCheckTargets(pi.eligibleSlots, pi.targetPlayerId),
			classGuess: true,
		},
		(result) => {
			if (!result.target || result.target.kind !== "crew" || !result.guessClass)
				return;
			resolve("background_check_guess", {
				targetCrewSlot: result.target.slotIndex,
				guessClass: result.guessClass,
			});
		},
	);

	return (
		<PromptShell title={`Background Check: guess a face-down Crew's class`}>
			<p className="text-sm text-white/70">
				Click a face-down Crew on{" "}
				{playerMap[pi.targetPlayerId]?.name ?? pi.targetPlayerId}'s board, then
				choose a class.
			</p>
			{locked && <p className="text-xs text-white/40">Submitting…</p>}
		</PromptShell>
	);
}

export function DigDeepPrompt({
	maxPicks,
	resolve,
	locked,
}: {
	maxPicks: number;
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { secret } = useFaceturnState();
	const revealed = secret?.digDeepRevealedCards ?? null;
	const [picked, setPicked] = useState<string[]>([]);

	if (!revealed) {
		return (
			<PromptShell title="Dig Deep — pick from the top of your deck">
				<p className="text-xs text-white/30">Waiting for revealed cards…</p>
			</PromptShell>
		);
	}

	function togglePick(cardId: string, index: number) {
		// use cardId@index so duplicate cards can be selected independently
		const key = `${cardId}@${index}`;
		setPicked((prev) => {
			const exists = prev.includes(key);
			if (exists) return prev.filter((p) => p !== key);
			if (prev.length >= maxPicks) return prev;
			return [...prev, key];
		});
	}

	return (
		<PromptShell
			title={
				maxPicks > 1
					? `Dig Deep — pick up to ${maxPicks} cards`
					: "Dig Deep — pick a card"
			}
		>
			<div className="flex flex-col gap-2">
				<CardPickGrid>
					{revealed.map((cardId, i) => {
						const key = `${cardId}@${i}`;
						const selected = picked.includes(key);
						return (
							<CardPickButton
								key={key}
								cardId={cardId}
								selected={selected}
								disabled={locked}
								onClick={() => {
									togglePick(cardId, i);
								}}
							/>
						);
					})}
				</CardPickGrid>
				<ConfirmButton
					label={`Confirm (${picked.length}/${maxPicks})`}
					ready={picked.length > 0}
					locked={locked}
					onClick={() => {
						const cardIds = picked.map((key) => key.split("@")[0]);
						resolve("dig_deep_pick", { cardIds });
						setPicked([]);
					}}
				/>
			</div>
		</PromptShell>
	);
}

export function PeekDiscardPrompt({
	resolve,
	locked,
}: {
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { secret } = useFaceturnState();
	const revealed = secret?.peekRevealedCards ?? null;

	if (!revealed) {
		return (
			<PromptShell title="Peek: choose a card to discard">
				<p className="text-xs text-white/30">Waiting for revealed cards…</p>
			</PromptShell>
		);
	}

	return (
		<PromptShell title="Peek: choose a card to discard">
			<CardPickGrid>
				{revealed.map((cardId, i) => (
					<CardPickButton
						key={`${cardId}-${i}`}
						cardId={cardId}
						disabled={locked}
						onClick={() => {
							resolve("peek_discard", { discardMoveId: cardId });
						}}
					/>
				))}
			</CardPickGrid>
		</PromptShell>
	);
}

export function WatcherStealPickPrompt({
	resolve,
	locked,
}: {
	resolve: ResolveFn;
	locked: boolean;
}) {
	const { secret } = useFaceturnState();
	const revealed = secret?.watcherStealRevealedCards ?? null;

	if (!revealed) {
		return (
			<PromptShell title="The Watcher: pick a card to steal">
				<p className="text-xs text-white/30">Waiting for revealed cards…</p>
			</PromptShell>
		);
	}

	return (
		<PromptShell title="The Watcher: pick a card to steal">
			<CardPickGrid>
				{revealed.map((cardId, i) => (
					<CardPickButton
						key={`${cardId}-${i}`}
						cardId={cardId}
						disabled={locked}
						onClick={() => {
							resolve("watcher_steal_pick", { cardId });
						}}
					/>
				))}
			</CardPickGrid>
		</PromptShell>
	);
}