import type { EffectPrimitive } from "../cards";
import { recomputePassives } from "../derived";
import type { Handler } from "./shared";
import { getLivingPlayers, getTeammates, resolveTarget } from "./shared";
import {
	turnCrewAtSlot,
	unturnCrewAtSlot,
	firstUnturnedSlot,
	firstTurnedSlot,
	triggerCrewTurnedEffects,
} from "./strikes";
import type { PendingInteraction } from "../interactions/types";

export const crewTurnHandlers = {
	turn_enemy_crew(effect, ctx) {
		if (effect.type !== "turn_enemy_crew") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		const slot =
			effect.targetSlot !== undefined
				? (effect.targetSlot as 0 | 1)
				: firstUnturnedSlot(target);
		if (slot === null) return;
		turnCrewAtSlot(ctx.state, target, slot);
		recomputePassives(target, ctx.state);
		triggerCrewTurnedEffects(ctx.state, target, slot);
	},

	turn_ally_crew(effect, ctx) {
		if (effect.type !== "turn_ally_crew") return true;
		const slot =
			effect.targetSlot !== undefined
				? (effect.targetSlot as 0 | 1)
				: firstUnturnedSlot(ctx.actor);
		if (slot === null) return false;
		turnCrewAtSlot(ctx.state, ctx.actor, slot);
		recomputePassives(ctx.actor, ctx.state);
		triggerCrewTurnedEffects(ctx.state, ctx.actor, slot);
		return true;
	},

	turn_all_other_ally_crew(_effect, ctx) {
		const actor = ctx.actor;
		const triggeringSlot = ctx.targetAllySlot;
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (slot === triggeringSlot) continue;
			if (!actor.crewIds[slot]) continue;
			if (actor.crewTurned[slot]) continue;
			turnCrewAtSlot(ctx.state, actor, slot);
			recomputePassives(actor, ctx.state);
			triggerCrewTurnedEffects(ctx.state, actor, slot);
		}
	},

	unturn_ally_crew(effect, ctx) {
		if (effect.type !== "unturn_ally_crew") return;
		const slot =
			effect.targetSlot !== undefined
				? (effect.targetSlot as 0 | 1)
				: firstTurnedSlot(ctx.actor);
		if (slot === null) return;
		unturnCrewAtSlot(ctx.state, ctx.actor, slot);
		recomputePassives(ctx.actor, ctx.state);
	},

	unturn_other_ally_crew(_effect, ctx) {
		const triggeringSlot = ctx.targetAllySlot;
		if (triggeringSlot === undefined) return;
		const otherSlot = (1 - triggeringSlot) as 0 | 1;
		if (!ctx.actor.crewIds[otherSlot]) return;
		if (!ctx.actor.crewTurned[otherSlot]) return;
		unturnCrewAtSlot(ctx.state, ctx.actor, otherSlot);
		recomputePassives(ctx.actor, ctx.state);
	},

	unturn_then_retrigger_ally(_effect, ctx) {
		const slot =
			ctx.targetAllySlot !== undefined
				? (ctx.targetAllySlot as 0 | 1)
				: firstTurnedSlot(ctx.actor);
		if (slot === null) return;
		unturnCrewAtSlot(ctx.state, ctx.actor, slot);
		recomputePassives(ctx.actor, ctx.state);
		turnCrewAtSlot(ctx.state, ctx.actor, slot);
		recomputePassives(ctx.actor, ctx.state);
		triggerCrewTurnedEffects(ctx.state, ctx.actor, slot);
	},

	unturn_one_turn_different_ally(_effect, ctx) {
		const actor = ctx.actor;
		const faceUpSlots: number[] = [];
		const faceDownSlots: number[] = [];
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (!actor.crewIds[slot]) continue;
			if (actor.crewTurned[slot]) faceUpSlots.push(slot);
			else faceDownSlots.push(slot);
		}
		if (faceUpSlots.length === 0 || faceDownSlots.length === 0) return;
		ctx.state.pendingInteraction = {
			type: "switch_up_pick",
			actorId: actor.playerId,
			faceUpSlots,
			faceDownSlots,
		} satisfies PendingInteraction;
	},

	// only runs when the negated 'another_ally_is_turned' condition is true
	unturn_self(_effect, ctx) {
		const slot = ctx.targetAllySlot;
		if (slot === undefined) return;
		unturnCrewAtSlot(ctx.state, ctx.actor, slot as 0 | 1);
		recomputePassives(ctx.actor, ctx.state);
	},

	swap_crew_with_teammate(_effect, ctx) {
		const teammates = getTeammates(ctx.state, ctx.actor.playerId);
		if (teammates.length === 0) return;
		const teammate =
			(ctx.targetPlayerId
				? teammates.find((t) => t.playerId === ctx.targetPlayerId)
				: undefined) ?? teammates[0]!;
		const ownEligibleSlots = ([0, 1] as const).filter(
			(i) => ctx.actor.crewIds[i] !== null,
		);
		const teammateEligibleSlots = ([0, 1] as const).filter(
			(i) => teammate.crewIds[i] !== null,
		);
		if (ownEligibleSlots.length === 0 || teammateEligibleSlots.length === 0)
			return;
		ctx.state.pendingInteraction = {
			type: "tag_out_pick",
			actorId: ctx.actor.playerId,
			teammateId: teammate.playerId,
			ownEligibleSlots,
			teammateEligibleSlots,
		} satisfies PendingInteraction;
	},

	// too big: swap with any other living player's face-up crew (ally or enemy)
	swap_with_any_face_up_crew(_effect, ctx) {
		const ownSlot = ctx.targetAllySlot;
		if (ownSlot === undefined) return;
		const actor = ctx.actor;
		const eligibleTargets: { playerId: string; slot: 0 | 1 }[] = [];
		for (const p of getLivingPlayers(ctx.state)) {
			for (const i of [0, 1] as const) {
				if (p.playerId === actor.playerId && i === ownSlot) continue;
				if (p.crewIds[i] !== null && p.crewTurned[i]) {
					eligibleTargets.push({ playerId: p.playerId, slot: i });
				}
			}
		}
		if (eligibleTargets.length === 0) return;
		ctx.state.pendingInteraction = {
			type: "too_big_swap_pick",
			actorId: actor.playerId,
			ownSlot: ownSlot as 0 | 1,
			eligibleTargets,
		} satisfies PendingInteraction;
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;