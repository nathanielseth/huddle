import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { EffectPrimitive } from "../cards";
import { CARD_IDS } from "../cards";
import { shuffle } from "../../lib/random";
import { recomputePassives } from "../derived";
import type { Handler } from "./index";
import {
	checkVoidPiecesAssembled,
	firstTurnedSlot,
	firstUnturnedSlot,
	getEnemies,
	resolveAllyTarget,
	resolveCrewClass,
	resolveStrictAllyTarget,
	resolveTarget,
} from "./index";
import { applyDamage } from "./damage";
import { drawCards, discardFromHand } from "./draw-discard";
import {
	applyBloodMoneyOnStrike,
	resolveStrikeOrExecute,
	triggerCrewTurnedEffects,
	turnCrewAtSlot,
	unturnCrewAtSlot,
	type StrikeOrExecuteOutcome,
} from "./strikes";
import type { PendingInteraction } from "../interactions/types";

export const miscHandlers = {
	// warrant of arrest: locks in target player + slot + crewId now;
	// resolution is entirely owned by processWarrantOfArrestTicks (game.ts
	// startTurn). Keyed by the caster's own active-move slot so multiple
	// copies track independently. Fizzles quietly if the target has no
	// face-down crew at cast time.
	mark_enemy_crew_for_delayed_turn(_effect, ctx) {
		if (!ctx.moveId) return;
		const ownSlot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (ownSlot === -1) return;
		const target = resolveTarget(ctx);
		if (!target) return;
		const slot = ctx.targetCrewSlot as 0 | 1 | undefined;
		if (slot === undefined) return;
		const crewId = target.crewIds[slot];
		if (!crewId || target.crewTurned[slot]) return;
		ctx.actor.warrantMarks.set(ownSlot, {
			targetPlayerId: target.playerId,
			targetSlot: slot,
			targetCrewId: crewId,
			turnsRemaining: 2,
		});
	},

	// sabotage: ctx.targetActiveMoveSlot is a dedicated 0-2 field, distinct
	// from targetCrewSlot (see EffectContext / play_move / chain_play_burst).
	// an empty slot, a slow-move slot, or no slot at all is a clean whiff —
	// the card still plays and still costs cash by design.
	discard_targeted_enemy_active_move(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) return;
		if (ctx.targetActiveMoveSlot === undefined) return;
		const slot = ctx.targetActiveMoveSlot;
		if (slot < 0 || slot > 2) return;
		const moveId = target.activeMoves[slot as 0 | 1 | 2];
		if (!moveId) return;
		target.activeMoves[slot as 0 | 1 | 2] = null;
		target.trickleDownTargets.delete(slot as 0 | 1 | 2);
		target.discardPile.push(moveId);
		target.totalCardsDiscarded++;
		recomputePassives(target, ctx.state);
	},

	// restock: harmless no-op reshuffle when the discard pile is empty,
	// guarded explicitly to avoid a pointless array-churn/shuffle call
	shuffle_discard_into_deck_then_draw(_effect, ctx) {
		if (ctx.actor.discardPile.length > 0) {
			ctx.actor.deck = shuffle(
				[...ctx.actor.deck, ...ctx.actor.discardPile],
				ctx.state.rng,
			);
			ctx.actor.discardPile = [];
		}
		drawCards(ctx.actor, 1);
	},

	// red herring: picks (or defaults to) a face-down slot, sets the
	// redirect mark, then discards itself out of the active zone
	// immediately — the card text's "then discard this Move" happens at
	// cast time, same slot-lookup trick passive_life_insurance uses above.
	choose_red_herring_crew(_effect, ctx) {
		const actor = ctx.actor;
		const slot =
			ctx.targetCrewSlot !== undefined
				? (ctx.targetCrewSlot as 0 | 1)
				: firstUnturnedSlot(actor);
		if (slot === null || !actor.crewIds[slot] || actor.crewTurned[slot]) {
			return;
		}
		const crewId = actor.crewIds[slot];
		actor.redHerringMark = { slot, crewId };

		if (ctx.moveId) {
			const activeSlot = actor.activeMoves.indexOf(ctx.moveId);
			if (activeSlot !== -1) {
				actor.activeMoves[activeSlot] = null;
				actor.discardPile.push(ctx.moveId);
				actor.totalCardsDiscarded++;
			}
		}
	},

	// my treat: requires a genuine teammate (moveHasLegalTarget already
	// guarantees this before the card can be cast); the null-check here is
	// defense in depth, not a real expected path
	gain_cash_and_draw_ally(effect, ctx) {
		if (effect.type !== "gain_cash_and_draw_ally") return;
		const target = resolveStrictAllyTarget(ctx);
		if (!target) return;
		target.cash += effect.cashAmount;
		drawCards(target, effect.drawAmount);
	},

	// win condition
	win_if_void_pieces_assembled(_effect, ctx) {
		if (!checkVoidPiecesAssembled(ctx.actor)) return;
		ctx.state.winnerId = ctx.actor.playerId;
		ctx.state.winCondition = "void_assembly";
		ctx.state.phase = "finished";
	},

	transform_andrew_into_wolfman(_effect, ctx) {
		const actor = ctx.actor;
		const slot = actor.crewIds.findIndex(
			(id, i) =>
				id === CARD_IDS.CREW.ANDREW &&
				actor.crewTurned[i as 0 | 1] &&
				!actor.disabledPassiveSlots.has(i as 0 | 1),
		);
		if (slot === -1) return;
		const s = slot as 0 | 1;
		actor.crewIds[s] = CARD_IDS.CREW.WOLFMAN;
		actor.crewTurned[s] = false;
		actor.derived.crewClassOverrides.delete(s);
		actor.disabledPassiveSlots.delete(s);
		recomputePassives(actor, ctx.state);
	},

	give_ally_cash_then_optional_unturn(effect, ctx) {
		if (effect.type !== "give_ally_cash_then_optional_unturn") return;
		const target =
			ctx.targetPlayerId !== undefined
				? (ctx.state.players.get(ctx.targetPlayerId) ?? ctx.actor)
				: ctx.actor;
		target.cash += effect.cashAmount;

		const hasFaceUpCrew = target.crewIds.some(
			(id, i) => id !== null && target.crewTurned[i as 0 | 1],
		);
		if (!hasFaceUpCrew) return;

		const eligibleSlots = ([0, 1] as const).filter(
			(i) => target.crewIds[i] !== null && target.crewTurned[i],
		);
		ctx.state.pendingInteraction = {
			type: "tactical_support_unturn_offer",
			actorId: ctx.actor.playerId,
			targetPlayerId: target.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
	},

	discard_then_reactivate_ally_turned_effect(effect, ctx) {
		if (effect.type !== "discard_then_reactivate_ally_turned_effect") return;
		const discarded = discardFromHand(ctx.actor, effect.discardCost, ctx.state);
		if (discarded.length !== effect.discardCost) return;

		const eligibleSlots: number[] = [];
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			const crewId = ctx.actor.crewIds[slot];
			if (
				crewId &&
				ctx.actor.crewTurned[slot] &&
				!ctx.actor.derived.crewSkillsDisabled
			) {
				eligibleSlots.push(slot);
			}
		}
		if (eligibleSlots.length === 0) return;
		ctx.state.pendingInteraction = {
			type: "crew_reactivate",
			actorId: ctx.actor.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
	},

	mutual_discard_hand_then_redraw_same_count(_effect, ctx) {
		const target = resolveTarget(ctx);
		const actorCount = ctx.actor.hand.length;
		discardFromHand(ctx.actor, actorCount, ctx.state);
		drawCards(ctx.actor, actorCount);

		if (target) {
			const targetCount = target.hand.length;
			discardFromHand(target, targetCount, ctx.state);
			drawCards(target, targetCount);
		}
	},

	// the following are resolved structurally elsewhere (recomputePassiveSwitch
	// in derived.ts accumulates their magnitude into derived stats, or - for the
	// two command_* entries - the-razor/the-dealer's hasCustomCommandLogic branch
	// in index.ts's use_boss_command handles them inline and never reaches
	// resolveEffects for those bosses). still listed here as no-ops so the
	// handler map stays exhaustive over EffectPrimitive["type"].
	become_also_striker() {},
	become_also_unturner() {},
	become_also_defender() {},
	command_guess_crew_class_turn_if_correct() {},
	command_replace_crew_from_reserve() {},
	passive_all_damage_is_piercing() {},
	passive_armor_on_ally_crew_turn() {},
	passive_disable_all_enemy_crew_passives() {},
	passive_reduce_class_action_costs() {},
	passive_steal_cash_on_damage_dealt() {},
	passive_strike_on_self_turned_ally() {},
	passive_turn_self_down_on_enemy_crew_kill() {},
	// stat accumulators or live-triggered; no runtime handler needed here
	passive_cash_per_turn() {},
	passive_draw_per_turn() {},
	passive_cash_on_enemy_move_or_strike() {},
	passive_heal_on_move_played() {},
	passive_damage_random_enemy_on_move_played() {},
	passive_armor_per_turn() {},
	passive_sell_moves_for_cash() {},
	passive_optional_discard_for_damage_per_turn() {},
	passive_flat_damage_bonus() {},
	passive_negate_damage_percent() {},
	passive_reduce_all_move_costs() {},
	passive_reduce_burst_move_costs() {},
	passive_increase_enemy_move_costs() {},
	passive_cash_on_damage_taken() {},
	passive_disable_all_crew_skills() {},
	passive_defender_chooses_crew_to_turn() {},
	passive_background_check() {},
	passive_team_cash_on_ally_collect() {},
	// life insurance: stores protected target keyed by active move slot
	passive_life_insurance(_effect, ctx) {
		if (!ctx.moveId) return;
		const slot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (slot === -1) return;
		const protectedAlly = resolveAllyTarget(ctx);
		ctx.actor.lifeInsuranceTargets.set(slot, protectedAlly.playerId);
	},
	// mirrors life insurance: stores watched enemy in trickleDownTargets
	passive_mirror_enemy_collect_cash(_effect, ctx) {
		if (!ctx.moveId) return;
		const slot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (slot === -1) return;
		if (!ctx.targetPlayerId) return;
		const target = ctx.state.players.get(ctx.targetPlayerId);
		if (!target || ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) return;
		ctx.actor.trickleDownTargets.set(slot, ctx.targetPlayerId);
	},
	passive_false_flag() {},
	passive_defend_strikes_above_half_hp() {},
	passive_armor_on_discard() {},
	passive_draw_on_hand_empty_once_per_turn() {},
	passive_watcher_unturn_on_challenge_win() {},
	passive_optional_strike_on_successful_challenge() {},
	passive_suppress_enemy_turned_effects() {},
	// derived stat set in recomputePassiveSwitch; nothing to do at play time
	passive_cash_on_challenge_win() {},
	passive_self_damage_and_cash_per_turn() {},
	passive_cease_and_desist() {},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;

export function resolveVoidLegsChoice(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	confirmed: boolean,
	damage: number,
): void {
	if (!confirmed) return;
	if (actor.hand.length === 0) return;
	discardFromHand(actor, 1, state);
	const target = getEnemies(state, actor.playerId)[0];
	if (!target) return;
	applyDamage(state, target, damage, actor);
}

export function resolveChooseDiscardCount(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	count: number,
	maxCount: number,
	targetPlayerId: string,
	damagePerCard: number,
): void {
	if (count < 0 || count > maxCount) return;
	if (count > actor.hand.length) return;
	if (count > 0) discardFromHand(actor, count, state);
	const target = state.players.get(targetPlayerId);
	if (!target || state.eliminatedPlayers.has(targetPlayerId)) return;
	if (count > 0) applyDamage(state, target, count * damagePerCard, actor);
}

export function resolveChooseFromDiscard(
	actor: FaceturnServerPlayer,
	cardId: string,
	snapshot: readonly string[],
): void {
	if (!snapshot.includes(cardId)) return;
	const idx = actor.discardPile.indexOf(cardId);
	if (idx === -1) return;
	if (actor.hand.length >= C.HAND_LIMIT) return;
	actor.discardPile.splice(idx, 1);
	actor.hand.push(cardId);
}

export function resolveDigDeepPick(
	actor: FaceturnServerPlayer,
	cardIds: readonly string[],
	lookCount: number,
	maxPicks: number = 1,
	rng: () => number = Math.random,
): void {
	const topSlice = actor.deck.slice(0, lookCount);
	if (topSlice.length === 0) return;

	const picks = cardIds.slice(0, maxPicks);

	const availableCounts = new Map<string, number>();
	for (const id of topSlice) {
		availableCounts.set(id, (availableCounts.get(id) ?? 0) + 1);
	}

	const actuallyPicked: string[] = [];
	for (const cardId of picks) {
		const count = availableCounts.get(cardId) ?? 0;
		if (count <= 0) continue;
		availableCounts.set(cardId, count - 1);
		actuallyPicked.push(cardId);
	}

	if (actuallyPicked.length === 0) return;

	actor.deck.splice(0, lookCount);

	const remaining: string[] = [];
	for (const [id, count] of availableCounts) {
		for (let i = 0; i < count; i++) remaining.push(id);
	}

	for (const cardId of actuallyPicked) {
		if (actor.hand.length < C.HAND_LIMIT) {
			actor.hand.push(cardId);
		} else {
			remaining.push(cardId); // hand full, shuffle back
		}
	}

	actor.deck.push(...remaining);
	actor.deck = shuffle(actor.deck, rng);
}

export function resolveSwitchUpPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	unturnSlot: number,
	turnSlot: number,
	faceUpSlots: readonly number[],
	faceDownSlots: readonly number[],
): void {
	if (unturnSlot === turnSlot) return;
	if (!faceUpSlots.includes(unturnSlot)) return;
	if (!faceDownSlots.includes(turnSlot)) return;
	unturnCrewAtSlot(state, actor, unturnSlot as 0 | 1);
	recomputePassives(actor, state);
	turnCrewAtSlot(state, actor, turnSlot as 0 | 1);
	recomputePassives(actor, state);
	triggerCrewTurnedEffects(state, actor, turnSlot as 0 | 1);
}

