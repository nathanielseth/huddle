import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { CrewClass } from "../../../../../shared/games/face-turn/types";
import type { EffectPrimitive } from "../cards";
import { getCrew } from "../cards";
import { shuffle } from "../../lib/random";
import { recomputePassives } from "../derived";
import type { Handler } from "./shared";
import { resolveTarget } from "./shared";
import type { PendingInteraction } from "../interactions/types";

export const readPeekHandlers = {
	peek_enemy_hand_then_gain_cash(effect, ctx) {
		if (effect.type !== "peek_enemy_hand_then_gain_cash") return;
		const target = resolveTarget(ctx);
		if (target) {
			ctx.state.watcherReveal = {
				forPlayerId: ctx.actor.playerId,
				hand: [...target.hand],
			};
		}
		ctx.actor.cash += effect.cashGain;
	},

	peek_steal(effect, ctx) {
		if (effect.type !== "peek_steal") return;
		const target = resolveTarget(ctx);
		if (!target) return;

		if (target.hand.length === 1 && ctx.actor.hand.length < C.HAND_LIMIT) {
			// only 1 card available: steal it immediately, no pick needed
			const [taken] = target.hand.splice(0, 1);
			if (taken) {
				target.costOverrides.delete(taken);
				ctx.actor.hand.push(taken);
			}
		} else if (target.hand.length > 1 && ctx.actor.hand.length < C.HAND_LIMIT) {
			// reveal 2 random cards from the target's hand; actor picks 1 to steal
			const shuffled = shuffle(target.hand, ctx.state.rng);
			const card1 = shuffled[0]!;
			const card2 = shuffled[1]!;
			ctx.state.pendingInteraction = {
				type: "watcher_steal_pick",
				actorId: ctx.actor.playerId,
				targetPlayerId: target.playerId,
				revealedCards: [card1, card2],
			} satisfies PendingInteraction;
		}

		const stolen = Math.min(effect.cashAmount, target.cash);
		target.cash -= stolen;
		ctx.actor.cash += stolen;
	},

	peek_two_random_enemy_cards_discard_one(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target || target.hand.length === 0) return;
		const shuffled = shuffle(target.hand, ctx.state.rng);
		const card1 = shuffled[0]!;
		const card2 = shuffled[1] ?? shuffled[0]!;
		ctx.state.pendingInteraction = {
			type: "peek_discard",
			actorId: ctx.actor.playerId,
			revealedCards: [card1, card2],
		} satisfies PendingInteraction;
	},

	reveal_enemy_crew_class(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) return;
		const eligibleSlots = ([0, 1] as const).filter(
			(i) => target.crewIds[i] !== null && !target.crewTurned[i],
		);
		if (eligibleSlots.length === 0) return;
		ctx.state.pendingInteraction = {
			type: "truth_serum_reveal",
			actorId: ctx.actor.playerId,
			targetPlayerId: target.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;

export function resolveWatcherStealPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	targetPlayerId: string,
	cardId: string,
	revealedCards: readonly [string, string],
): boolean {
	if (!revealedCards.includes(cardId)) return false;
	if (actor.hand.length >= C.HAND_LIMIT) return false;

	const target = state.players.get(targetPlayerId);
	if (!target) return false;

	const idx = target.hand.indexOf(cardId);
	if (idx === -1) return false;

	const [taken] = target.hand.splice(idx, 1);
	if (!taken) return false;
	target.costOverrides.delete(taken);
	actor.hand.push(taken);
	return true;
}

export function resolveLighthouseDisablePick(
	state: FaceturnServerState,
	targetPlayerId: string,
	slot: number,
	eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[],
): void {
	const isEligible = eligibleTargets.some(
		(t) => t.playerId === targetPlayerId && t.slot === slot,
	);
	if (!isEligible) return;
	const target = state.players.get(targetPlayerId);
	if (!target) return;
	const crewSlot = slot as 0 | 1;
	if (!target.crewIds[crewSlot]) return;
	if (!target.crewTurned[crewSlot]) return;
	target.disabledPassiveSlots.add(crewSlot);
	recomputePassives(target, state);
}

// truth serum reveals base class; overrides can't apply to face-down crew
export function resolveTruthSerumReveal(
	target: FaceturnServerPlayer,
	slot: number,
	eligibleSlots: readonly number[],
): { revealedSlot: number; revealedClass: CrewClass } | null {
	if (!eligibleSlots.includes(slot)) return null;
	const crewId = target.crewIds[slot as 0 | 1];
	if (!crewId) return null;
	const revealedClass = getCrew(crewId).class;
	return { revealedSlot: slot, revealedClass };
}