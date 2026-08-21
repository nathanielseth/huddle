import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type { EffectPrimitive } from "../cards";
import { CARD_IDS } from "../cards";
import { recomputePassives } from "../derived";
import type { Handler } from "./shared";
import { getEnemies, resolveTarget } from "./shared";
import type { PendingInteraction } from "../interactions/types";

export function clampHp(hp: number, max: number): number {
	return Math.max(0, Math.min(max, Math.round(hp)));
}

// life insurance: prevents lethal damage once, sets hp to 1, then discards itself
// exported: also used by resolveStrikeOrExecute's execute branch in strikes.ts
export function consumeLifeInsuranceProtecting(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
): void {
	for (const caster of state.players.values()) {
		for (const [slot, protectedPlayerId] of caster.lifeInsuranceTargets) {
			if (protectedPlayerId !== target.playerId) continue;

			caster.lifeInsuranceTargets.delete(slot);
			if (caster.activeMoves[slot] === CARD_IDS.MOVE.LIFE_INSURANCE) {
				caster.activeMoves[slot] = null;
				caster.discardPile.push(CARD_IDS.MOVE.LIFE_INSURANCE);
				caster.totalCardsDiscarded++;
			}
			recomputePassives(caster, state);
			if (caster.playerId !== target.playerId) {
				recomputePassives(target, state);
			}
			return;
		}
	}
	recomputePassives(target, state);
}

// bastion cash on damage taken passive: fires on every instance of damage taken, not silenced (boss passives always apply)
function maybeTriggerBastionCashBonus(target: FaceturnServerPlayer): void {
	if (!target.derived.hasBastionPassive) return;
	target.cash += 1;
}

// monkey man: steals cash from the boss he just damaged, once per damage instance, capped by their available cash
function maybeTriggerMonkeyManCashSteal(
	target: FaceturnServerPlayer,
	sourceActor: FaceturnServerPlayer,
	dmgDealt: number,
): void {
	if (dmgDealt <= 0) return;
	if (sourceActor.derived.stealCashOnDamageDealtAmount <= 0) return;
	if (sourceActor.playerId === target.playerId) return;
	const stolen = Math.min(
		sourceActor.derived.stealCashOnDamageDealtAmount,
		target.cash,
	);
	if (stolen <= 0) return;
	target.cash -= stolen;
	sourceActor.cash += stolen;
}

// shared tail once dmg is resolved: applies life insurance, hp clamp, and on-damage triggers
function applyResolvedDamageToBoss(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	dmg: number,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
): number {
	if (dmg <= 0) return 0;

	if (target.derived.hasLifeInsurance && target.bossHp - dmg <= 0) {
		target.bossHp = 1;
		consumeLifeInsuranceProtecting(state, target);
		maybeTriggerBastionCashBonus(target);
		maybeTriggerMonkeyManCashSteal(target, sourceActor, dmg);
		return rawAmount;
	}

	if (target.bossHp - dmg <= 0) {
		target.lastHpZeroCause = "damage";
	}
	target.bossHp = clampHp(target.bossHp - dmg, target.bossMaxHp);
	maybeTriggerBastionCashBonus(target);
	maybeTriggerMonkeyManCashSteal(target, sourceActor, dmg);
	return dmg;
}

// damage pipeline: flat bonus, reduction%, immunity, armor, life insurance
// undefendable skips armor/immunity/reduction; cannotBeMultiplied skips actor's flat bonus
export function applyDamage(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
	undefendable = false,
	cannotBeMultiplied = false,
): number {
	let dmg =
		undefendable || cannotBeMultiplied
			? rawAmount
			: rawAmount + sourceActor.derived.damageBonusFlat;

	// pektus: all damage from this source bypasses armor, same as undefendable's armor step
	const skipsArmor = undefendable || sourceActor.derived.hasAllDamagePiercingPassive;

	if (!undefendable) {
		if (target.derived.damageReductionPercent > 0) {
			dmg = Math.floor(dmg * (1 - target.derived.damageReductionPercent / 100));
		}
		if (target.bossImmunityTurns > 0) {
			return 0;
		}
		if (!skipsArmor && target.bossArmor > 0) {
			const absorbed = Math.min(target.bossArmor, dmg);
			target.bossArmor -= absorbed;
			dmg -= absorbed;
		}
	}

	return applyResolvedDamageToBoss(state, target, dmg, rawAmount, sourceActor);
}

// piercing damage: bypasses armor, still respects immunity and reduction%
function applyDamageIgnoreArmor(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
): number {
	let dmg = rawAmount + sourceActor.derived.damageBonusFlat;

	if (target.bossImmunityTurns > 0) return 0;
	if (target.derived.damageReductionPercent > 0) {
		dmg = Math.floor(dmg * (1 - target.derived.damageReductionPercent / 100));
	}

	return applyResolvedDamageToBoss(state, target, dmg, rawAmount, sourceActor);
}

