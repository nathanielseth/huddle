import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { EffectPrimitive } from "../cards";
import type { CrewTurnCause } from "../../../../../shared/games/face-turn/log";
import { CARD_IDS, getCrew } from "../cards";
import { shuffle } from "../../lib/random";
import { recomputePassives } from "../derived";
import type { Handler } from "./shared";
import {
	checkVoidPiecesAssembled,
	getEnemies,
	resolveAllyTarget,
	resolveCrewClass,
	resolveStrictAllyTarget,
	resolveTarget,
} from "./shared";
import { firstTurnedSlot, firstUnturnedSlot } from "./strikes";
import { applyDamage } from "./damage";
import { drawCards, discardFromHand } from "./draw-discard";
import {
	applyBloodMoneyOnStrike,
	resolveStrikeOrExecute,
	triggerCrewTurnedEffects,
	turnCrewAtSlot,
	hideCrewAtSlot,
	type StrikeOrExecuteOutcome,
} from "./strikes";
import type { PendingInteraction } from "../interactions/types";

export const miscHandlers = {
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
	},

	gain_cash_and_draw_ally(effect, ctx) {
		if (effect.type !== "gain_cash_and_draw_ally") return;
		const target = resolveStrictAllyTarget(ctx);
		if (!target) return;
		target.cash += effect.cashAmount;
		drawCards(target, effect.drawAmount);
	},

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
		actor.derived.crewClassOverrides.delete(s);
		actor.disabledPassiveSlots.delete(s);
		recomputePassives(actor, ctx.state);

		triggerCrewTurnedEffects(ctx.state, actor, s);

		ctx.state.lastResolution = {
			type: "crew_class_revealed",
			actorId: actor.playerId,
			targetPlayerId: actor.playerId,
			revealedSlot: s,
			revealedClass: getCrew(CARD_IDS.CREW.WOLFMAN).class,
		};
	},

	give_ally_cash_then_optional_hide(effect, ctx) {
		if (effect.type !== "give_ally_cash_then_optional_hide") return;
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
			type: "tactical_support_hide_offer",
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

	become_also_striker() {},
	become_also_hider() {},
	become_also_defender() {},
	command_guess_crew_class_turn_if_correct() {},
	command_replace_crew_from_reserve() {},
	passive_all_damage_is_piercing() {},
	passive_armor_on_ally_crew_turn() {},
	passive_disable_all_enemy_crew_passives() {},
	passive_reduce_class_action_costs() {},
	passive_steal_cash_on_damage_dealt() {},
	passive_razor_stab_on_strike_or_damage() {},
	passive_strike_on_self_turned_ally() {},
	passive_turn_self_down_on_enemy_crew_kill() {},
	passive_cash_per_turn() {},
	passive_draw_per_turn() {},
	passive_cash_on_enemy_move_or_strike() {},
	passive_heal_on_move_played() {},
	passive_damage_random_enemy_on_move_played() {},
	passive_armor_per_turn() {},
	passive_sell_moves_for_cash() {},
	passive_optional_discard_for_damage_per_turn() {},
	passive_negate_damage_percent() {},
	passive_reduce_all_move_costs() {},
	passive_reduce_burst_move_costs() {},
	passive_increase_enemy_move_costs() {},
	passive_cash_on_damage_taken() {},
	passive_disable_all_crew_skills() {},
	passive_defender_chooses_crew_to_turn() {},
	passive_background_check() {},
	passive_team_cash_on_ally_collect() {},
	passive_life_insurance(_effect, ctx) {
		if (!ctx.moveId) return;
		const slot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (slot === -1) return;
		const protectedAlly = resolveAllyTarget(ctx);
		ctx.actor.lifeInsuranceTargets.set(slot, protectedAlly.playerId);
	},
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
	passive_watcher_hide_on_challenge_win() {},
	passive_optional_strike_on_successful_challenge() {},
	passive_suppress_enemy_turned_effects() {},
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
			remaining.push(cardId);
		}
	}

	actor.deck.push(...remaining);
	actor.deck = shuffle(actor.deck, rng);
}

