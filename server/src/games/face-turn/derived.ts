import type { FaceturnServerState, FaceturnServerPlayer } from "./types";
import type { CardEffect, EffectPrimitive, ConditionalEffect } from "./cards";
import { getCrew, getMove, getBoss, CARD_IDS } from "./cards";
import type { CrewClass } from "../../../../shared/games/face-turn/types";
import {
	getEnemies,
	getTeammates,
	resolveCrewClass,
	isConditionalEffect,
	checkVoidPiecesAssembled,
} from "./effects/shared";

// fully rebuilt from scratch on every recomputePassives call, never mutated incrementally
export interface FaceturnDerivedPlayerStats {
	cashGainPerTurn: number;
	drawPerTurn: number;
	cashOnEnemyMoveOrStrike: number;
	healOnMovePlayed: number;
	damageRandomEnemyOnMovePlayed: number;
	crewSkillsDisabled: boolean;
	crewPassivesSilencedByEnemy: boolean;
	// flat bonus applied once per effect resolution; not scaled by effect amount
	damageBonusFlat: number;
	damageReductionPercent: number;

	hasWatcherPassive: boolean;
	// true while bastion's dual-trigger cash passive is active
	hasBastionPassive: boolean;
	// pektus: when true, all damage this player deals bypasses armor (still respects immunity/reduction%)
	hasAllDamagePiercingPassive: boolean;
	// monkey man: cash stolen from the boss whenever this player deals damage to it
	stealCashOnDamageDealtAmount: number;
	// the razor: strike, or deal damage with a move other than Stab, to add a
	// copy of Stab to hand
	hasRazorStabPassive: boolean;
	armorPerTurn: number;
	// global move cost reduction; distinct from per-card costOverrides
	moveBaseCostReduction: number;
	// burst move cost reduction (zednem); separate from moveBaseCostReduction
	burstMoveCostReduction: number;
	// belladonna: flat reduction applied to strike/defend/collect/hide costs
	classActionCostReduction: number;
	// added to enemy move costs; read live from this player by opponents, not accumulated
	enemyMoveCostSurcharge: number;

	// defends strikes and face turn when bossHp > 60; attempt fizzles
	hasTerminalStrikeDefend: boolean;

	// extortion: cash gained whenever this player wins a challenge
	cashOnChallengeWinAmount: number;
	// sell out: self-inflicted damage + cash gained at the start of this player's own turn
	selfDamagePerTurn: number;
	selfDamageCashGainAmount: number;
	// cease & desist: true while the move sits in this player's active zone
	hasCeaseDesist: boolean;

	hasVoidArms: boolean;
	// grants team cash on any collector action; trigger-based
	hasSupplyDrop: boolean;
	supplyDropCashAmount: number;
	// true when protected by a teammate's life insurance
	hasLifeInsurance: boolean;
	// failed challenge discards the false flag active move instead of turning crew
	hasFalseFlag: boolean;

	// void legs choice at turn start
	hasVoidLegsChoice: boolean;
	voidLegsDiscardCost: number;
	voidLegsDamage: number;
	// forces a background check guess before challenge
	hasBackgroundCheck: boolean;

	crewClassOverrides: Map<number, Set<CrewClass>>;
}

export function makeEmptyDerivedStats(): FaceturnDerivedPlayerStats {
	return {
		cashGainPerTurn: 0,
		drawPerTurn: 0,
		cashOnEnemyMoveOrStrike: 0,
		healOnMovePlayed: 0,
		damageRandomEnemyOnMovePlayed: 0,
		crewSkillsDisabled: false,
		crewPassivesSilencedByEnemy: false,
		damageBonusFlat: 0,
		damageReductionPercent: 0,
		hasWatcherPassive: false,
		hasBastionPassive: false,
		hasAllDamagePiercingPassive: false,
		stealCashOnDamageDealtAmount: 0,
		hasRazorStabPassive: false,
		armorPerTurn: 0,
		moveBaseCostReduction: 0,
		burstMoveCostReduction: 0,
		classActionCostReduction: 0,
		enemyMoveCostSurcharge: 0,
		hasTerminalStrikeDefend: false,
		cashOnChallengeWinAmount: 0,
		selfDamagePerTurn: 0,
		selfDamageCashGainAmount: 0,
		hasCeaseDesist: false,
		hasVoidArms: false,
		hasSupplyDrop: false,
		supplyDropCashAmount: 0,
		hasLifeInsurance: false,
		hasFalseFlag: false,
		hasVoidLegsChoice: false,
		voidLegsDiscardCost: 0,
		voidLegsDamage: 0,
		hasBackgroundCheck: false,
		crewClassOverrides: new Map(),
	};
}