export function applyPoisonToVictim(
	state: FaceturnServerState,
	source: FaceturnServerPlayer,
	victimPlayerId: string,
	damage: number,
): void {
	const victim = state.players.get(victimPlayerId);
	if (!victim || state.eliminatedPlayers.has(victimPlayerId)) return;
	const existing = victim.incomingPoison.get(source.playerId) ?? 0;
	victim.incomingPoison.set(source.playerId, existing + damage);
}

export const damageHandlers = {
	deal_damage(effect, ctx) {
		if (effect.type !== "deal_damage") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		applyDamage(
			ctx.state,
			target,
			effect.amount,
			ctx.actor,
			effect.undefendable,
			effect.cannotBeMultiplied,
		);
	},

	deal_damage_all_enemy_bosses(effect, ctx) {
		if (effect.type !== "deal_damage_all_enemy_bosses") return;
		for (const enemy of getEnemies(ctx.state, ctx.actor.playerId)) {
			applyDamage(ctx.state, enemy, effect.amount, ctx.actor);
		}
	},

	deal_damage_per_face_up_ally(effect, ctx) {
		if (effect.type !== "deal_damage_per_face_up_ally") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		const actor = ctx.actor;
		const allyCount = actor.crewIds.filter(
			(id, i) => id && actor.crewTurned[i as 0 | 1],
		).length;
		applyDamage(ctx.state, target, effect.amountPerAlly * allyCount, actor);
	},

	deal_damage_percent_current_hp(effect, ctx) {
		if (effect.type !== "deal_damage_percent_current_hp") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		const dmg = Math.floor(target.bossHp * (effect.percent / 100));
		applyDamage(
			ctx.state,
			target,
			dmg,
			ctx.actor,
			false,
			effect.cannotBeMultiplied,
		);
	},

	deal_damage_ignore_armor(effect, ctx) {
		if (effect.type !== "deal_damage_ignore_armor") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		applyDamageIgnoreArmor(ctx.state, target, effect.amount, ctx.actor);
	},

	deal_damage_per_discarded_variable(effect, ctx) {
		if (effect.type !== "deal_damage_per_discarded_variable") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		ctx.state.pendingInteraction = {
			type: "choose_discard_count",
			actorId: ctx.actor.playerId,
			maxCount: ctx.actor.hand.length,
			targetPlayerId: target.playerId,
			damagePerCard: effect.damagePerCard,
		} satisfies PendingInteraction;
	},

	deal_damage_per_enemy_hand_discarded(effect, ctx) {
		if (effect.type !== "deal_damage_per_enemy_hand_discarded") return;
		const count = ctx.state.lastEnemyHandDiscardCount ?? 0;
		ctx.state.lastEnemyHandDiscardCount = undefined;
		if (count <= 0) return;
		const target = resolveTarget(ctx);
		if (!target) return;
		applyDamage(ctx.state, target, count * effect.damagePerCard, ctx.actor);
	},

	deal_damage_self_boss(effect, ctx) {
		if (effect.type !== "deal_damage_self_boss") return;
		applyDamage(ctx.state, ctx.actor, effect.amount, ctx.actor);
	},

	// bastion command: damage equal to armor total, then empty armor regardless
	command_deal_damage_equal_to_armor(effect, ctx) {
		if (effect.type !== "command_deal_damage_equal_to_armor") return;
		const target = resolveTarget(ctx);
		const totalArmor = ctx.actor.bossArmor;
		ctx.actor.bossArmor = 0;
		if (!target || totalArmor <= 0) return;
		applyDamage(ctx.state, target, totalArmor, ctx.actor, false, false);
	},

	// poison stacks per-source in incomingPoison, ticked in triggerRoundEndPassives
	passive_poison_per_round(effect, ctx) {
		if (effect.type !== "passive_poison_per_round") return;

		if (ctx.targetPlayerId) {
			applyPoisonToVictim(
				ctx.state,
				ctx.actor,
				ctx.targetPlayerId,
				effect.damagePerRound,
			);
			return;
		}

		const enemies = getEnemies(ctx.state, ctx.actor.playerId);
		if (enemies.length === 0) return;

		if (enemies.length === 1) {
			applyPoisonToVictim(
				ctx.state,
				ctx.actor,
				enemies[0]!.playerId,
				effect.damagePerRound,
			);
			return;
		}

		ctx.state.pendingInteraction = {
			type: "poison_target_pick",
			actorId: ctx.actor.playerId,
			eligibleTargetIds: enemies.map((e) => e.playerId),
			damagePerRound: effect.damagePerRound,
		} satisfies PendingInteraction;
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;