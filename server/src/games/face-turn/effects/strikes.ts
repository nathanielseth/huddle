import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type { EffectPrimitive } from "../cards";
import type { CrewTurnCause } from "../../../../../shared/games/face-turn/log";
import { CARD_IDS, getCrew } from "../cards";
import { recomputePassives } from "../derived";
import type { EffectContext, Handler } from "./shared";
import {
	getEnemies,
	getLivingPlayers,
	getTeammates,
	resolveTarget,
	findEffectAmount,
} from "./shared";
import { resolveEffects } from "./index";
import {
	consumeLifeInsuranceProtecting,
	maybeTriggerBloodMoneyOnTeamDamage,
	maybeTriggerRazorStabGrant,
} from "./damage";
import { pushLog } from "../log";

function discardRedHerringMove(
	state: FaceturnServerState,
	owner: FaceturnServerPlayer,
): void {
	const ownSlot = owner.activeMoves.indexOf(CARD_IDS.MOVE.RED_HERRING);
	if (ownSlot === -1) return;
	owner.activeMoves[ownSlot] = null;
	owner.discardPile.push(CARD_IDS.MOVE.RED_HERRING);
	owner.totalCardsDiscarded++;
	recomputePassives(owner, state);
}

// refill treated as invalidation, not match
function invalidateStaleCrewMarks(
	state: FaceturnServerState,
	owner: FaceturnServerPlayer,
	slot: 0 | 1,
	previousCrewId: string,
): void {
	for (const enemy of getEnemies(state, owner.playerId)) {
		for (const [ownSlot, mark] of enemy.warrantMarks) {
			if (
				mark.targetPlayerId !== owner.playerId ||
				mark.targetSlot !== slot ||
				mark.targetCrewId !== previousCrewId
			) {
				continue;
			}
			enemy.warrantMarks.delete(ownSlot);
			if (enemy.activeMoves[ownSlot] === CARD_IDS.MOVE.WARRANT_OF_ARREST) {
				enemy.activeMoves[ownSlot] = null;
				enemy.discardPile.push(CARD_IDS.MOVE.WARRANT_OF_ARREST);
				enemy.totalCardsDiscarded++;
				recomputePassives(enemy, state);
			}
			break;
		}
	}

	const rh = owner.redHerringMark;
	if (rh && rh.slot === slot && rh.crewId === previousCrewId) {
		owner.redHerringMark = null;
		discardRedHerringMove(state, owner);
	}
}

export function turnCrewAtSlot(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	slot: 0 | 1,
	causedByActorId: string | null,
	via: CrewTurnCause,
): void {
	const crewId = player.crewIds[slot];
	if (!crewId) return;
	player.crewTurned[slot] = true;
	player.hasTurnedAllyCrewThisGame = true;
	invalidateStaleCrewMarks(state, player, slot, crewId);
	pushLog(state, {
		kind: "crew_turned",
		playerId: player.playerId,
		slot,
		crewId,
		causedByActorId,
		via,
	});
}

export function hideCrewAtSlot(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	slot: 0 | 1,
	causedByEnemy: boolean,
	via: CrewTurnCause,
): void {
	const crewId = player.crewIds[slot];
	if (!crewId) return;
	player.crewTurned[slot] = false;
	player.disabledPassiveSlots.delete(slot);
	pushLog(state, {
		kind: "crew_hidden",
		playerId: player.playerId,
		slot,
		crewId,
		causedByEnemy,
		via,
	});
	triggerAllyTurnReactions(state, player, causedByEnemy);
}

// refills from reserve if available
function killCrewAtSlot(
	state: FaceturnServerState,
	owner: FaceturnServerPlayer,
	slot: 0 | 1,
): { refilledFromReserve: boolean } {
	const killedCrewId = owner.crewIds[slot]!;
	owner.crewIds[slot] = null;
	owner.crewTurned[slot] = false;

	let refilledFromReserve = false;
	const reserveIdx = owner.reserveCrewIds.findIndex((id) => id !== null);
	if (reserveIdx !== -1) {
		const reserveCrewId = owner.reserveCrewIds[reserveIdx]!;
		owner.crewIds[slot] = reserveCrewId;
		owner.crewTurned[slot] = false;
		owner.reserveCrewIds[reserveIdx] = null;
		refilledFromReserve = true;
	}

	invalidateStaleCrewMarks(state, owner, slot, killedCrewId);
	recomputePassives(owner, state);
	return { refilledFromReserve };
}

