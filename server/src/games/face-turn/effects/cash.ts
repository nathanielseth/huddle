import type {
	FaceturnServerState,
	FaceturnServerPlayer,
	PendingInteraction,
} from "../types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { EffectPrimitive } from "../cards";
import { pickRandom } from "../../lib/random";
import type { Handler } from "./shared";
import {
	getEnemies,
	getLivingPlayers,
	getTeammates,
	resolveTarget,
} from "./shared";
import { applyDamage } from "./damage";
import { drawCards } from "./draw-discard";

// shared by two steal paths; same logic as steal_cash
export function stealCashFromVictim(
	source: FaceturnServerPlayer,
	victimPlayerId: string,
	amount: number,
	state: FaceturnServerState,
): void {
	const victim = state.players.get(victimPlayerId);
	if (!victim || state.eliminatedPlayers.has(victimPlayerId)) return;
	const stolen = Math.min(amount, victim.cash);
	victim.cash -= stolen;
	source.cash += stolen;
}

export function applyCoolGuyDamageOnMovePlayed(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
): void {
	if (actor.derived.damageRandomEnemyOnMovePlayed <= 0) return;
	const enemies = getEnemies(state, actor.playerId);
	if (enemies.length === 0) return;
	const target = pickRandom(enemies, state.rng);
	applyDamage(
		state,
		target,
		actor.derived.damageRandomEnemyOnMovePlayed,
		actor,
	);
}

// one payout per supply drop holder on the team
export function applySupplyDropOnCollect(
	state: FaceturnServerState,
	collector: FaceturnServerPlayer,
): void {
	const teammates = getLivingPlayers(state).filter(
		(p) => p.teamIndex === collector.teamIndex,
	);
	const totalPayout = teammates
		.filter((p) => p.derived.hasSupplyDrop)
		.reduce((sum, p) => sum + p.derived.supplyDropCashAmount, 0);
	if (totalPayout <= 0) return;

	for (const member of teammates) {
		member.cash += totalPayout;
	}
}

export function applyTrickleDownOnCollect(
	state: FaceturnServerState,
	collector: FaceturnServerPlayer,
	amountGained: number,
): void {
	for (const watcher of getLivingPlayers(state)) {
		if (watcher.playerId === collector.playerId) continue;
		for (const targetId of watcher.trickleDownTargets.values()) {
			if (targetId === collector.playerId) {
				watcher.cash += amountGained;
			}
		}
	}
}

export const cashHandlers = {
	gain_cash(effect, ctx) {
		if (effect.type !== "gain_cash") return;
		ctx.actor.cash += effect.amount;
	},

	steal_cash(effect, ctx) {
		if (effect.type !== "steal_cash") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		const stolen = Math.min(effect.amount, target.cash);
		target.cash -= stolen;
		ctx.actor.cash += stolen;
	},

	steal_cash_choose_target(effect, ctx) {
		if (effect.type !== "steal_cash_choose_target") return;

		if (ctx.targetPlayerId) {
			stealCashFromVictim(
				ctx.actor,
				ctx.targetPlayerId,
				effect.amount,
				ctx.state,
			);
			return;
		}

		const enemies = getEnemies(ctx.state, ctx.actor.playerId);
		if (enemies.length === 0) return;

		if (enemies.length === 1) {
			stealCashFromVictim(
				ctx.actor,
				enemies[0]!.playerId,
				effect.amount,
				ctx.state,
			);
			return;
		}

		ctx.state.pendingInteraction = {
			type: "bear_bones_steal_pick",
			actorId: ctx.actor.playerId,
			eligibleTargetIds: enemies.map((e) => e.playerId),
			amount: effect.amount,
		} satisfies PendingInteraction;
	},

	steal_random_card(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target || target.hand.length === 0) return;
		if (ctx.actor.hand.length >= C.HAND_LIMIT) return;
		const taken = pickRandom(target.hand, ctx.state.rng);
		target.hand.splice(target.hand.indexOf(taken), 1);
		target.costOverrides.delete(taken);
		ctx.actor.hand.push(taken);
	},

	redistribute_cash_to_poorest(effect, ctx) {
		if (effect.type !== "redistribute_cash_to_poorest") return;
		const team = [ctx.actor, ...getTeammates(ctx.state, ctx.actor.playerId)];

		let lowestCash = Infinity;
		let poorest: FaceturnServerPlayer[] = [];
		for (const member of team) {
			if (member.cash < lowestCash) {
				lowestCash = member.cash;
				poorest = [member];
			} else if (member.cash === lowestCash) {
				poorest.push(member);
			}
		}

		const recipient =
			poorest.length === 1 ? poorest[0]! : pickRandom(poorest, ctx.state.rng);
		recipient.cash += effect.cashAmount;
		drawCards(recipient, effect.drawAmount);
	},

	set_both_cash_zero_then_draw(effect, ctx) {
		if (effect.type !== "set_both_cash_zero_then_draw") return;
		ctx.actor.cash = 0;
		const target = resolveTarget(ctx);
		if (target) target.cash = 0;
		drawCards(ctx.actor, effect.drawAmount);
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;