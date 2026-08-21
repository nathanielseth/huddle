import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { EffectPrimitive } from "../cards";
import { getCrew, getMove, CARD_IDS } from "../cards";
import { shuffle } from "../../lib/random";
import { recomputePassives } from "../derived";
import type { Handler } from "./shared";
import { findEffectAmount, resolveTarget } from "./shared";
import type { PendingInteraction } from "../interactions/types";

export function drawCards(player: FaceturnServerPlayer, count: number): void {
	const room = Math.min(
		count,
		player.deck.length,
		Math.max(0, C.HAND_LIMIT - player.hand.length),
	);
	if (room <= 0) return;
	player.hand.push(...player.deck.splice(0, room));
}

export function discardFromHand(
	player: FaceturnServerPlayer,
	count: number,
	state: FaceturnServerState,
): string[] {
	const toDiscard = player.hand.splice(0, Math.min(count, player.hand.length));
	player.discardPile.push(...toDiscard);
	player.totalCardsDiscarded += toDiscard.length;
	for (const id of toDiscard) player.costOverrides.delete(id);

	if (toDiscard.length > 0) {
		maybeTriggerDoctorNorman(player, toDiscard.length);
		checkRatQueenDrawTrigger(player, state);
	}

	return toDiscard;
}

const DOCTOR_NORMAN_ARMOR_PER_DISCARD = 10;

// doctor norman armor per self-initiated discard, scaled by cards discarded
function maybeTriggerDoctorNorman(
	player: FaceturnServerPlayer,
	cardsDiscarded: number,
): void {
	if (cardsDiscarded <= 0) return;
	const slot = player.crewIds.findIndex(
		(id) => id === CARD_IDS.CREW.DOCTOR_NORMAN,
	);
	if (slot === -1) return;
	if (!player.crewTurned[slot as 0 | 1]) return;
	if (player.derived.crewSkillsDisabled) return;
	if (player.disabledPassiveSlots.has(slot as 0 | 1)) return;
	player.bossArmor += DOCTOR_NORMAN_ARMOR_PER_DISCARD * cardsDiscarded;
	player.hasArmoredBossThisGame = true;
}

export function checkRatQueenDrawTrigger(
	player: FaceturnServerPlayer,
	_state: FaceturnServerState,
): void {
	if (player.hand.length !== 0) return;
	if (player.ratQueenDrawUsedThisTurn) return;
	const slot = player.crewIds.findIndex((id) => id === CARD_IDS.CREW.RAT_QUEEN);
	if (slot === -1) return;
	if (!player.crewTurned[slot as 0 | 1]) return;
	if (player.derived.crewSkillsDisabled) return;
	if (player.disabledPassiveSlots.has(slot as 0 | 1)) return;
	player.ratQueenDrawUsedThisTurn = true;

	const amount = findEffectAmount(
		getCrew(CARD_IDS.CREW.RAT_QUEEN).passiveEffects,
		"passive_draw_on_hand_empty_once_per_turn",
	);
	drawCards(player, amount);
}

export function sellMoveFromHand(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	moveId: string,
): boolean {
	if (!actor.derived.hasSellCards) return false;
	const handIndex = actor.hand.indexOf(moveId);
	if (handIndex === -1) return false;

	actor.hand.splice(handIndex, 1);
	actor.discardPile.push(moveId);
	actor.totalCardsDiscarded++;
	actor.costOverrides.delete(moveId);
	actor.cash += actor.derived.sellCardCashAmount;

	maybeTriggerDoctorNorman(actor, 1);
	checkRatQueenDrawTrigger(actor, state);
	return true;
}