export function firstUnturnedSlot(player: FaceturnServerPlayer): 0 | 1 | null {
	for (let i = 0; i < 2; i++) {
		const idx = i as 0 | 1;
		if (player.crewIds[idx] && !player.crewTurned[idx]) return idx;
	}
	return null;
}

export function firstTurnedSlot(player: FaceturnServerPlayer): 0 | 1 | null {
	for (let i = 0; i < 2; i++) {
		const idx = i as 0 | 1;
		if (player.crewIds[idx] && player.crewTurned[idx]) return idx;
	}
	return null;
}

export function isPlayerExposed(player: FaceturnServerPlayer): boolean {
	return firstUnturnedSlot(player) === null;
}

export type StrikeOrExecuteOutcome =
	| { outcome: "crew_turned"; slot: 0 | 1 }
	| { outcome: "crew_killed"; slot: 0 | 1; refilledFromReserve: boolean }
	| { outcome: "pending" }
	| { outcome: "executed"; survivedViaLifeInsurance: boolean }
	| { outcome: "negated"; negatedBy: "terminal" | "immunity" };

// keeps resolution and declare-time logic consistent
export function isStrikeDefendedByTerminal(
	target: FaceturnServerPlayer,
): boolean {
	return target.derived.hasTerminalStrikeDefend && target.bossHp > 60;
}

// void arms lets defender choose which crew to turn
export function resolveStrikeOrExecute(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	actorId: string | null,
	via: CrewTurnCause,
	preSelectedSlot?: 0 | 1,
): StrikeOrExecuteOutcome {
	// face_turn and challenge_loss turn crew but never escalate to a kill
	const isStrike = via.reason === "strike";
	if (isStrikeDefendedByTerminal(target)) {
		return { outcome: "negated", negatedBy: "terminal" };
	}

	let effectiveSlot = preSelectedSlot;
	if (
		isStrike &&
		actorId !== null &&
		actorId !== target.playerId &&
		target.redHerringMark !== null
	) {
		const mark = target.redHerringMark;
		target.redHerringMark = null;
		discardRedHerringMove(state, target);
		if (
			target.crewIds[mark.slot] === mark.crewId &&
			!target.crewTurned[mark.slot]
		) {
			effectiveSlot = mark.slot;
		}
	}

	const unturnedSlots = ([0, 1] as const).filter(
		(i) => target.crewIds[i] !== null && !target.crewTurned[i],
	);

	const resolvedPreSelected =
		effectiveSlot !== undefined && unturnedSlots.includes(effectiveSlot)
			? effectiveSlot
			: null;

	// striking an already face-up crew kills it; only enemies can do this
	const isFaceUpKillTarget =
		isStrike &&
		effectiveSlot !== undefined &&
		target.crewIds[effectiveSlot] !== null &&
		target.crewTurned[effectiveSlot] &&
		actorId !== null &&
		actorId !== target.playerId;

	const causedByEnemy = actorId !== null && actorId !== target.playerId;

	let result: StrikeOrExecuteOutcome;

	if (isFaceUpKillTarget) {
		const slot = effectiveSlot!;
		const { refilledFromReserve } = killCrewAtSlot(state, target, slot);
		result = { outcome: "crew_killed", slot, refilledFromReserve };
		triggerBertoOnCrewKill(state, actorId);
	} else if (resolvedPreSelected !== null) {
		turnCrewAtSlot(state, target, resolvedPreSelected, actorId, via);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, resolvedPreSelected, causedByEnemy);
		result = { outcome: "crew_turned", slot: resolvedPreSelected };
	} else if (unturnedSlots.length === 1) {
		const slot = unturnedSlots[0]!;
		turnCrewAtSlot(state, target, slot, actorId, via);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, slot, causedByEnemy);
		result = { outcome: "crew_turned", slot };
	} else if (unturnedSlots.length > 1) {
		const resolvedActorId = actorId ?? target.playerId;
		const chooserPlayerId = target.derived.hasVoidArms
			? target.playerId
			: resolvedActorId;

		state.pendingInteraction = {
			type: "choose_crew_to_turn",
			targetPlayerId: target.playerId,
			actorId: resolvedActorId,
			chooserPlayerId,
			eligibleSlots: unturnedSlots,
			isStrike,
			causedByEnemy,
			via,
		};
		return { outcome: "pending" };
	} else if (target.bossImmunityTurns > 0) {
		return { outcome: "negated", negatedBy: "immunity" };
	} else if (target.derived.hasLifeInsurance) {
		target.bossHp = 1;
		consumeLifeInsuranceProtecting(state, target);
		target.lastHpZeroCause = "execution";
		state.executionAttempts++;
		state.executionsSurvivedViaLifeInsurance++;
		result = { outcome: "executed", survivedViaLifeInsurance: true };
	} else {
		target.bossHp = 0;
		target.lastHpZeroCause = "execution";
		state.executionAttempts++;
		result = { outcome: "executed", survivedViaLifeInsurance: false };
	}

	if (isStrike && actorId) {
		const striker = state.players.get(actorId);
		if (striker) {
			maybeTriggerBloodMoneyOnTeamDamage(state, striker);
			maybeTriggerRazorStabGrant(striker);
		}
	}
	return result;
}