export function resolveTacticalSupportUnturn(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	slot: number | null,
	eligibleSlots: readonly number[],
): void {
	if (slot === null) return; // declined
	if (!eligibleSlots.includes(slot)) return;
	unturnCrewAtSlot(state, target, slot as 0 | 1);
	recomputePassives(target, state);
}

export function resolveWatcherUnturn(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	targetPlayerId: string | null,
	slot: number | null,
	eligibleTargets: readonly { playerId: string; slot: number }[],
): void {
	if (slot === null) return; // declined
	const resolvedPlayerId = targetPlayerId ?? actor.playerId;
	const isEligible = eligibleTargets.some(
		(t) => t.playerId === resolvedPlayerId && t.slot === slot,
	);
	if (!isEligible) return;
	const target =
		resolvedPlayerId === actor.playerId
			? actor
			: state.players.get(resolvedPlayerId);
	if (!target) return;
	unturnCrewAtSlot(state, target, slot as 0 | 1);
	recomputePassives(target, state);
}

export function resolveTagOutPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	teammate: FaceturnServerPlayer,
	ownSlot: number,
	teammateSlot: number,
	ownEligibleSlots: readonly number[],
	teammateEligibleSlots: readonly number[],
): void {
	if (!ownEligibleSlots.includes(ownSlot)) return;
	if (!teammateEligibleSlots.includes(teammateSlot)) return;
	const oSlot = ownSlot as 0 | 1;
	const tSlot = teammateSlot as 0 | 1;

	const ownId = actor.crewIds[oSlot];
	const ownTurned = actor.crewTurned[oSlot];
	const ownOverrides = actor.derived.crewClassOverrides.get(oSlot);

	const teammateId = teammate.crewIds[tSlot];
	const teammateTurned = teammate.crewTurned[tSlot];
	const teammateOverrides = teammate.derived.crewClassOverrides.get(tSlot);

	actor.crewIds[oSlot] = teammateId;
	actor.crewTurned[oSlot] = teammateTurned;
	if (teammateOverrides)
		actor.derived.crewClassOverrides.set(oSlot, teammateOverrides);
	else actor.derived.crewClassOverrides.delete(oSlot);

	teammate.crewIds[tSlot] = ownId;
	teammate.crewTurned[tSlot] = ownTurned;
	if (ownOverrides)
		teammate.derived.crewClassOverrides.set(tSlot, ownOverrides);
	else teammate.derived.crewClassOverrides.delete(tSlot);

	recomputePassives(actor, state);
	recomputePassives(teammate, state);
}

