import type { EffectPrimitive } from "../cards";
import type { Handler } from "./shared";
import { getTeammates, resolveAllyTarget, resolveTarget } from "./shared";
import { clampHp } from "./damage";
import { drawCards } from "./draw-discard";

export const bossHpArmorHandlers = {
	heal_boss(effect, ctx) {
		if (effect.type !== "heal_boss") return;
		const target = resolveAllyTarget(ctx);
		target.bossHp = clampHp(target.bossHp + effect.amount, target.bossMaxHp);
	},

	armor_boss(effect, ctx) {
		if (effect.type !== "armor_boss") return;
		const target = resolveAllyTarget(ctx);
		target.bossArmor += effect.amount;
		target.hasArmoredBossThisGame = true;
	},

	armor_all_ally_bosses(effect, ctx) {
		if (effect.type !== "armor_all_ally_bosses") return;
		const allies = [ctx.actor, ...getTeammates(ctx.state, ctx.actor.playerId)];
		for (const ally of allies) {
			ally.bossArmor += effect.amount;
			ally.hasArmoredBossThisGame = true;
		}
	},

	remove_all_armor(effect, ctx) {
		if (effect.type !== "remove_all_armor") return;
		if (effect.target === "enemy_boss") {
			const target = resolveTarget(ctx);
			if (!target) return;
			target.bossArmor = 0;
		} else {
			ctx.actor.bossArmor = 0;
		}
	},

	immunity_until_next_turn(effect, ctx) {
		if (effect.type !== "immunity_until_next_turn") return;
		const turns = effect.turns ?? 1;
		ctx.actor.bossImmunityTurns = Math.max(ctx.actor.bossImmunityTurns, turns);
	},

	set_ally_boss_hp_gain_cash_draw(effect, ctx) {
		if (effect.type !== "set_ally_boss_hp_gain_cash_draw") return;
		const hpTarget = resolveAllyTarget(ctx);
		hpTarget.bossHp = effect.hpAmount;
		ctx.actor.cash += effect.cashGain;
		drawCards(ctx.actor, effect.drawAmount);
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;