function performSelfStrike(
	ctx: EffectContext,
	preSelectedSlot?: 0 | 1,
): StrikeOrExecuteOutcome | null {
	const actor = ctx.actor;
	const faceUpSlots = ([0, 1] as const).filter(
		(i) => actor.crewIds[i] !== null && actor.crewTurned[i],
	);
	if (faceUpSlots.length === 0) return null;

	const slot =
		preSelectedSlot !== undefined && faceUpSlots.includes(preSelectedSlot)
			? preSelectedSlot
			: faceUpSlots.length === 1
				? faceUpSlots[0]!
				: null;

	// fizzle if ambiguous and no preselected slot, to avoid half-executing
	if (slot === null) return null;

	const { refilledFromReserve } = killCrewAtSlot(ctx.state, actor, slot);
	triggerBertoOnCrewKill(ctx.state, actor.playerId);

	return { outcome: "crew_killed", slot, refilledFromReserve };
}

function triggerBertoOnCrewKill(
	state: FaceturnServerState,
	killerId: string,
): void {
	const killer = state.players.get(killerId);
	if (!killer) return;
	if (killer.derived.crewSkillsDisabled) return;

	for (let i = 0; i < 2; i++) {
		const slot = i as 0 | 1;
		if (killer.crewIds[slot] !== CARD_IDS.CREW.BERTO_LOPEZ) continue;
		if (!killer.crewTurned[slot]) continue;
		if (killer.disabledPassiveSlots.has(slot)) continue;

		killer.crewTurned[slot] = false;
		killer.disabledPassiveSlots.delete(slot);
	}
	recomputePassives(killer, state);
}

export function performStrike(
	ctx: EffectContext,
): StrikeOrExecuteOutcome | null {
	const target = resolveTarget(ctx);
	if (!target) return null;

	return resolveStrikeOrExecute(
		ctx.state,
		target,
		ctx.actor.playerId,
		{ reason: "strike" },
		ctx.targetCrewSlot as 0 | 1 | undefined,
	);
}

export function executedPlayerIdFrom(
	outcome: StrikeOrExecuteOutcome | null | undefined,
	targetPlayerId: string,
): string | null {
	return outcome?.outcome === "executed" ? targetPlayerId : null;
}

// mama mercy armors ally boss; suplex strikes only on ally's own turn (not forced)
function triggerAllyTurnReactions(
	state: FaceturnServerState,
	turner: FaceturnServerPlayer,
	causedByEnemy: boolean,
): void {
	const mamaHolders = eligibleActiveCrewHolders(
		state,
		turner,
		CARD_IDS.CREW.MAMA_MERCY,
	);
	for (const holder of mamaHolders) {
		const mamaArmorAmount = findEffectAmount(
			getCrew(CARD_IDS.CREW.MAMA_MERCY).passiveEffects,
			"passive_armor_on_ally_crew_turn",
		);
		holder.bossArmor += mamaArmorAmount;
		holder.hasArmoredBossThisGame = true;
	}

	if (!causedByEnemy) {
		const suplexHolders = eligibleActiveCrewHolders(
			state,
			turner,
			CARD_IDS.CREW.SUPLEX,
		);
		for (const holder of suplexHolders) {
			resolveEffects([{ type: "strike_enemy_crew" }], { state, actor: holder });
		}
	}
}