function hasActiveCrewSkillsDisableSource(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): boolean {
	for (const enemy of getEnemies(state, player.playerId)) {
		for (const moveId of enemy.activeMoves) {
			if (!moveId) continue;
			const hasDisable = getMove(moveId).effects.some((e) => {
				const eff = isConditionalEffect(e) ? e.effect : e;
				return eff.type === "passive_disable_all_crew_skills";
			});
			if (hasDisable) return true;
		}
	}
	return false;
}

function hasActiveEnemySilencer(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): boolean {
	for (const enemy of getEnemies(state, player.playerId)) {
		if (enemy.derived.crewSkillsDisabled) continue;
		for (const i of [0, 1] as const) {
			if (enemy.crewIds[i] !== CARD_IDS.CREW.SILENCER) continue;
			if (!enemy.crewTurned[i]) continue;
			if (enemy.disabledPassiveSlots.has(i)) continue;
			return true;
		}
	}
	return false;
}

const ALSO_CLASS_GRANTS: Partial<Record<EffectPrimitive["type"], CrewClass>> = {
	become_also_striker: "striker",
	become_also_hider: "hider",
	become_also_defender: "defender",
};

// pruning is a side‑effect cleanup, not a formula recompute; kept out of derived subtree
function pruneStaleIncomingPoison(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): void {
	const playersWithActivePoisonSource = new Set<string>();
	for (const p of state.players.values()) {
		const silencedByEnemy = hasActiveEnemySilencer(p, state);
		const hasPoisonFromCrew = p.crewIds.some((crewId, i) => {
			if (!crewId || !p.crewTurned[i as 0 | 1]) return false;
			if (p.derived.crewSkillsDisabled || silencedByEnemy) return false;
			if (p.disabledPassiveSlots.has(i as 0 | 1)) return false;
			return getCrew(crewId).passiveEffects.some((e) => {
				const eff = isConditionalEffect(e) ? e.effect : e;
				return eff.type === "passive_poison_per_round";
			});
		});
		const hasPoisonFromMove = p.activeMoves.some((moveId) => {
			if (!moveId) return false;
			return getMove(moveId).effects.some((e) => {
				const eff = isConditionalEffect(e) ? e.effect : e;
				return eff.type === "passive_poison_per_round";
			});
		});
		if (hasPoisonFromCrew || hasPoisonFromMove) {
			playersWithActivePoisonSource.add(p.playerId);
		}
	}
	for (const [sourceId] of [...player.incomingPoison]) {
		if (!playersWithActivePoisonSource.has(sourceId)) {
			player.incomingPoison.delete(sourceId);
		}
	}
}

// context‑free condition evaluator for passive recompute
function evaluateConditionForRecompute(
	condition: ConditionalEffect["condition"],
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): boolean {
	switch (condition.when) {
		case "always":
			return true;
		case "has_armored_boss":
			return player.bossArmor > 0;
		case "enemy_has_more_cash":
			return getEnemies(state, player.playerId).some(
				(enemy) => enemy.cash > player.cash,
			);
		case "void_pieces_assembled":
			return checkVoidPiecesAssembled(player);
		case "another_ally_is_turned":
			return true;
		case "has_turned_ally_crew_this_game":
			return player.hasTurnedAllyCrewThisGame;
		case "ally_class_is_turned":
			return [player, ...getTeammates(state, player.playerId)].some((p) =>
				p.crewIds.some((crewId, i) => {
					if (!crewId || !p.crewTurned[i as 0 | 1]) return false;
					return resolveCrewClass(p, i as 0 | 1, condition.class) === true;
				}),
			);
		case "self_class_is_turned":
			return player.crewIds.some((crewId, i) => {
				if (!crewId || !player.crewTurned[i as 0 | 1]) return false;
				return resolveCrewClass(player, i as 0 | 1, condition.class) === true;
			});
		case "self_turned_not_by_enemy":
			return true;
		case "no_face_up_crew":
			return [player, ...getTeammates(state, player.playerId)].every((p) =>
				p.crewIds.every((crewId, i) => !crewId || !p.crewTurned[i as 0 | 1]),
			);
		case "has_bluffed_successfully":
			return player.hasBluffedSuccessfully;
		default: {
			const _exhaustive: never = condition;
			return _exhaustive;
		}
	}
}

