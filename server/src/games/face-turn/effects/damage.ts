import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type { EffectPrimitive } from "../cards";
import { CARD_IDS } from "../cards";
import { recomputePassives } from "../derived";
import type { EffectContext, Handler } from "./shared";
import { getEnemies, resolveTarget } from "./shared";
import { pushLog } from "../log";

// accumulates damage for chain resolution steps when an accumulator exists
function accumulate(ctx: EffectContext, dmgDealt: number): void {
	if (ctx.damageAccumulator) {
		ctx.damageAccumulator.value += dmgDealt;
	}
}
import type { PendingInteraction } from "../interactions/types";

export function clampHp(hp: number, max: number): number {
	return Math.max(0, Math.min(max, Math.round(hp)));
}

// consumes life insurance, sets hp to 1, also used by strikes.ts execute branch
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

// bastion passive fires on every damage instance, boss passives aren't silenced
function maybeTriggerBastionCashBonus(target: FaceturnServerPlayer): void {
	if (!target.derived.hasBastionPassive) return;
	target.cash += 1;
}

// monkey man steals cash once per damage instance, capped by available cash
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

// applies life insurance, hp clamp, and on-damage triggers after damage resolved
function applyResolvedDamageToBoss(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	dmg: number,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
	moveId?: string,
): number {
	if (dmg <= 0) return 0;

	pushLog(state, {
		kind: "damage_dealt",
		sourceActorId: sourceActor.playerId,
		targetPlayerId: target.playerId,
		amount: dmg,
		...(moveId ? { moveId } : {}),
	});

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
// undefendable skips armor/immunity/reduction; cannotBeMultiplied skips flat bonus
export function applyDamage(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
	undefendable = false,
	cannotBeMultiplied = false,
	moveId?: string,
): number {
	let dmg =
		undefendable || cannotBeMultiplied
			? rawAmount
			: rawAmount + sourceActor.derived.damageBonusFlat;

	// pektus passive makes all damage bypass armor
	const skipsArmor =
		undefendable || sourceActor.derived.hasAllDamagePiercingPassive;

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

	return applyResolvedDamageToBoss(
		state,
		target,
		dmg,
		rawAmount,
		sourceActor,
		moveId,
	);
}

// bypasses armor but respects immunity and reduction%
function applyDamageIgnoreArmor(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
	moveId?: string,
): number {
	let dmg = rawAmount + sourceActor.derived.damageBonusFlat;

	if (target.bossImmunityTurns > 0) return 0;
	if (target.derived.damageReductionPercent > 0) {
		dmg = Math.floor(dmg * (1 - target.derived.damageReductionPercent / 100));
	}

	return applyResolvedDamageToBoss(
		state,
		target,
		dmg,
		rawAmount,
		sourceActor,
		moveId,
	);
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
		accumulate(
			ctx,
			applyDamage(
				ctx.state,
				target,
				effect.amount,
				ctx.actor,
				effect.undefendable,
				effect.cannotBeMultiplied,
				ctx.moveId,
			),
		);
	},

	deal_damage_all_enemy_bosses(effect, ctx) {
		if (effect.type !== "deal_damage_all_enemy_bosses") return;
		for (const enemy of getEnemies(ctx.state, ctx.actor.playerId)) {
			accumulate(
				ctx,
				applyDamage(
					ctx.state,
					enemy,
					effect.amount,
					ctx.actor,
					false,
					false,
					ctx.moveId,
				),
			);
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
		accumulate(
			ctx,
			applyDamage(
				ctx.state,
				target,
				effect.amountPerAlly * allyCount,
				actor,
				false,
				false,
				ctx.moveId,
			),
		);
	},

	deal_damage_percent_current_hp(effect, ctx) {
		if (effect.type !== "deal_damage_percent_current_hp") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		const dmg = Math.floor(target.bossHp * (effect.percent / 100));
		accumulate(
			ctx,
			applyDamage(
				ctx.state,
				target,
				dmg,
				ctx.actor,
				false,
				effect.cannotBeMultiplied,
				ctx.moveId,
			),
		);
	},

	deal_damage_ignore_armor(effect, ctx) {
		if (effect.type !== "deal_damage_ignore_armor") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		accumulate(
			ctx,
			applyDamageIgnoreArmor(
				ctx.state,
				target,
				effect.amount,
				ctx.actor,
				ctx.moveId,
			),
		);
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
		accumulate(
			ctx,
			applyDamage(
				ctx.state,
				target,
				count * effect.damagePerCard,
				ctx.actor,
				false,
				false,
				ctx.moveId,
			),
		);
	},

	deal_damage_self_boss(effect, ctx) {
		if (effect.type !== "deal_damage_self_boss") return;
		accumulate(
			ctx,
			applyDamage(
				ctx.state,
				ctx.actor,
				effect.amount,
				ctx.actor,
				false,
				false,
				ctx.moveId,
			),
		);
	},

	// bastion command empties armor then deals that amount
	command_deal_damage_equal_to_armor(effect, ctx) {
		if (effect.type !== "command_deal_damage_equal_to_armor") return;
		const target = resolveTarget(ctx);
		const totalArmor = ctx.actor.bossArmor;
		ctx.actor.bossArmor = 0;
		if (!target || totalArmor <= 0) return;
		accumulate(
			ctx,
			applyDamage(
				ctx.state,
				target,
				totalArmor,
				ctx.actor,
				false,
				false,
				ctx.moveId,
			),
		);
	},

	// poison stacks per-source, ticked at round end
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