export function resolveTooBigSwapPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	ownSlot: number,
	targetPlayerId: string,
	targetSlot: number,
	eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[],
): void {
	const isEligible = eligibleTargets.some(
		(t) => t.playerId === targetPlayerId && t.slot === targetSlot,
	);
	if (!isEligible) return;
	const target = state.players.get(targetPlayerId);
	if (!target) return;
	const oSlot = ownSlot as 0 | 1;
	const tSlot = targetSlot as 0 | 1;

	const ownId = actor.crewIds[oSlot];
	const ownTurned = actor.crewTurned[oSlot];
	const ownOverrides = actor.derived.crewClassOverrides.get(oSlot);

	const targetId = target.crewIds[tSlot];
	const targetTurned = target.crewTurned[tSlot];
	const targetOverrides = target.derived.crewClassOverrides.get(tSlot);

	actor.crewIds[oSlot] = targetId;
	actor.crewTurned[oSlot] = targetTurned;
	if (targetOverrides)
		actor.derived.crewClassOverrides.set(oSlot, targetOverrides);
	else actor.derived.crewClassOverrides.delete(oSlot);

	target.crewIds[tSlot] = ownId;
	target.crewTurned[tSlot] = ownTurned;
	if (ownOverrides) target.derived.crewClassOverrides.set(tSlot, ownOverrides);
	else target.derived.crewClassOverrides.delete(tSlot);

	recomputePassives(actor, state);
	recomputePassives(target, state);
}