// cohesive switch mapping each passive‑source EffectPrimitive to a derived‑stat mutation
// writes into in‑progress stats, not directly to player
function recomputePassiveSwitch(
	effect: EffectPrimitive,
	stats: FaceturnDerivedPlayerStats,
): void {
	switch (effect.type) {
		case "passive_cash_per_turn":
			stats.cashGainPerTurn += effect.amount;
			break;
		case "passive_draw_per_turn":
			stats.drawPerTurn += effect.amount;
			break;
		case "passive_cash_on_enemy_move_or_strike":
			stats.cashOnEnemyMoveOrStrike += effect.amount;
			break;
		case "passive_heal_on_move_played":
			stats.healOnMovePlayed += effect.amount;
			break;
		case "passive_damage_random_enemy_on_move_played":
			stats.damageRandomEnemyOnMovePlayed += effect.amount;
			break;
		case "passive_armor_per_turn":
			stats.armorPerTurn += effect.amount;
			break;
		case "passive_razor_stab_on_strike_or_damage":
			stats.hasRazorStabPassive = true;
			break;
		case "passive_negate_damage_percent":
			stats.damageReductionPercent = Math.max(
				stats.damageReductionPercent,
				effect.percent,
			);
			break;
		case "passive_reduce_all_move_costs":
			stats.moveBaseCostReduction += effect.reduction;
			break;
		case "passive_reduce_burst_move_costs":
			stats.burstMoveCostReduction += effect.reduction;
			break;
		case "passive_reduce_class_action_costs":
			stats.classActionCostReduction += effect.reduction;
			break;
		case "passive_increase_enemy_move_costs":
			stats.enemyMoveCostSurcharge += effect.amount;
			break;
		case "passive_cash_on_damage_taken":
			stats.hasBastionPassive = true;
			break;
		case "passive_defend_strikes_above_half_hp":
			stats.hasTerminalStrikeDefend = true;
			break;
		case "passive_disable_all_crew_skills":
			break;
		case "passive_defender_chooses_crew_to_turn":
			stats.hasVoidArms = true;
			break;
		case "passive_team_cash_on_ally_collect":
			stats.hasSupplyDrop = true;
			stats.supplyDropCashAmount = effect.amount;
			break;
		case "passive_false_flag":
			stats.hasFalseFlag = true;
			break;
		case "passive_extra_reserve_crew":
			// draft-time only (see getReserveCrewSlotCount in game.ts); no
			// live/recomputed stat needed here
			break;
		case "passive_optional_discard_for_damage_per_turn":
			stats.hasVoidLegsChoice = true;
			stats.voidLegsDiscardCost = effect.discardCost;
			stats.voidLegsDamage = effect.damage;
			break;
		case "passive_background_check":
			stats.hasBackgroundCheck = true;
			break;
		case "passive_watcher_hide_on_challenge_win":
			stats.hasWatcherPassive = true;
			break;
		case "passive_cash_on_challenge_win":
			stats.cashOnChallengeWinAmount += effect.amount;
			break;
		case "passive_self_damage_and_cash_per_turn":
			stats.selfDamagePerTurn += effect.damage;
			stats.selfDamageCashGainAmount += effect.cashAmount;
			break;
		case "passive_cease_and_desist":
			stats.hasCeaseDesist = true;
			break;
		// no derived stat needed (event-triggered or interaction-driven)
		case "passive_mirror_enemy_collect_cash":
		case "passive_poison_per_round":
		case "passive_armor_on_ally_crew_turn":
		case "passive_armor_on_discard":
		case "passive_draw_on_hand_empty_once_per_turn":
		case "passive_optional_strike_on_successful_challenge":
		case "passive_suppress_enemy_turned_effects":
			break;
		// class overrides handled in recomputePassives above
		case "become_also_striker":
		case "become_also_hider":
		case "become_also_defender":
			break;
		case "passive_disable_all_enemy_crew_passives":
			break;
		case "passive_strike_on_self_turned_ally":
			break;
		case "passive_turn_self_down_on_enemy_crew_kill":
			break;
		case "passive_all_damage_is_piercing":
			stats.hasAllDamagePiercingPassive = true;
			break;
		case "passive_steal_cash_on_damage_dealt":
			stats.stealCashOnDamageDealtAmount += effect.amount;
			break;
		case "mark_enemy_crew_for_delayed_turn":
		case "discard_targeted_enemy_active_move":
		case "shuffle_discard_into_deck_then_draw":
		case "choose_red_herring_crew":
		case "gain_cash_and_draw_ally":
			break;
	}
}