export const drawDiscardHandlers = {
	draw_cards(effect, ctx) {
		if (effect.type !== "draw_cards") return;
		drawCards(ctx.actor, effect.amount);
	},

	discard_cards_from_hand(effect, ctx) {
		if (effect.type !== "discard_cards_from_hand") return true;
		const available = Math.min(effect.amount, ctx.actor.hand.length);
		discardFromHand(ctx.actor, effect.amount, ctx.state);
		return available === effect.amount;
	},

	discard_variable_by_bluff_flag(effect, ctx) {
		if (effect.type !== "discard_variable_by_bluff_flag") return true;
		const amount = ctx.actor.hasCalledBluffSuccessfully
			? effect.reducedAmount
			: effect.baseAmount;
		const available = Math.min(amount, ctx.actor.hand.length);
		discardFromHand(ctx.actor, amount, ctx.state);
		return available === amount;
	},

	discard_all_enemy_hand(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) {
			ctx.state.lastEnemyHandDiscardCount = 0;
			return;
		}
		const discarded = target.hand.splice(0);
		target.discardPile.push(...discarded);
		target.totalCardsDiscarded += discarded.length;
		for (const id of discarded) target.costOverrides.delete(id);
		ctx.state.lastEnemyHandDiscardCount = discarded.length;
		// doctor norman does not trigger on enemy-forced discards
		if (discarded.length > 0) {
			checkRatQueenDrawTrigger(target, ctx.state);
		}
	},

	discard_all_actives_all_players(_effect, ctx) {
		for (const player of ctx.state.players.values()) {
			for (let i = 0; i < player.activeMoves.length; i++) {
				const moveId = player.activeMoves[i];
				if (!moveId) continue;
				if (getMove(moveId).moveType === "active") {
					player.discardPile.push(moveId);
					player.activeMoves[i] = null;
					player.trickleDownTargets.delete(i as 0 | 1 | 2);
					player.totalCardsDiscarded++;
				}
			}
			recomputePassives(player, ctx.state);
		}
	},

	discard_enemy_actives(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) return;
		for (let i = 0; i < target.activeMoves.length; i++) {
			const moveId = target.activeMoves[i];
			if (!moveId) continue;
			if (getMove(moveId).moveType === "active") {
				target.discardPile.push(moveId);
				target.activeMoves[i] = null;
				target.trickleDownTargets.delete(i as 0 | 1 | 2);
				target.totalCardsDiscarded++;
			}
		}
		recomputePassives(target, ctx.state);
	},

	discard_one_draw_three(_effect, ctx) {
		if (ctx.actor.hand.length === 0) return;
		discardFromHand(ctx.actor, 1, ctx.state);
		drawCards(ctx.actor, 3);
	},

	draw_cards_or_more_if_hand_was_empty(effect, ctx) {
		if (effect.type !== "draw_cards_or_more_if_hand_was_empty") return;
		if (ctx.actor.hand.length === 0) {
			drawCards(ctx.actor, effect.bonusAmount);
		} else {
			drawCards(ctx.actor, effect.baseAmount);
		}
	},

	return_one_from_discard_to_hand(_effect, ctx) {
		if (ctx.actor.discardPile.length === 0) return;
		if (ctx.actor.discardPile.length === 1) {
			const only = ctx.actor.discardPile.pop()!;
			if (ctx.actor.hand.length < C.HAND_LIMIT) {
				ctx.actor.hand.push(only);
			} else {
				ctx.actor.discardPile.push(only); // hand full, fizzle but keep card
			}
			return;
		}
		ctx.state.pendingInteraction = {
			type: "choose_from_discard",
			actorId: ctx.actor.playerId,
			discardPileSnapshot: [...ctx.actor.discardPile],
		} satisfies PendingInteraction;
	},

	return_discards_to_hand_until_full(_effect, ctx) {
		while (
			ctx.actor.discardPile.length > 0 &&
			ctx.actor.hand.length < C.HAND_LIMIT
		) {
			const card = ctx.actor.discardPile.shift()!;
			ctx.actor.hand.push(card);
		}
	},

	search_deck_for_card_add_to_hand(effect, ctx) {
		if (effect.type !== "search_deck_for_card_add_to_hand") return;
		const actor = ctx.actor;
		if (actor.hand.includes(effect.cardId)) return; // already in hand, fizzle
		const idx = actor.deck.indexOf(effect.cardId);
		if (idx === -1) return; // not in deck, fizzle
		if (actor.hand.length >= C.HAND_LIMIT) return;
		actor.deck.splice(idx, 1);
		actor.hand.push(effect.cardId);
		actor.costOverrides.set(effect.cardId, effect.costOverride ?? 0);
		actor.deck = shuffle(actor.deck, ctx.state.rng);
	},

	look_at_top_deck_draw_one(effect, ctx) {
		if (effect.type !== "look_at_top_deck_draw_one") return;
		const revealed = ctx.actor.deck.slice(0, effect.lookCount);
		if (revealed.length === 0) return; // empty deck, fizzle
		ctx.state.pendingInteraction = {
			type: "dig_deep_pick",
			actorId: ctx.actor.playerId,
			revealedCards: revealed,
			maxPicks: effect.drawCount ?? 1,
		} satisfies PendingInteraction;
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;