export function resolveSwitchUpPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	hideSlot: number,
	turnSlot: number,
	faceUpSlots: readonly number[],
	faceDownSlots: readonly number[],
): void {
	if (hideSlot === turnSlot) return;
	if (!faceUpSlots.includes(hideSlot)) return;
	if (!faceDownSlots.includes(turnSlot)) return;
	// only switch-up ever opens this interaction
	const via: CrewTurnCause = { reason: "move", moveId: CARD_IDS.MOVE.SWITCH_UP };
	hideCrewAtSlot(state, actor, hideSlot as 0 | 1, false, via);
	recomputePassives(actor, state);
	turnCrewAtSlot(state, actor, turnSlot as 0 | 1, null, via);
	recomputePassives(actor, state);
	triggerCrewTurnedEffects(state, actor, turnSlot as 0 | 1);
}

export function resolveTacticalSupportHide(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	slot: number | null,
	eligibleSlots: readonly number[],
): void {
	if (slot === null) return;
	if (!eligibleSlots.includes(slot)) return;
	// only tactical-support ever opens this interaction
	hideCrewAtSlot(state, target, slot as 0 | 1, false, {
		reason: "move",
		moveId: CARD_IDS.MOVE.TACTICAL_SUPPORT,
	});
	recomputePassives(target, state);
}

export function resolveWatcherHide(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	targetPlayerId: string | null,
	slot: number | null,
	eligibleTargets: readonly { playerId: string; slot: number }[],
): void {
	if (slot === null) return;
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
	hideCrewAtSlot(state, target, slot as 0 | 1, false, {
		reason: "boss_passive",
		bossId: CARD_IDS.BOSS.THE_WATCHER,
	});
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

// passing or an illegal target is a legal no-op; if actor's active zone is full it fizzles silently
export function resolveBelladonnaCopyPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	confirmed: boolean,
	targetPlayerId: string | null,
	targetActiveMoveSlot: number | null,
	eligibleTargets: readonly {
		playerId: string;
		slot: 0 | 1 | 2;
		moveId: string;
	}[],
): void {
	if (!confirmed) return;
	if (targetPlayerId === null || targetActiveMoveSlot === null) return;

	const isEligible = eligibleTargets.some(
		(t) => t.playerId === targetPlayerId && t.slot === targetActiveMoveSlot,
	);
	if (!isEligible) return;

	const target = state.players.get(targetPlayerId);
	if (!target) return;
	const tSlot = targetActiveMoveSlot as 0 | 1 | 2;
	const moveId = target.activeMoves[tSlot];
	if (!moveId) return;

	const ownSlot = actor.activeMoves.findIndex((s) => s === null);
	if (ownSlot === -1) return;

	actor.activeMoves[ownSlot] = moveId;
	recomputePassives(actor, state);
}

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

	state.pendingInteraction = {
		type: "bear_bones_bonus_strike",
		actorId: actor.playerId,
		eligibleTargetIds: [defeatedPlayerId],
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
	const target = state.players.get(targetPlayerId);
	if (!target || state.eliminatedPlayers.has(targetPlayerId)) return null;

	const outcome = resolveStrikeOrExecute(
		state,
		target,
		actor.playerId,
		{ reason: "strike" },
		targetSlot !== null ? (targetSlot as 0 | 1) : undefined,
	);
	applyBloodMoneyOnStrike(state, actor);
	return outcome;
}

export function resolveBackgroundCheckGuess(
	state: FaceturnServerState,
	challenger: FaceturnServerPlayer,
	target: FaceturnServerPlayer,
	guessedSlot: number,
	guessedClass: "striker" | "defender" | "collector" | "hider",
	eligibleSlots: readonly number[],
): { correct: boolean } {
	if (!eligibleSlots.includes(guessedSlot)) return { correct: false };
	const slot = guessedSlot as 0 | 1;
	const matches = resolveCrewClass(target, slot, guessedClass) === true;
	if (!matches) {
		const ownSlot =
			firstUnturnedSlot(challenger) ?? firstTurnedSlot(challenger);
		if (ownSlot !== null) {
			turnCrewAtSlot(state, challenger, ownSlot, null, {
				reason: "move",
				moveId: CARD_IDS.MOVE.BACKGROUND_CHECK,
			});
			recomputePassives(challenger, state);
			triggerCrewTurnedEffects(state, challenger, ownSlot);
		}
	}
	return { correct: matches };
}

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

		turnCrewAtSlot(state, target, mark.targetSlot, caster.playerId, {
			reason: "move",
			moveId: CARD_IDS.MOVE.WARRANT_OF_ARREST,
		});
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, mark.targetSlot, true);
	}
}