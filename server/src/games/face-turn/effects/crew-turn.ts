import type { EffectPrimitive } from "../cards";
import { recomputePassives } from "../derived";
import type { Handler } from "./shared";
import {
	getEnemies,
	getLivingPlayers,
	getTeammates,
	resolveTarget,
} from "./shared";
import {
	turnCrewAtSlot,
	hideCrewAtSlot,
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
		turnCrewAtSlot(ctx.state, target, slot, ctx.actor.playerId, {
			reason: "move",
			moveId: ctx.moveId!,
		});
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
		turnCrewAtSlot(ctx.state, ctx.actor, slot, null, {
			reason: "move",
			moveId: ctx.moveId!,
		});
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
			turnCrewAtSlot(ctx.state, actor, slot, null, {
				reason: "move",
				moveId: ctx.moveId!,
			});
			recomputePassives(actor, ctx.state);
			triggerCrewTurnedEffects(ctx.state, actor, slot);
		}
	},

	hide_ally_crew(effect, ctx) {
		if (effect.type !== "hide_ally_crew") return;
		const slot =
			effect.targetSlot !== undefined
				? (effect.targetSlot as 0 | 1)
				: firstTurnedSlot(ctx.actor);
		if (slot === null) return;
		hideCrewAtSlot(ctx.state, ctx.actor, slot, false, {
			reason: "move",
			moveId: ctx.moveId!,
		});
		recomputePassives(ctx.actor, ctx.state);
	},

	hide_other_ally_crew(_effect, ctx) {
		const triggeringSlot = ctx.targetAllySlot;
		if (triggeringSlot === undefined) return;
		const otherSlot = (1 - triggeringSlot) as 0 | 1;
		if (!ctx.actor.crewIds[otherSlot]) return;
		if (!ctx.actor.crewTurned[otherSlot]) return;
		// crew turnedEffect reaction (miss-direction), never a move
		hideCrewAtSlot(ctx.state, ctx.actor, otherSlot, false, {
			reason: "crew_passive",
			crewId: ctx.actor.crewIds[triggeringSlot]!,
		});
		recomputePassives(ctx.actor, ctx.state);
	},

	hide_then_retrigger_ally(_effect, ctx) {
		const slot =
			ctx.targetAllySlot !== undefined
				? (ctx.targetAllySlot as 0 | 1)
				: firstTurnedSlot(ctx.actor);
		if (slot === null) return;
		const via = { reason: "move" as const, moveId: ctx.moveId! };
		hideCrewAtSlot(ctx.state, ctx.actor, slot, false, via);
		recomputePassives(ctx.actor, ctx.state);
		turnCrewAtSlot(ctx.state, ctx.actor, slot, null, via);
		recomputePassives(ctx.actor, ctx.state);
		triggerCrewTurnedEffects(ctx.state, ctx.actor, slot);
	},

	hide_one_turn_different_ally(_effect, ctx) {
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

	// only fires for the negated 'another_ally_is_turned' condition
	hide_self(_effect, ctx) {
		const slot = ctx.targetAllySlot;
		if (slot === undefined) return;
		const crewId = ctx.actor.crewIds[slot as 0 | 1];
		if (!crewId) return;
		hideCrewAtSlot(ctx.state, ctx.actor, slot as 0 | 1, false, {
			reason: "crew_passive",
			crewId,
		});
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

	// fizzles if no enemy has a revealed active move
	copy_enemy_active_move(_effect, ctx) {
		const actor = ctx.actor;
		const eligibleTargets: {
			playerId: string;
			slot: 0 | 1 | 2;
			moveId: string;
		}[] = [];
		for (const enemy of getEnemies(ctx.state, actor.playerId)) {
			for (let i = 0; i < enemy.activeMoves.length; i++) {
				const moveId = enemy.activeMoves[i];
				if (moveId) {
					eligibleTargets.push({
						playerId: enemy.playerId,
						slot: i as 0 | 1 | 2,
						moveId,
					});
				}
			}
		}
		if (eligibleTargets.length === 0) return;
		ctx.state.pendingInteraction = {
			type: "belladonna_copy_pick",
			actorId: actor.playerId,
			eligibleTargets,
		} satisfies PendingInteraction;
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;