const BEAR_BONES_STRIKE_CASH_COST = 3;

// opens bear bones bonus strike offer if face-up and affordable
export function maybeOpenBearBonesOffer(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	defeatedPlayerId: string,
): void {
	if (actor.derived.crewSkillsDisabled) return;
	const slot = actor.crewIds.findIndex((id) => id === CARD_IDS.CREW.BEAR_BONES);
	if (slot === -1) return;
	if (!actor.crewTurned[slot as 0 | 1]) return;
	if (actor.disabledPassiveSlots.has(slot as 0 | 1)) return;
	if (!state.players.has(defeatedPlayerId)) return;
	if (state.eliminatedPlayers.has(defeatedPlayerId)) return;
	if (actor.cash < BEAR_BONES_STRIKE_CASH_COST) return;

	state.pendingInteraction = {
		type: "bear_bones_bonus_strike",
		actorId: actor.playerId,
		eligibleTargetIds: [defeatedPlayerId],
		cashCost: BEAR_BONES_STRIKE_CASH_COST,
	};
}

export function resolveBearBonesBonusStrike(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	confirmed: boolean,
	targetPlayerId: string | null,
	targetSlot: number | null,
): StrikeOrExecuteOutcome | null {
	if (!confirmed) return null;
	if (!targetPlayerId) return null;
	if (actor.cash < BEAR_BONES_STRIKE_CASH_COST) return null;
	const target = state.players.get(targetPlayerId);
	if (!target || state.eliminatedPlayers.has(targetPlayerId)) return null;

	actor.cash -= BEAR_BONES_STRIKE_CASH_COST;
	const outcome = resolveStrikeOrExecute(
		state,
		target,
		actor.playerId,
		true,
		targetSlot !== null ? (targetSlot as 0 | 1) : undefined,
	);
	// a bonus strike still counts as a strike for blood money
	applyBloodMoneyOnStrike(state, actor);
	return outcome;
}