// players (self or teammate of `turner`) with a turned, non-disabled crewId slot
function eligibleActiveCrewHolders(
	state: FaceturnServerState,
	turner: FaceturnServerPlayer,
	crewId: string,
): FaceturnServerPlayer[] {
	const result: FaceturnServerPlayer[] = [];
	for (const holder of getLivingPlayers(state)) {
		if (holder.derived.crewSkillsDisabled) continue;
		const isSelfOrTeammate =
			holder.playerId === turner.playerId ||
			getTeammates(state, holder.playerId).some(
				(t) => t.playerId === turner.playerId,
			);
		if (!isSelfOrTeammate) continue;

		const slot = ([0, 1] as const).find((i) => holder.crewIds[i] === crewId);
		if (slot === undefined) continue;
		if (!holder.crewTurned[slot]) continue;
		if (holder.disabledPassiveSlots.has(slot)) continue;

		result.push(holder);
	}
	return result;
}

export function triggerCrewTurnedEffects(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	slotIndex: 0 | 1,
	causedByEnemy = false,
): void {
	const crewId = player.crewIds[slotIndex];
	if (!crewId) return;

	const crew = getCrew(crewId);
	const ctx: EffectContext = {
		state,
		actor: player,
		targetAllySlot: slotIndex,
		selfTurnedByEnemy: causedByEnemy,
	};

	if (!player.derived.crewSkillsDisabled) {
		resolveEffects(crew.passiveEffects, ctx);
	}

	const suppressedByLighthouse = isTurnedEffectSuppressedByEnemyLighthouse(
		state,
		player,
	);

	const suppressedByCeaseDesist =
		!suppressedByLighthouse &&
		crew.turnedEffects.length > 0 &&
		consumeCeaseDesistIfPresent(state, player);

	if (!suppressedByLighthouse && !suppressedByCeaseDesist) {
		resolveEffects(crew.turnedEffects, ctx);
	}

	triggerAllyTurnReactions(state, player, causedByEnemy);

	recomputePassives(player, state);
}

function isTurnedEffectSuppressedByEnemyLighthouse(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): boolean {
	for (const enemy of getEnemies(state, player.playerId)) {
		if (enemy.derived.crewSkillsDisabled) continue;
		for (const i of [0, 1] as const) {
			if (enemy.crewIds[i] !== CARD_IDS.CREW.LIGHTHOUSE) continue;
			if (!enemy.crewTurned[i]) continue;
			if (enemy.disabledPassiveSlots.has(i)) continue;
			return true;
		}
	}
	return false;
}

// move effect, unaffected by blackmail, consumes first enemy cease & desist
function consumeCeaseDesistIfPresent(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): boolean {
	for (const enemy of getEnemies(state, player.playerId)) {
		if (!enemy.derived.hasCeaseDesist) continue;
		const slot = enemy.activeMoves.findIndex(
			(id) => id === CARD_IDS.MOVE.CEASE_AND_DESIST,
		);
		if (slot === -1) continue;
		enemy.activeMoves[slot] = null;
		enemy.discardPile.push(CARD_IDS.MOVE.CEASE_AND_DESIST);
		enemy.totalCardsDiscarded++;
		recomputePassives(enemy, state);
		return true;
	}
	return false;
}

export const strikeHandlers = {
	strike_enemy_crew(_effect, ctx) {
		performStrike(ctx);
	},

	strike_enemy_crew_defendable(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) return;
		ctx.state.pendingDefendableStrikes.push({
			actorId: ctx.actor.playerId,
			targetPlayerId: target.playerId,
			targetCrewSlot: ctx.targetCrewSlot ?? null,
		});
	},

	strike_enemy_crew_undefendable_with_cash_cost(effect, ctx) {
		if (effect.type !== "strike_enemy_crew_undefendable_with_cash_cost") return;
		if (ctx.actor.cash < effect.cashCost) return; // insufficient funds
		ctx.actor.cash -= effect.cashCost;
		performStrike(ctx);
	},

	strike_own_crew(effect, ctx) {
		if (effect.type !== "strike_own_crew") return;
		// targetAllySlot carries the actor's own picked slot
		const preSelected =
			effect.targetSlot !== undefined
				? (effect.targetSlot as 0 | 1)
				: (ctx.targetAllySlot as 0 | 1 | undefined);
		const result = performSelfStrike(ctx, preSelected);
		if (result === null) return false;
	},
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;