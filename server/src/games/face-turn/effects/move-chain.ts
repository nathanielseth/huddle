import type { FaceturnServerState } from "../types";
import type { EffectPrimitive } from "../cards";
import { getMove } from "../cards";
import type { Handler } from "./index";
import { isConditionalEffect } from "./index";
import { applyDamage } from "./damage";

export const moveChainHandlers = {
	// handled in index.ts move-chain-window resolution; marker only
	negate_enemy_slow_move() {},
	reflect_slow_move_base_damage() {},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;

// reversal: reflects first deal_damage from a slow move back to caster, through caster's defenses, skipping damage bonus
export function resolveReflectedSlowMoveDamage(
	state: FaceturnServerState,
	reflectedMoveId: string,
	reflectedCasterId: string,
): boolean {
	const caster = state.players.get(reflectedCasterId);
	if (!caster || state.eliminatedPlayers.has(reflectedCasterId)) return false;

	const move = getMove(reflectedMoveId);
	const damageEntry = move.effects.find((e) => {
		const eff = isConditionalEffect(e) ? e.effect : e;
		return eff.type === "deal_damage";
	});
	if (!damageEntry) return false;

	const eff = isConditionalEffect(damageEntry)
		? damageEntry.effect
		: damageEntry;
	if (eff.type !== "deal_damage") return false;

	applyDamage(state, caster, eff.amount, caster, false, true);
	return true;
}