// background check: wrong guess auto-turns one of the guesser's own crew
export function resolveBackgroundCheckGuess(
	state: FaceturnServerState,
	challenger: FaceturnServerPlayer,
	target: FaceturnServerPlayer,
	guessedSlot: number,
	guessedClass: "striker" | "defender" | "collector" | "unturner",
	eligibleSlots: readonly number[],
): { correct: boolean } {
	if (!eligibleSlots.includes(guessedSlot)) return { correct: false };
	const slot = guessedSlot as 0 | 1;
	const matches = resolveCrewClass(target, slot, guessedClass) === true;
	if (!matches) {
		const ownSlot =
			firstUnturnedSlot(challenger) ?? firstTurnedSlot(challenger);
		if (ownSlot !== null) {
			turnCrewAtSlot(state, challenger, ownSlot);
			recomputePassives(challenger, state);
			triggerCrewTurnedEffects(state, challenger, ownSlot);
		}
	}
	return { correct: matches };
}

// warrant of arrest: on turn start, decrements marks; resolves/discards when countdown hits 0 or crew is invalidated, ensuring cards leave play once their purpose is moot without double-discard
export function processWarrantOfArrestTicks(
	state: FaceturnServerState,
	caster: FaceturnServerPlayer,
): void {
	for (const [ownSlot, mark] of [...caster.warrantMarks]) {
		if (caster.activeMoves[ownSlot] !== CARD_IDS.MOVE.WARRANT_OF_ARREST) {
			caster.warrantMarks.delete(ownSlot);
			continue;
		}

		mark.turnsRemaining--;
		if (mark.turnsRemaining > 0) continue;

		caster.warrantMarks.delete(ownSlot);
		caster.activeMoves[ownSlot] = null;
		caster.discardPile.push(CARD_IDS.MOVE.WARRANT_OF_ARREST);
		caster.totalCardsDiscarded++;
		recomputePassives(caster, state);

		const target = state.players.get(mark.targetPlayerId);
		if (!target || state.eliminatedPlayers.has(mark.targetPlayerId)) continue;
		if (target.crewIds[mark.targetSlot] !== mark.targetCrewId) continue;
		if (target.crewTurned[mark.targetSlot]) continue;

		// not a strike
		turnCrewAtSlot(state, target, mark.targetSlot);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, mark.targetSlot, true);
	}
}