import type { FaceturnServerState } from "../types";
import type { EffectPrimitive } from "../cards";
import { getMove } from "../cards";
import type { Handler } from "./shared";
import { isConditionalEffect } from "./shared";
import { applyDamage } from "./damage";

export const moveChainHandlers = {
	// handled in index.ts move-chain-window resolution; marker only
	negate_enemy_slow_move() {},
	reflect_slow_move_base_damage() {},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;

// reversal: reflects first deal_damage from a slow move back to caster, through caster's defenses, skipping damage bonus.
// returns the actual damage dealt (applyDamage's post-armor/reduction
// return value), or null if there was nothing to reflect (caster gone,
// or the reflected move has no deal_damage effect).
export function resolveReflectedSlowMoveDamage(
	state: FaceturnServerState,
	reflectedMoveId: string,
	reflectedCasterId: string,
): number | null {
	const caster = state.players.get(reflectedCasterId);
	if (!caster || state.eliminatedPlayers.has(reflectedCasterId)) return null;

	const move = getMove(reflectedMoveId);
	const damageEntry = move.effects.find((e) => {
		const eff = isConditionalEffect(e) ? e.effect : e;
		return eff.type === "deal_damage";
	});
	if (!damageEntry) return null;

	const eff = isConditionalEffect(damageEntry)
		? damageEntry.effect
		: damageEntry;
	if (eff.type !== "deal_damage") return null;

	return applyDamage(state, caster, eff.amount, caster, false, true);
}