// full rebuild of player.derived from boss + crew + active moves
// no manual resets, makeEmptyDerivedStats defines all defaults
export function recomputePassives(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): void {
	pruneStaleIncomingPoison(player, state);

	const next = makeEmptyDerivedStats();

	// resolve global crew skill disable first, before collecting other passives
	const crewSkillsDisabledNow = hasActiveCrewSkillsDisableSource(player, state);
	next.crewSkillsDisabled = crewSkillsDisabledNow;
	const crewPassivesSilencedByEnemy = hasActiveEnemySilencer(player, state);
	next.crewPassivesSilencedByEnemy = crewPassivesSilencedByEnemy;

	const passiveSources: readonly (readonly CardEffect[])[] = [
		...(player.bossId ? [getBoss(player.bossId).passiveEffects] : []),
		...player.crewIds.flatMap((crewId, i) => {
			const slot = i as 0 | 1;
			if (!crewId || !player.crewTurned[slot]) return [];
			if (crewSkillsDisabledNow) return [];
			if (crewPassivesSilencedByEnemy) return [];
			if (player.disabledPassiveSlots.has(slot)) return [];
			return [getCrew(crewId).passiveEffects];
		}),
		...player.activeMoves.flatMap((moveId) => {
			if (!moveId) return [];
			return [getMove(moveId).effects];
		}),
	];

	for (let i = 0; i < 2; i++) {
		const slot = i as 0 | 1;
		const crewId = player.crewIds[slot];
		if (!crewId || !player.crewTurned[slot]) continue;
		if (crewSkillsDisabledNow) continue;
		if (crewPassivesSilencedByEnemy) continue;
		if (player.disabledPassiveSlots.has(slot)) continue;
		for (const cardEffect of getCrew(crewId).passiveEffects) {
			const effect = isConditionalEffect(cardEffect)
				? cardEffect.effect
				: cardEffect;
			const grantedClass = ALSO_CLASS_GRANTS[effect.type];
			if (!grantedClass) continue;
			const existing = next.crewClassOverrides.get(slot) ?? new Set();
			existing.add(grantedClass);
			next.crewClassOverrides.set(slot, existing);
		}
	}

	for (const source of passiveSources) {
		for (const cardEffect of source) {
			if (isConditionalEffect(cardEffect)) {
				const ce = cardEffect;
				const passes = evaluateConditionForRecompute(
					ce.condition,
					player,
					state,
				);
				const shouldRun = ce.negated ? !passes : passes;
				if (!shouldRun) continue;
				recomputePassiveSwitch(ce.effect, next);
				continue;
			}
			const effect = cardEffect;
			// poison handled at round end via incomingPoison, no derived stat
			if (effect.type === "passive_poison_per_round") continue;
			recomputePassiveSwitch(effect, next);
		}
	}

	// life insurance: derived from other players' maps, not from own active moves
	const insuranceCandidates = [player, ...getTeammates(state, player.playerId)];
	next.hasLifeInsurance = insuranceCandidates.some((candidate) =>
		[...candidate.lifeInsuranceTargets.values()].includes(player.playerId),
	);

	player.derived = next;
}