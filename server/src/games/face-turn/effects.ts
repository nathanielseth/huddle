import type {
	FaceturnServerState,
	FaceturnServerPlayer,
	PendingInteraction,
} from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import type {
	CardEffect,
	EffectPrimitive,
	ConditionalEffect,
	MoveCard,
} from "./cards";
import {
	getCrew,
	getMove,
	getBoss,
	CARD_IDS,
	VOID_PIECE_IDS,
	getMoveTargetScope,
	unwrapEffect,
} from "./cards";
import type { CrewClass } from "../../../../shared/games/face-turn/types";
import { shuffle, pickRandom } from "../lib/random";

export interface EffectContext {
	state: FaceturnServerState;
	actor: FaceturnServerPlayer;
	targetPlayerId?: string | undefined;
	targetCrewSlot?: number | undefined;
	targetAllySlot?: number | undefined;
	targetActiveMoveSlot?: number | undefined;
	moveId?: string | undefined;
	selfTurnedByEnemy?: boolean | undefined;
}

export function getLivingPlayers(
	state: FaceturnServerState,
): FaceturnServerPlayer[] {
	const result: FaceturnServerPlayer[] = [];
	for (const player of state.players.values()) {
		if (!state.eliminatedPlayers.has(player.playerId)) {
			result.push(player);
		}
	}
	return result;
}

export function isPlayerOrTeammate(
	state: FaceturnServerState,
	candidatePlayerId: string,
	targetPlayerId: string,
): boolean {
	if (state.eliminatedPlayers.has(targetPlayerId)) return false;
	if (!state.players.has(targetPlayerId)) return false;
	if (candidatePlayerId === targetPlayerId) return true;
	if (state.eliminatedPlayers.has(candidatePlayerId)) return false;
	return getTeammates(state, targetPlayerId).some(
		(t) => t.playerId === candidatePlayerId,
	);
}

function getTeamIndex(state: FaceturnServerState, playerId: string): number {
	return state.players.get(playerId)!.teamIndex;
}

export function getTeammates(
	state: FaceturnServerState,
	playerId: string,
): FaceturnServerPlayer[] {
	const teamIdx = getTeamIndex(state, playerId);
	return getLivingPlayers(state).filter(
		(p) => p.playerId !== playerId && p.teamIndex === teamIdx,
	);
}

export function getEnemies(
	state: FaceturnServerState,
	playerId: string,
): FaceturnServerPlayer[] {
	const teamIdx = getTeamIndex(state, playerId);
	return getLivingPlayers(state).filter((p) => p.teamIndex !== teamIdx);
}

const STRICT_ALLY_TARGET_TYPES = new Set<EffectPrimitive["type"]>([
	"swap_crew_with_teammate",
	"gain_cash_and_draw_ally",
]);

const REQUIRES_OWN_FACE_DOWN_CREW_TYPES = new Set<EffectPrimitive["type"]>([
	"turn_ally_crew",
	"choose_red_herring_crew",
]);

const REQUIRES_OWN_FACE_UP_CREW_TYPES = new Set<EffectPrimitive["type"]>([
	"unturn_ally_crew",
	"unturn_then_retrigger_ally",
]);

const REQUIRES_OWN_MIXED_CREW_TYPES = new Set<EffectPrimitive["type"]>([
	"unturn_one_turn_different_ally",
]);

const REQUIRES_ENEMY_FACE_DOWN_CREW_TYPES = new Set<EffectPrimitive["type"]>([
	"mark_enemy_crew_for_delayed_turn",
]);

const REQUIRES_ENEMY_ACTIVE_MOVE_TYPES = new Set<EffectPrimitive["type"]>([
	"discard_targeted_enemy_active_move",
]);

function requiresOwnFaceDownCrew(move: MoveCard): boolean {
	return move.effects.some((e) =>
		REQUIRES_OWN_FACE_DOWN_CREW_TYPES.has(unwrapEffect(e).type),
	);
}

function requiresOwnFaceUpCrew(move: MoveCard): boolean {
	return move.effects.some((e) =>
		REQUIRES_OWN_FACE_UP_CREW_TYPES.has(unwrapEffect(e).type),
	);
}

function requiresOwnMixedCrew(move: MoveCard): boolean {
	return move.effects.some((e) =>
		REQUIRES_OWN_MIXED_CREW_TYPES.has(unwrapEffect(e).type),
	);
}

function requiresEnemyFaceDownCrew(move: MoveCard): boolean {
	return move.effects.some((e) =>
		REQUIRES_ENEMY_FACE_DOWN_CREW_TYPES.has(unwrapEffect(e).type),
	);
}

function requiresEnemyActiveMove(move: MoveCard): boolean {
	return move.effects.some((e) =>
		REQUIRES_ENEMY_ACTIVE_MOVE_TYPES.has(unwrapEffect(e).type),
	);
}

export function requiresStrictAllyTarget(move: MoveCard): boolean {
	return move.effects.some((e) =>
		STRICT_ALLY_TARGET_TYPES.has(unwrapEffect(e).type),
	);
}

function hasOwnFaceDownCrew(actor: FaceturnServerPlayer): boolean {
	return ([0, 1] as const).some(
		(i) => actor.crewIds[i] !== null && !actor.crewTurned[i],
	);
}

function hasOwnFaceUpCrew(actor: FaceturnServerPlayer): boolean {
	return ([0, 1] as const).some(
		(i) => actor.crewIds[i] !== null && actor.crewTurned[i],
	);
}

// enemy needs a living foe, ally defaults to self unless STRICT_ALLY types require a teammate; extra REQUIRES_* conditions stack, so guards run sequentially
export function moveHasLegalTarget(
	state: FaceturnServerState,
	actorId: string,
	move: MoveCard,
): boolean {
	const scope = getMoveTargetScope(move);

	if (scope === "enemy" && getEnemies(state, actorId).length === 0) {
		return false;
	}

	if (scope === "ally") {
		const requiresTeammate = requiresStrictAllyTarget(move);
		if (requiresTeammate) {
			if (getTeammates(state, actorId).length === 0) return false;

			// swap_crew_with_teammate's additional, more specific requirement:
			// both the actor and at least one teammate need a filled crew slot
			if (
				move.effects.some(
					(e) => unwrapEffect(e).type === "swap_crew_with_teammate",
				)
			) {
				const actor = state.players.get(actorId);
				if (!actor || !actor.crewIds.some((id) => id !== null)) return false;
				if (
					!getTeammates(state, actorId).some((t) =>
						t.crewIds.some((id) => id !== null),
					)
				) {
					return false;
				}
			}
		}
	}

	if (requiresOwnFaceDownCrew(move)) {
		const actor = state.players.get(actorId);
		if (!actor || !hasOwnFaceDownCrew(actor)) return false;
	}

	if (requiresOwnFaceUpCrew(move)) {
		const actor = state.players.get(actorId);
		if (!actor || !hasOwnFaceUpCrew(actor)) return false;
	}

	if (requiresOwnMixedCrew(move)) {
		const actor = state.players.get(actorId);
		if (!actor || !hasOwnFaceUpCrew(actor) || !hasOwnFaceDownCrew(actor)) {
			return false;
		}
	}

	if (requiresEnemyFaceDownCrew(move)) {
		const hasEligibleEnemy = getEnemies(state, actorId).some((enemy) =>
			([0, 1] as const).some(
				(i) => enemy.crewIds[i] !== null && !enemy.crewTurned[i],
			),
		);
		if (!hasEligibleEnemy) return false;
	}

	if (requiresEnemyActiveMove(move)) {
		const hasEligibleEnemy = getEnemies(state, actorId).some((enemy) =>
			enemy.activeMoves.some((m) => m !== null),
		);
		if (!hasEligibleEnemy) return false;
	}

	return true;
}

function resolveTarget(ctx: EffectContext): FaceturnServerPlayer | null {
	if (ctx.targetPlayerId) {
		const p = ctx.state.players.get(ctx.targetPlayerId);
		if (p && !ctx.state.eliminatedPlayers.has(p.playerId)) return p;
	}
	const enemies = getEnemies(ctx.state, ctx.actor.playerId);
	return enemies[0] ?? null;
}

// defaults to self when no valid ally target (safe for duel/ffa)
function resolveAllyTarget(ctx: EffectContext): FaceturnServerPlayer {
	if (!ctx.targetPlayerId) return ctx.actor;
	if (ctx.targetPlayerId === ctx.actor.playerId) return ctx.actor;

	const candidate = ctx.state.players.get(ctx.targetPlayerId);
	if (!candidate) return ctx.actor;
	if (ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) return ctx.actor;

	const isAlly = candidate.teamIndex === ctx.actor.teamIndex;
	return isAlly ? candidate : ctx.actor;
}

// Unlike resolveAllyTarget, never defaults to self, returns null if no living teammate
function resolveStrictAllyTarget(
	ctx: EffectContext,
): FaceturnServerPlayer | null {
	if (!ctx.targetPlayerId || ctx.targetPlayerId === ctx.actor.playerId) {
		return null;
	}
	const candidate = ctx.state.players.get(ctx.targetPlayerId);
	if (!candidate || ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) {
		return null;
	}
	return candidate.teamIndex === ctx.actor.teamIndex ? candidate : null;
}

export function isConditionalEffect(e: CardEffect): e is ConditionalEffect {
	return "condition" in e && "effect" in e;
}

// reads a passive magnitude from card database to avoid magic numbers
function findEffectAmount(
	effects: readonly CardEffect[],
	type: EffectPrimitive["type"],
): number {
	for (const e of effects) {
		const eff = isConditionalEffect(e) ? e.effect : e;
		if (eff.type === type) {
			const amount = (eff as Record<string, unknown>)["amount"];
			if (typeof amount === "number") return amount;
		}
	}
	return 0;
}

// scans all active moves for a global crew-skills-disable source; used by recomputePassives
function hasActiveCrewSkillsDisableSource(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): boolean {
	for (const p of state.players.values()) {
		for (const moveId of p.activeMoves) {
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
		if (enemy.crewSkillsDisabled) continue;
		for (const i of [0, 1] as const) {
			if (enemy.crewIds[i] !== CARD_IDS.CREW.SILENCER) continue;
			if (!enemy.crewTurned[i]) continue;
			if (enemy.disabledPassiveSlots.has(i)) continue;
			return true;
		}
	}
	return false;
}

function checkVoidPiecesAssembled(actor: FaceturnServerPlayer): boolean {
	return VOID_PIECE_IDS.every((id) => actor.activeMoves.includes(id));
}

const ALSO_CLASS_GRANTS: Partial<Record<EffectPrimitive["type"], CrewClass>> = {
	become_also_striker: "striker",
	become_also_unturner: "unturner",
	become_also_defender: "defender",
};

function evaluateCondition(
	condition: ConditionalEffect["condition"],
	ctx: EffectContext,
): boolean {
	const { actor } = ctx;

	switch (condition.when) {
		case "always":
			return true;

		case "another_ally_is_turned": {
			const selfSlot = ctx.targetAllySlot;
			return actor.crewIds.some((crewId, i) => {
				if (!crewId || !actor.crewTurned[i as 0 | 1]) return false;
				return i !== selfSlot;
			});
		}

		case "has_turned_ally_crew_this_game":
			return actor.hasTurnedAllyCrewThisGame;

		case "ally_class_is_turned":
			return [actor, ...getTeammates(ctx.state, actor.playerId)].some((p) =>
				p.crewIds.some((crewId, i) => {
					if (!crewId || !p.crewTurned[i as 0 | 1]) return false;
					return resolveCrewClass(p, i as 0 | 1, condition.class) === true;
				}),
			);

		case "self_class_is_turned":
			return actor.crewIds.some((crewId, i) => {
				if (!crewId || !actor.crewTurned[i as 0 | 1]) return false;
				return resolveCrewClass(actor, i as 0 | 1, condition.class) === true;
			});

		case "has_armored_boss":
			return actor.bossArmor > 0;

		case "void_pieces_assembled":
			return checkVoidPiecesAssembled(actor);

		case "self_turned_not_by_enemy":
			return !ctx.selfTurnedByEnemy;

		case "enemy_has_more_cash":
			return getEnemies(ctx.state, actor.playerId).some(
				(enemy) => enemy.cash > actor.cash,
			);

		case "no_face_up_crew":
			return actor.crewIds.every(
				(crewId, i) => !crewId || !actor.crewTurned[i as 0 | 1],
			);

		default: {
			const _exhaustive: never = condition;
			return _exhaustive;
		}
	}
}

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
			return player.crewIds.every(
				(crewId, i) => !crewId || !player.crewTurned[i as 0 | 1],
			);
		default: {
			const _exhaustive: never = condition;
			return _exhaustive;
		}
	}
}

export function resolveCrewClass(
	player: FaceturnServerPlayer,
	slot: 0 | 1,
	cls?: "striker" | "defender" | "collector" | "unturner",
): string | boolean {
	const crewId = player.crewIds[slot];
	if (!crewId) return cls ? false : "";
	if (player.disabledPassiveSlots.has(slot)) return cls ? false : "";
	const overrides = player.crewClassOverrides.get(slot);
	if (cls) {
		if (overrides?.has(cls)) return true;
		return getCrew(crewId).class === cls;
	}
	return getCrew(crewId).class;
}

function clampHp(hp: number, max: number): number {
	return Math.max(0, Math.min(max, Math.round(hp)));
}

// life insurance: prevents lethal damage once, sets hp to 1, then discards itself
function consumeLifeInsuranceProtecting(
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
	if (!target.hasBastionPassive) return;
	target.cash += 1;
}

// monkey man: steals cash from the boss he just damaged, once per damage instance, capped by their available cash
function maybeTriggerMonkeyManCashSteal(
	target: FaceturnServerPlayer,
	sourceActor: FaceturnServerPlayer,
	dmgDealt: number,
): void {
	if (dmgDealt <= 0) return;
	if (sourceActor.stealCashOnDamageDealtAmount <= 0) return;
	if (sourceActor.playerId === target.playerId) return;
	const stolen = Math.min(
		sourceActor.stealCashOnDamageDealtAmount,
		target.cash,
	);
	if (stolen <= 0) return;
	target.cash -= stolen;
	sourceActor.cash += stolen;
}

// damage pipeline: flat bonus, reduction%, immunity, armor, life insurance
// undefendable skips armor/immunity/reduction; cannotBeMultiplied skips actor's flat bonus
function applyDamage(
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
			: rawAmount + sourceActor.damageBonusFlat;

	// pektus: all damage from this source bypasses armor, same as undefendable's armor step
	const skipsArmor = undefendable || sourceActor.hasAllDamagePiercingPassive;

	if (!undefendable) {
		if (target.damageReductionPercent > 0) {
			dmg = Math.floor(dmg * (1 - target.damageReductionPercent / 100));
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

	if (dmg <= 0) return 0;

	if (target.hasLifeInsurance && target.bossHp - dmg <= 0) {
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

// piercing damage: bypasses armor, still respects immunity and reduction%
function applyDamageIgnoreArmor(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
): number {
	let dmg = rawAmount + sourceActor.damageBonusFlat;

	if (target.bossImmunityTurns > 0) return 0;
	if (target.damageReductionPercent > 0) {
		dmg = Math.floor(dmg * (1 - target.damageReductionPercent / 100));
	}
	if (dmg <= 0) return 0;

	if (target.hasLifeInsurance && target.bossHp - dmg <= 0) {
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

export function drawCards(player: FaceturnServerPlayer, count: number): void {
	const room = Math.min(
		count,
		player.deck.length,
		Math.max(0, C.HAND_LIMIT - player.hand.length),
	);
	if (room <= 0) return;
	player.hand.push(...player.deck.splice(0, room));
}

export function discardFromHand(
	player: FaceturnServerPlayer,
	count: number,
	state: FaceturnServerState,
): string[] {
	const toDiscard = player.hand.splice(0, Math.min(count, player.hand.length));
	player.discardPile.push(...toDiscard);
	player.totalCardsDiscarded += toDiscard.length;
	for (const id of toDiscard) player.costOverrides.delete(id);

	if (toDiscard.length > 0) {
		maybeTriggerDoctorNorman(player, toDiscard.length);
		checkRatQueenDrawTrigger(player, state);
	}

	return toDiscard;
}

const DOCTOR_NORMAN_ARMOR_PER_DISCARD = 10;

// doctor norman armor per self-initiated discard, scaled by cards discarded
function maybeTriggerDoctorNorman(
	player: FaceturnServerPlayer,
	cardsDiscarded: number,
): void {
	if (cardsDiscarded <= 0) return;
	const slot = player.crewIds.findIndex(
		(id) => id === CARD_IDS.CREW.DOCTOR_NORMAN,
	);
	if (slot === -1) return;
	if (!player.crewTurned[slot as 0 | 1]) return;
	if (player.crewSkillsDisabled) return;
	if (player.disabledPassiveSlots.has(slot as 0 | 1)) return;
	player.bossArmor += DOCTOR_NORMAN_ARMOR_PER_DISCARD * cardsDiscarded;
	player.hasArmoredBossThisGame = true;
}

export function checkRatQueenDrawTrigger(
	player: FaceturnServerPlayer,
	_state: FaceturnServerState,
): void {
	if (player.hand.length !== 0) return;
	if (player.ratQueenDrawUsedThisTurn) return;
	const slot = player.crewIds.findIndex((id) => id === CARD_IDS.CREW.RAT_QUEEN);
	if (slot === -1) return;
	if (!player.crewTurned[slot as 0 | 1]) return;
	if (player.crewSkillsDisabled) return;
	if (player.disabledPassiveSlots.has(slot as 0 | 1)) return;
	player.ratQueenDrawUsedThisTurn = true;

	const amount = findEffectAmount(
		getCrew(CARD_IDS.CREW.RAT_QUEEN).passiveEffects,
		"passive_draw_on_hand_empty_once_per_turn",
	);
	drawCards(player, amount);
}

export function sellMoveFromHand(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	moveId: string,
): boolean {
	if (!actor.hasSellCards) return false;
	const handIndex = actor.hand.indexOf(moveId);
	if (handIndex === -1) return false;

	actor.hand.splice(handIndex, 1);
	actor.discardPile.push(moveId);
	actor.totalCardsDiscarded++;
	actor.costOverrides.delete(moveId);
	actor.cash += actor.sellCardCashAmount;

	maybeTriggerDoctorNorman(actor, 1);
	checkRatQueenDrawTrigger(actor, state);
	return true;
}

// fires when a slot ceases to be "that face‑down crew": clears marks, using previousCrewId to treat refill as invalidation not match
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
	}
}

export function turnCrewAtSlot(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	slot: 0 | 1,
): void {
	const crewId = player.crewIds[slot];
	if (!crewId) return;
	player.crewTurned[slot] = true;
	player.hasTurnedAllyCrewThisGame = true;
	invalidateStaleCrewMarks(state, player, slot, crewId);
}

export function unturnCrewAtSlot(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	slot: 0 | 1,
	causedByEnemy = false,
): void {
	if (!player.crewIds[slot]) return;
	player.crewTurned[slot] = false;
	player.disabledPassiveSlots.delete(slot);
	triggerAllyTurnReactions(state, player, causedByEnemy);
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

// for class declarations, only face-down crew (or crew with class override) count; face-up crew are spent
export function playerHasClass(
	player: FaceturnServerPlayer,
	cls: "striker" | "defender" | "collector" | "unturner",
): boolean {
	return player.crewIds.some((crewId, i) => {
		if (!crewId) return false;
		const idx = i as 0 | 1;
		if (player.disabledPassiveSlots.has(idx)) return false;
		const overrides = player.crewClassOverrides.get(idx);
		if (overrides?.has(cls)) return true;
		if (player.crewTurned[idx]) return false;
		return getCrew(crewId).class === cls;
	});
}

export type StrikeOrExecuteOutcome =
	| { outcome: "crew_turned"; slot: 0 | 1 }
	| { outcome: "crew_killed"; slot: 0 | 1; refilledFromReserve: boolean }
	| { outcome: "pending" }
	| { outcome: "executed"; survivedViaLifeInsurance: boolean }
	| { outcome: "negated"; negatedBy: "terminal" | "immunity" };

// shared check for terminal strike defend to keep resolution and declare-time logic consistent
export function isStrikeDefendedByTerminal(
	target: FaceturnServerPlayer,
): boolean {
	return target.hasTerminalStrikeDefend && target.bossHp > 60;
}

// turns a face-down crew or executes if none remain; when multiple unturned crew, asks the correct player (void arms lets defender choose)
export function resolveStrikeOrExecute(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	actorId: string | null,
	isStrike: boolean,
	preSelectedSlot?: 0 | 1,
): StrikeOrExecuteOutcome {
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

	// striking an already face-up crew slot kills it instead of turning it;
	// only valid when the actor is an enemy of the target (never self-kill)
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
		const killedCrewId = target.crewIds[slot]!;
		target.crewIds[slot] = null;
		target.crewTurned[slot] = false;

		let refilledFromReserve = false;
		if (target.reserveCrewId !== null) {
			target.crewIds[slot] = target.reserveCrewId;
			target.crewTurned[slot] = false;
			target.reserveCrewId = null;
			refilledFromReserve = true;
		}

		invalidateStaleCrewMarks(state, target, slot, killedCrewId);

		recomputePassives(target, state);
		result = { outcome: "crew_killed", slot, refilledFromReserve };
		triggerBertoOnEnemyCrewKill(state, actorId);
	} else if (resolvedPreSelected !== null) {
		turnCrewAtSlot(state, target, resolvedPreSelected);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, resolvedPreSelected, causedByEnemy);
		result = { outcome: "crew_turned", slot: resolvedPreSelected };
	} else if (unturnedSlots.length === 1) {
		const slot = unturnedSlots[0]!;
		turnCrewAtSlot(state, target, slot);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, slot, causedByEnemy);
		result = { outcome: "crew_turned", slot };
	} else if (unturnedSlots.length > 1) {
		const resolvedActorId = actorId ?? target.playerId;
		const chooserPlayerId = target.hasVoidArms
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
		};
		return { outcome: "pending" };
	} else if (target.bossImmunityTurns > 0) {
		return { outcome: "negated", negatedBy: "immunity" };
	} else if (target.hasLifeInsurance) {
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
		if (striker) applyBloodMoneyOnStrike(state, striker);
	}
	return result;
}

// berto lopez: turns his own slot face-down whenever his holder kills an enemy crew
function triggerBertoOnEnemyCrewKill(
	state: FaceturnServerState,
	killerId: string,
): void {
	const killer = state.players.get(killerId);
	if (!killer) return;
	if (killer.crewSkillsDisabled) return;

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

// blood money: enemies with the passive gain cash when a strike is declared
export function applyBloodMoneyOnStrike(
	state: FaceturnServerState,
	striker: FaceturnServerPlayer,
): void {
	for (const enemy of getEnemies(state, striker.playerId)) {
		if (enemy.cashOnEnemyMoveOrStrike > 0) {
			enemy.cash += enemy.cashOnEnemyMoveOrStrike;
		}
	}
}

export function applyCoolGuyDamageOnMovePlayed(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
): void {
	if (actor.damageRandomEnemyOnMovePlayed <= 0) return;
	const enemies = getEnemies(state, actor.playerId);
	if (enemies.length === 0) return;
	const target = pickRandom(enemies);
	applyDamage(state, target, actor.damageRandomEnemyOnMovePlayed, actor);
}

// supply drop: team-wide cash on any collector class action
export function applySupplyDropOnCollect(
	state: FaceturnServerState,
	collector: FaceturnServerPlayer,
): void {
	for (const player of getLivingPlayers(state)) {
		if (!player.hasSupplyDrop) continue;
		const isSameTeam =
			player.playerId === collector.playerId ||
			player.teamIndex === collector.teamIndex;
		if (!isSameTeam) continue;
		for (const member of getLivingPlayers(state)) {
			if (member.teamIndex !== player.teamIndex) continue;
			member.cash += player.supplyDropCashAmount;
		}
	}
}

// trickle-down economics: mirrors cash gained by a watched collector
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

export function performStrike(
	ctx: EffectContext,
): StrikeOrExecuteOutcome | null {
	const target = resolveTarget(ctx);
	if (!target) return null;

	return resolveStrikeOrExecute(
		ctx.state,
		target,
		ctx.actor.playerId,
		true,
		ctx.targetCrewSlot as 0 | 1 | undefined,
	);
}

export function executedPlayerIdFrom(
	outcome: StrikeOrExecuteOutcome | null | undefined,
	targetPlayerId: string,
): string | null {
	return outcome?.outcome === "executed" ? targetPlayerId : null;
}

// resets and re-accumulates all derived passive stats; prunes incoming poison from eliminated sources
export function recomputePassives(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): void {
	player.cashGainPerTurn = 0;
	player.drawPerTurn = 0;
	player.cashOnEnemyMoveOrStrike = 0;
	player.healOnMovePlayed = 0;
	player.damageRandomEnemyOnMovePlayed = 0;
	player.crewSkillsDisabled = false;
	player.damageBonusFlat = 0;
	player.damageReductionPercent = 0;
	player.armorPerTurn = 0;
	player.moveBaseCostReduction = 0;
	player.burstMoveCostReduction = 0;
	player.classActionCostReduction = 0;
	player.enemyMoveCostSurcharge = 0;
	player.hasBastionPassive = false;
	player.hasAllDamagePiercingPassive = false;
	player.stealCashOnDamageDealtAmount = 0;
	player.hasVoidArms = false;
	player.hasSupplyDrop = false;
	player.supplyDropCashAmount = 0;
	player.hasLifeInsurance = false;
	player.hasFalseFlag = false;
	player.hasSellCards = false;
	player.sellCardCashAmount = 0;
	player.hasVoidLegsChoice = false;
	player.voidLegsDiscardCost = 0;
	player.voidLegsDamage = 0;
	player.hasBackgroundCheck = false;
	player.hasPrankCall = false;
	player.prankCallBonusAmount = 0;
	player.hasTerminalStrikeDefend = false;
	player.cashOnChallengeWinAmount = 0;
	player.selfDamagePerTurn = 0;
	player.selfDamageCashGainAmount = 0;
	player.hasCeaseDesist = false;
	player.crewClassOverrides.clear();

	const playersWithActivePoisonSource = new Set<string>();
	for (const p of state.players.values()) {
		const silencedByEnemy = hasActiveEnemySilencer(p, state);
		const hasPoisonFromCrew = p.crewIds.some((crewId, i) => {
			if (!crewId || !p.crewTurned[i as 0 | 1]) return false;
			if (p.crewSkillsDisabled || silencedByEnemy) return false;
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

	// resolve global crew skill disable first, before collecting other passives
	const crewSkillsDisabledNow = hasActiveCrewSkillsDisableSource(player, state);
	player.crewSkillsDisabled = crewSkillsDisabledNow;
	const crewPassivesSilencedByEnemy = hasActiveEnemySilencer(player, state);

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
			const existing = player.crewClassOverrides.get(slot) ?? new Set();
			existing.add(grantedClass);
			player.crewClassOverrides.set(slot, existing);
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
				recomputePassiveSwitch(ce.effect, player, state);
				continue;
			}
			const effect = cardEffect;
			// poison handled at round end via incomingPoison, no derived stat
			if (effect.type === "passive_poison_per_round") continue;
			recomputePassiveSwitch(effect, player, state);
		}
	}

	// life insurance: derived from other players' maps, not from own active moves
	const insuranceCandidates = [player, ...getTeammates(state, player.playerId)];
	player.hasLifeInsurance = insuranceCandidates.some((candidate) =>
		[...candidate.lifeInsuranceTargets.values()].includes(player.playerId),
	);
}

function recomputePassiveSwitch(
	effect: EffectPrimitive,
	player: FaceturnServerPlayer,
	_state: FaceturnServerState,
): void {
	switch (effect.type) {
		case "passive_cash_per_turn":
			player.cashGainPerTurn += effect.amount;
			break;
		case "passive_draw_per_turn":
			player.drawPerTurn += effect.amount;
			break;
		case "passive_cash_on_enemy_move_or_strike":
			player.cashOnEnemyMoveOrStrike += effect.amount;
			break;
		case "passive_heal_on_move_played":
			player.healOnMovePlayed += effect.amount;
			break;
		case "passive_damage_random_enemy_on_move_played":
			player.damageRandomEnemyOnMovePlayed += effect.amount;
			break;
		case "passive_armor_per_turn":
			player.armorPerTurn += effect.amount;
			break;
		case "passive_flat_damage_bonus":
			player.damageBonusFlat += effect.amount;
			break;
		case "passive_negate_damage_percent":
			player.damageReductionPercent = Math.max(
				player.damageReductionPercent,
				effect.percent,
			);
			break;
		case "passive_reduce_all_move_costs":
			player.moveBaseCostReduction += effect.reduction;
			break;
		case "passive_reduce_burst_move_costs":
			player.burstMoveCostReduction += effect.reduction;
			break;
		case "passive_reduce_class_action_costs":
			player.classActionCostReduction += effect.reduction;
			break;
		case "passive_increase_enemy_move_costs":
			player.enemyMoveCostSurcharge += effect.amount;
			break;
		case "passive_cash_on_damage_taken":
			player.hasBastionPassive = true;
			break;
		case "passive_defend_strikes_above_half_hp":
			player.hasTerminalStrikeDefend = true;
			break;
		case "passive_disable_all_crew_skills":
			break;
		case "passive_defender_chooses_crew_to_turn":
			player.hasVoidArms = true;
			break;
		case "passive_team_cash_on_ally_collect":
			player.hasSupplyDrop = true;
			player.supplyDropCashAmount = effect.amount;
			break;
		case "passive_false_flag":
			player.hasFalseFlag = true;
			break;
		case "passive_sell_moves_for_cash":
			player.hasSellCards = true;
			player.sellCardCashAmount += effect.cashAmount;
			break;
		case "passive_optional_discard_for_damage_per_turn":
			player.hasVoidLegsChoice = true;
			player.voidLegsDiscardCost = effect.discardCost;
			player.voidLegsDamage = effect.damage;
			break;
		case "passive_background_check":
			player.hasBackgroundCheck = true;
			break;
		case "passive_bonus_cash_on_first_bluff_per_round":
			player.hasPrankCall = true;
			player.prankCallBonusAmount = effect.amount;
			break;
		case "passive_watcher_unturn_on_challenge_win":
			player.hasWatcherPassive = true;
			break;
		case "passive_cash_on_challenge_win":
			player.cashOnChallengeWinAmount += effect.amount;
			break;
		case "passive_self_damage_and_cash_per_turn":
			player.selfDamagePerTurn += effect.damage;
			player.selfDamageCashGainAmount += effect.cashAmount;
			break;
		case "passive_cease_and_desist":
			player.hasCeaseDesist = true;
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
		case "become_also_unturner":
		case "become_also_defender":
			break;
		case "passive_disable_all_enemy_crew_passives":
			break;
		case "passive_strike_on_self_turned_ally":
			break;
		case "passive_turn_self_down_on_enemy_crew_kill":
			break;
		case "passive_all_damage_is_piercing":
			player.hasAllDamagePiercingPassive = true;
			break;
		case "passive_steal_cash_on_damage_dealt":
			player.stealCashOnDamageDealtAmount += effect.amount;
			break;
		case "mark_enemy_crew_for_delayed_turn":
		case "discard_targeted_enemy_active_move":
		case "shuffle_discard_into_deck_then_draw":
		case "choose_red_herring_crew":
		case "gain_cash_and_draw_ally":
			break;
	}
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

// handlers may return false to skip the next unconditional primitive (used when discard must fully succeed)
type Handler = (effect: EffectPrimitive, ctx: EffectContext) => boolean | void;

const handlers: Partial<Record<EffectPrimitive["type"], Handler>> = {
	// damage
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

	// strikes
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
		if (ctx.actor.cash < effect.cashCost) return; // fizzle: insufficient funds
		ctx.actor.cash -= effect.cashCost;
		performStrike(ctx);
	},

	// crew turn manipulation
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

	// draw / discard
	draw_cards(effect, ctx) {
		if (effect.type !== "draw_cards") return;
		drawCards(ctx.actor, effect.amount);
	},

	discard_cards_from_hand(effect, ctx) {
		if (effect.type !== "discard_cards_from_hand") return true;
		const available = Math.min(effect.amount, ctx.actor.hand.length);
		discardFromHand(ctx.actor, effect.amount, ctx.state);
		return available === effect.amount;
	},

	discard_variable_by_bluff_flag(effect, ctx) {
		if (effect.type !== "discard_variable_by_bluff_flag") return true;
		const amount = ctx.actor.hasCalledBluffSuccessfully
			? effect.reducedAmount
			: effect.baseAmount;
		const available = Math.min(amount, ctx.actor.hand.length);
		discardFromHand(ctx.actor, amount, ctx.state);
		return available === amount;
	},

	discard_all_enemy_hand(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) {
			ctx.state.lastEnemyHandDiscardCount = 0;
			return;
		}
		const discarded = target.hand.splice(0);
		target.discardPile.push(...discarded);
		target.totalCardsDiscarded += discarded.length;
		for (const id of discarded) target.costOverrides.delete(id);
		ctx.state.lastEnemyHandDiscardCount = discarded.length;
		// doctor norman does not trigger on enemy-forced discards
		if (discarded.length > 0) {
			checkRatQueenDrawTrigger(target, ctx.state);
		}
	},

	discard_all_actives_all_players(_effect, ctx) {
		for (const player of ctx.state.players.values()) {
			for (let i = 0; i < player.activeMoves.length; i++) {
				const moveId = player.activeMoves[i];
				if (!moveId) continue;
				if (getMove(moveId).moveType === "active") {
					player.discardPile.push(moveId);
					player.activeMoves[i] = null;
					player.trickleDownTargets.delete(i as 0 | 1 | 2);
					player.totalCardsDiscarded++;
				}
			}
			recomputePassives(player, ctx.state);
		}
	},

	discard_enemy_actives(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) return;
		for (let i = 0; i < target.activeMoves.length; i++) {
			const moveId = target.activeMoves[i];
			if (!moveId) continue;
			if (getMove(moveId).moveType === "active") {
				target.discardPile.push(moveId);
				target.activeMoves[i] = null;
				target.trickleDownTargets.delete(i as 0 | 1 | 2);
				target.totalCardsDiscarded++;
			}
		}
		recomputePassives(target, ctx.state);
	},

	discard_one_draw_three(_effect, ctx) {
		if (ctx.actor.hand.length === 0) return;
		discardFromHand(ctx.actor, 1, ctx.state);
		drawCards(ctx.actor, 3);
	},

	draw_cards_or_more_if_hand_was_empty(effect, ctx) {
		if (effect.type !== "draw_cards_or_more_if_hand_was_empty") return;
		if (ctx.actor.hand.length === 0) {
			drawCards(ctx.actor, effect.bonusAmount);
		} else {
			drawCards(ctx.actor, effect.baseAmount);
		}
	},

	return_one_from_discard_to_hand(_effect, ctx) {
		if (ctx.actor.discardPile.length === 0) return;
		if (ctx.actor.discardPile.length === 1) {
			const only = ctx.actor.discardPile.pop()!;
			if (ctx.actor.hand.length < C.HAND_LIMIT) {
				ctx.actor.hand.push(only);
			} else {
				ctx.actor.discardPile.push(only); // hand full, fizzle but keep card
			}
			return;
		}
		ctx.state.pendingInteraction = {
			type: "choose_from_discard",
			actorId: ctx.actor.playerId,
			discardPileSnapshot: [...ctx.actor.discardPile],
		} satisfies PendingInteraction;
	},

	return_discards_to_hand_until_full(_effect, ctx) {
		while (
			ctx.actor.discardPile.length > 0 &&
			ctx.actor.hand.length < C.HAND_LIMIT
		) {
			const card = ctx.actor.discardPile.shift()!;
			ctx.actor.hand.push(card);
		}
	},

	search_deck_for_card_add_to_hand(effect, ctx) {
		if (effect.type !== "search_deck_for_card_add_to_hand") return;
		const actor = ctx.actor;
		if (actor.hand.includes(effect.cardId)) return; // already in hand, fizzle
		const idx = actor.deck.indexOf(effect.cardId);
		if (idx === -1) return; // not in deck, fizzle
		if (actor.hand.length >= C.HAND_LIMIT) return;
		actor.deck.splice(idx, 1);
		actor.hand.push(effect.cardId);
		actor.costOverrides.set(effect.cardId, effect.costOverride ?? 0);
		actor.deck = shuffle(actor.deck);
	},

	look_at_top_deck_draw_one(effect, ctx) {
		if (effect.type !== "look_at_top_deck_draw_one") return;
		const revealed = ctx.actor.deck.slice(0, effect.lookCount);
		if (revealed.length === 0) return; // empty deck, fizzle
		ctx.state.pendingInteraction = {
			type: "dig_deep_pick",
			actorId: ctx.actor.playerId,
			revealedCards: revealed,
			maxPicks: effect.drawCount ?? 1,
		} satisfies PendingInteraction;
	},

	// cash
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

	steal_random_card(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target || target.hand.length === 0) return;
		if (ctx.actor.hand.length >= C.HAND_LIMIT) return;
		const idx = Math.floor(Math.random() * target.hand.length);
		const [taken] = target.hand.splice(idx, 1);
		if (!taken) return;
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

		const recipient = poorest.length === 1 ? poorest[0]! : pickRandom(poorest);
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

	// boss hp / armor
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

	// read / peek
	peek_enemy_hand_then_gain_cash(effect, ctx) {
		if (effect.type !== "peek_enemy_hand_then_gain_cash") return;
		const target = resolveTarget(ctx);
		if (target) {
			ctx.state.watcherReveal = {
				forPlayerId: ctx.actor.playerId,
				hand: [...target.hand],
			};
		}
		ctx.actor.cash += effect.cashGain;
	},

	peek_steal(effect, ctx) {
		if (effect.type !== "peek_steal") return;
		const target = resolveTarget(ctx);
		if (!target) return;

		if (target.hand.length > 0 && ctx.actor.hand.length < C.HAND_LIMIT) {
			const idx = Math.floor(Math.random() * target.hand.length);
			const [taken] = target.hand.splice(idx, 1);
			if (taken) {
				target.costOverrides.delete(taken);
				ctx.actor.hand.push(taken);
			}
		}

		const stolen = Math.min(effect.cashAmount, target.cash);
		target.cash -= stolen;
		ctx.actor.cash += stolen;
	},

	peek_two_random_enemy_cards_discard_one(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target || target.hand.length === 0) return;
		const shuffled = [...target.hand].sort(() => Math.random() - 0.5);
		const card1 = shuffled[0]!;
		const card2 = shuffled[1] ?? shuffled[0]!;
		ctx.state.pendingInteraction = {
			type: "peek_discard",
			actorId: ctx.actor.playerId,
			revealedCards: [card1, card2],
		} satisfies PendingInteraction;
	},

	reveal_enemy_crew_class(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) return;
		const eligibleSlots = ([0, 1] as const).filter(
			(i) => target.crewIds[i] !== null && !target.crewTurned[i],
		);
		if (eligibleSlots.length === 0) return;
		ctx.state.pendingInteraction = {
			type: "truth_serum_reveal",
			actorId: ctx.actor.playerId,
			targetPlayerId: target.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
	},

	// handled in engine.ts; marker only
	negate_enemy_slow_move() {},
	reflect_slow_move_base_damage() {},

	// bastion command: gain armor, deal damage equal to new armor total, then empty armor regardless
	command_gain_armor_then_deal_damage_equal_to_armor(effect, ctx) {
		if (effect.type !== "command_gain_armor_then_deal_damage_equal_to_armor")
			return;
		const target = resolveTarget(ctx);
		ctx.actor.bossArmor += effect.armorAmount;
		ctx.actor.hasArmoredBossThisGame = true;
		const totalArmor = ctx.actor.bossArmor;
		ctx.actor.bossArmor = 0;
		if (!target || totalArmor <= 0) return;
		applyDamage(ctx.state, target, totalArmor, ctx.actor, false, false);
	},

	// stat accumulators or live-triggered; no runtime handler needed here
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
	passive_cash_per_turn() {},
	passive_draw_per_turn() {},
	passive_cash_on_enemy_move_or_strike() {},
	passive_heal_on_move_played() {},
	passive_damage_random_enemy_on_move_played() {},
	passive_armor_per_turn() {},
	passive_sell_moves_for_cash() {},
	passive_optional_discard_for_damage_per_turn() {},
	passive_flat_damage_bonus() {},
	passive_negate_damage_percent() {},
	passive_reduce_all_move_costs() {},
	passive_reduce_burst_move_costs() {},
	passive_increase_enemy_move_costs() {},
	passive_cash_on_damage_taken() {},
	passive_disable_all_crew_skills() {},
	passive_defender_chooses_crew_to_turn() {},
	passive_background_check() {},
	passive_bonus_cash_on_first_bluff_per_round() {},
	passive_team_cash_on_ally_collect() {},
	// life insurance: stores protected target keyed by active move slot
	passive_life_insurance(_effect, ctx) {
		if (!ctx.moveId) return;
		const slot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (slot === -1) return;
		const protectedAlly = resolveAllyTarget(ctx);
		ctx.actor.lifeInsuranceTargets.set(slot, protectedAlly.playerId);
	},
	// mirrors life insurance: stores watched enemy in trickleDownTargets
	passive_mirror_enemy_collect_cash(_effect, ctx) {
		if (!ctx.moveId) return;
		const slot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (slot === -1) return;
		if (!ctx.targetPlayerId) return;
		const target = ctx.state.players.get(ctx.targetPlayerId);
		if (!target || ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) return;
		ctx.actor.trickleDownTargets.set(slot, ctx.targetPlayerId);
	},
	passive_false_flag() {},
	passive_defend_strikes_above_half_hp() {},
	passive_armor_on_discard() {},
	passive_draw_on_hand_empty_once_per_turn() {},
	passive_watcher_unturn_on_challenge_win() {},
	passive_optional_strike_on_successful_challenge() {},
	passive_suppress_enemy_turned_effects() {},
	// derived stat set in recomputePassiveSwitch; nothing to do at play time
	passive_cash_on_challenge_win() {},
	passive_self_damage_and_cash_per_turn() {},
	passive_cease_and_desist() {},

	// warrant of arrest: locks in target player + slot + crewId now;
	// resolution is entirely owned by processWarrantOfArrestTicks (game.ts
	// startTurn). Keyed by the caster's own active-move slot so multiple
	// copies track independently. Fizzles quietly if the target has no
	// face-down crew at cast time.
	mark_enemy_crew_for_delayed_turn(_effect, ctx) {
		if (!ctx.moveId) return;
		const ownSlot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (ownSlot === -1) return;
		const target = resolveTarget(ctx);
		if (!target) return;
		const slot = ctx.targetCrewSlot as 0 | 1 | undefined;
		if (slot === undefined) return;
		const crewId = target.crewIds[slot];
		if (!crewId || target.crewTurned[slot]) return;
		ctx.actor.warrantMarks.set(ownSlot, {
			targetPlayerId: target.playerId,
			targetSlot: slot,
			targetCrewId: crewId,
			turnsRemaining: 2,
		});
	},

	// sabotage: ctx.targetActiveMoveSlot is a dedicated 0-2 field, distinct
	// from targetCrewSlot (see EffectContext / play_move / chain_play_burst).
	// an empty slot, a slow-move slot, or no slot at all is a clean whiff —
	// the card still plays and still costs cash by design.
	discard_targeted_enemy_active_move(_effect, ctx) {
		const target = resolveTarget(ctx);
		if (!target) return;
		if (ctx.targetActiveMoveSlot === undefined) return;
		const slot = ctx.targetActiveMoveSlot;
		if (slot < 0 || slot > 2) return;
		const moveId = target.activeMoves[slot as 0 | 1 | 2];
		if (!moveId) return;
		target.activeMoves[slot as 0 | 1 | 2] = null;
		target.trickleDownTargets.delete(slot as 0 | 1 | 2);
		target.discardPile.push(moveId);
		target.totalCardsDiscarded++;
		recomputePassives(target, ctx.state);
	},

	// restock: harmless no-op reshuffle when the discard pile is empty,
	// guarded explicitly to avoid a pointless array-churn/shuffle call
	shuffle_discard_into_deck_then_draw(_effect, ctx) {
		if (ctx.actor.discardPile.length > 0) {
			ctx.actor.deck = shuffle([...ctx.actor.deck, ...ctx.actor.discardPile]);
			ctx.actor.discardPile = [];
		}
		drawCards(ctx.actor, 1);
	},

	// red herring: picks (or defaults to) a face-down slot, sets the
	// redirect mark, then discards itself out of the active zone
	// immediately — the card text's "then discard this Move" happens at
	// cast time, same slot-lookup trick passive_life_insurance uses above.
	choose_red_herring_crew(_effect, ctx) {
		const actor = ctx.actor;
		const slot =
			ctx.targetCrewSlot !== undefined
				? (ctx.targetCrewSlot as 0 | 1)
				: firstUnturnedSlot(actor);
		if (slot === null || !actor.crewIds[slot] || actor.crewTurned[slot]) {
			return;
		}
		const crewId = actor.crewIds[slot];
		actor.redHerringMark = { slot, crewId };

		if (ctx.moveId) {
			const activeSlot = actor.activeMoves.indexOf(ctx.moveId);
			if (activeSlot !== -1) {
				actor.activeMoves[activeSlot] = null;
				actor.discardPile.push(ctx.moveId);
				actor.totalCardsDiscarded++;
			}
		}
	},

	// my treat: requires a genuine teammate (moveHasLegalTarget already
	// guarantees this before the card can be cast); the null-check here is
	// defense in depth, not a real expected path
	gain_cash_and_draw_ally(effect, ctx) {
		if (effect.type !== "gain_cash_and_draw_ally") return;
		const target = resolveStrictAllyTarget(ctx);
		if (!target) return;
		target.cash += effect.cashAmount;
		drawCards(target, effect.drawAmount);
	},

	// win condition
	win_if_void_pieces_assembled(_effect, ctx) {
		if (!checkVoidPiecesAssembled(ctx.actor)) return;
		ctx.state.winnerId = ctx.actor.playerId;
		ctx.state.winCondition = "void_assembly";
		ctx.state.phase = "finished";
	},

	transform_andrew_into_wolfman(_effect, ctx) {
		const actor = ctx.actor;
		const slot = actor.crewIds.findIndex(
			(id, i) =>
				id === CARD_IDS.CREW.ANDREW &&
				actor.crewTurned[i as 0 | 1] &&
				!actor.disabledPassiveSlots.has(i as 0 | 1),
		);
		if (slot === -1) return;
		const s = slot as 0 | 1;
		actor.crewIds[s] = CARD_IDS.CREW.WOLFMAN;
		actor.crewTurned[s] = false;
		actor.crewClassOverrides.delete(s);
		actor.disabledPassiveSlots.delete(s);
		recomputePassives(actor, ctx.state);
	},

	give_ally_cash_then_optional_unturn(effect, ctx) {
		if (effect.type !== "give_ally_cash_then_optional_unturn") return;
		const target =
			ctx.targetPlayerId !== undefined
				? (ctx.state.players.get(ctx.targetPlayerId) ?? ctx.actor)
				: ctx.actor;
		target.cash += effect.cashAmount;

		const hasFaceUpCrew = target.crewIds.some(
			(id, i) => id !== null && target.crewTurned[i as 0 | 1],
		);
		if (!hasFaceUpCrew) return;

		const eligibleSlots = ([0, 1] as const).filter(
			(i) => target.crewIds[i] !== null && target.crewTurned[i],
		);
		ctx.state.pendingInteraction = {
			type: "tactical_support_unturn_offer",
			actorId: ctx.actor.playerId,
			targetPlayerId: target.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
	},

	discard_then_reactivate_ally_turned_effect(effect, ctx) {
		if (effect.type !== "discard_then_reactivate_ally_turned_effect") return;
		const discarded = discardFromHand(ctx.actor, effect.discardCost, ctx.state);
		if (discarded.length !== effect.discardCost) return;

		const eligibleSlots: number[] = [];
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			const crewId = ctx.actor.crewIds[slot];
			if (
				crewId &&
				ctx.actor.crewTurned[slot] &&
				!ctx.actor.crewSkillsDisabled
			) {
				eligibleSlots.push(slot);
			}
		}
		if (eligibleSlots.length === 0) return;
		ctx.state.pendingInteraction = {
			type: "crew_reactivate",
			actorId: ctx.actor.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
	},

	mutual_discard_hand_then_redraw_same_count(_effect, ctx) {
		const target = resolveTarget(ctx);
		const actorCount = ctx.actor.hand.length;
		discardFromHand(ctx.actor, actorCount, ctx.state);
		drawCards(ctx.actor, actorCount);

		if (target) {
			const targetCount = target.hand.length;
			discardFromHand(target, targetCount, ctx.state);
			drawCards(target, targetCount);
		}
	},
};

export function resolveVoidLegsChoice(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	confirmed: boolean,
	damage: number,
): void {
	if (!confirmed) return;
	if (actor.hand.length === 0) return;
	discardFromHand(actor, 1, state);
	const target = getEnemies(state, actor.playerId)[0];
	if (!target) return;
	applyDamage(state, target, damage, actor);
}

export function resolveChooseDiscardCount(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	count: number,
	maxCount: number,
	targetPlayerId: string,
	damagePerCard: number,
): void {
	if (count < 0 || count > maxCount) return;
	if (count > actor.hand.length) return;
	if (count > 0) discardFromHand(actor, count, state);
	const target = state.players.get(targetPlayerId);
	if (!target || state.eliminatedPlayers.has(targetPlayerId)) return;
	if (count > 0) applyDamage(state, target, count * damagePerCard, actor);
}

export function resolveChooseFromDiscard(
	actor: FaceturnServerPlayer,
	cardId: string,
	snapshot: readonly string[],
): void {
	if (!snapshot.includes(cardId)) return;
	const idx = actor.discardPile.indexOf(cardId);
	if (idx === -1) return;
	if (actor.hand.length >= C.HAND_LIMIT) return;
	actor.discardPile.splice(idx, 1);
	actor.hand.push(cardId);
}

export function resolveDigDeepPick(
	actor: FaceturnServerPlayer,
	cardIds: readonly string[],
	lookCount: number,
	maxPicks: number = 1,
): void {
	const topSlice = actor.deck.slice(0, lookCount);
	if (topSlice.length === 0) return;

	const picks = cardIds.slice(0, maxPicks);

	const availableCounts = new Map<string, number>();
	for (const id of topSlice) {
		availableCounts.set(id, (availableCounts.get(id) ?? 0) + 1);
	}

	const actuallyPicked: string[] = [];
	for (const cardId of picks) {
		const count = availableCounts.get(cardId) ?? 0;
		if (count <= 0) continue;
		availableCounts.set(cardId, count - 1);
		actuallyPicked.push(cardId);
	}

	if (actuallyPicked.length === 0) return;

	actor.deck.splice(0, lookCount);

	const remaining: string[] = [];
	for (const [id, count] of availableCounts) {
		for (let i = 0; i < count; i++) remaining.push(id);
	}

	for (const cardId of actuallyPicked) {
		if (actor.hand.length < C.HAND_LIMIT) {
			actor.hand.push(cardId);
		} else {
			remaining.push(cardId); // hand full, shuffle back
		}
	}

	actor.deck.push(...remaining);
	actor.deck = shuffle(actor.deck);
}

export function resolveSwitchUpPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	unturnSlot: number,
	turnSlot: number,
	faceUpSlots: readonly number[],
	faceDownSlots: readonly number[],
): void {
	if (unturnSlot === turnSlot) return;
	if (!faceUpSlots.includes(unturnSlot)) return;
	if (!faceDownSlots.includes(turnSlot)) return;
	unturnCrewAtSlot(state, actor, unturnSlot as 0 | 1);
	recomputePassives(actor, state);
	turnCrewAtSlot(state, actor, turnSlot as 0 | 1);
	recomputePassives(actor, state);
	triggerCrewTurnedEffects(state, actor, turnSlot as 0 | 1);
}

export function resolveTacticalSupportUnturn(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	slot: number | null,
	eligibleSlots: readonly number[],
): void {
	if (slot === null) return; // declined
	if (!eligibleSlots.includes(slot)) return;
	unturnCrewAtSlot(state, target, slot as 0 | 1);
	recomputePassives(target, state);
}

// watcher passive: unturns a face-up crew of the actor or a teammate, from a server-computed allowlist
export function resolveWatcherUnturn(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	targetPlayerId: string | null,
	slot: number | null,
	eligibleTargets: readonly { playerId: string; slot: number }[],
): void {
	if (slot === null) return;
	const resolvedPlayerId = targetPlayerId ?? actor.playerId;
	const isEligible = eligibleTargets.some(
		(t) => t.playerId === resolvedPlayerId && t.slot === slot,
	);
	if (!isEligible) return;
	const target =
		resolvedPlayerId === actor.playerId
			? actor
			: state.players.get(resolvedPlayerId);
	if (!target) return;
	unturnCrewAtSlot(state, target, slot as 0 | 1);
	recomputePassives(target, state);
}

export function resolveTagOutPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	teammate: FaceturnServerPlayer,
	ownSlot: number,
	teammateSlot: number,
	ownEligibleSlots: readonly number[],
	teammateEligibleSlots: readonly number[],
): void {
	if (!ownEligibleSlots.includes(ownSlot)) return;
	if (!teammateEligibleSlots.includes(teammateSlot)) return;
	const oSlot = ownSlot as 0 | 1;
	const tSlot = teammateSlot as 0 | 1;

	const ownId = actor.crewIds[oSlot];
	const ownTurned = actor.crewTurned[oSlot];
	const ownOverrides = actor.crewClassOverrides.get(oSlot);

	const teammateId = teammate.crewIds[tSlot];
	const teammateTurned = teammate.crewTurned[tSlot];
	const teammateOverrides = teammate.crewClassOverrides.get(tSlot);

	actor.crewIds[oSlot] = teammateId;
	actor.crewTurned[oSlot] = teammateTurned;
	if (teammateOverrides) actor.crewClassOverrides.set(oSlot, teammateOverrides);
	else actor.crewClassOverrides.delete(oSlot);

	teammate.crewIds[tSlot] = ownId;
	teammate.crewTurned[tSlot] = ownTurned;
	if (ownOverrides) teammate.crewClassOverrides.set(tSlot, ownOverrides);
	else teammate.crewClassOverrides.delete(tSlot);

	recomputePassives(actor, state);
	recomputePassives(teammate, state);
}

export function resolveTooBigSwapPick(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	ownSlot: number,
	targetPlayerId: string,
	targetSlot: number,
	eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[],
): void {
	const isEligible = eligibleTargets.some(
		(t) => t.playerId === targetPlayerId && t.slot === targetSlot,
	);
	if (!isEligible) return;
	const target = state.players.get(targetPlayerId);
	if (!target) return;
	const oSlot = ownSlot as 0 | 1;
	const tSlot = targetSlot as 0 | 1;

	const ownId = actor.crewIds[oSlot];
	const ownTurned = actor.crewTurned[oSlot];
	const ownOverrides = actor.crewClassOverrides.get(oSlot);

	const targetId = target.crewIds[tSlot];
	const targetTurned = target.crewTurned[tSlot];
	const targetOverrides = target.crewClassOverrides.get(tSlot);

	actor.crewIds[oSlot] = targetId;
	actor.crewTurned[oSlot] = targetTurned;
	if (targetOverrides) actor.crewClassOverrides.set(oSlot, targetOverrides);
	else actor.crewClassOverrides.delete(oSlot);

	target.crewIds[tSlot] = ownId;
	target.crewTurned[tSlot] = ownTurned;
	if (ownOverrides) target.crewClassOverrides.set(tSlot, ownOverrides);
	else target.crewClassOverrides.delete(tSlot);

	recomputePassives(actor, state);
	recomputePassives(target, state);
}

// checks if any enemy has a face-up, unsuppressed lighthouse suppressing turned effects
function isTurnedEffectSuppressedByEnemyLighthouse(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): boolean {
	for (const enemy of getEnemies(state, player.playerId)) {
		if (enemy.crewSkillsDisabled) continue;
		for (const i of [0, 1] as const) {
			if (enemy.crewIds[i] !== CARD_IDS.CREW.LIGHTHOUSE) continue;
			if (!enemy.crewTurned[i]) continue;
			if (enemy.disabledPassiveSlots.has(i)) continue;
			return true;
		}
	}
	return false;
}

// consumes/discards the first enemy Cease & Desist move; unaffected by Blackmail since it’s a Move effect, only trigger when a turned effect is resolving
function consumeCeaseDesistIfPresent(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): boolean {
	for (const enemy of getEnemies(state, player.playerId)) {
		if (!enemy.hasCeaseDesist) continue;
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

export function resolveLighthouseDisablePick(
	state: FaceturnServerState,
	targetPlayerId: string,
	slot: number,
	eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[],
): void {
	const isEligible = eligibleTargets.some(
		(t) => t.playerId === targetPlayerId && t.slot === slot,
	);
	if (!isEligible) return;
	const target = state.players.get(targetPlayerId);
	if (!target) return;
	const crewSlot = slot as 0 | 1;
	if (!target.crewIds[crewSlot]) return;
	if (!target.crewTurned[crewSlot]) return;
	target.disabledPassiveSlots.add(crewSlot);
	recomputePassives(target, state);
}

// truth serum reveals base class; overrides can't apply to face-down crew
export function resolveTruthSerumReveal(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	slot: number,
	eligibleSlots: readonly number[],
): { revealedSlot: number; revealedClass: CrewClass } | null {
	if (!eligibleSlots.includes(slot)) return null;
	const crewId = target.crewIds[slot as 0 | 1];
	if (!crewId) return null;
	const revealedClass = getCrew(crewId).class;
	void state;
	return { revealedSlot: slot, revealedClass };
}

const BEAR_BONES_STRIKE_CASH_COST = 3;

// opens bear bones bonus strike offer if face-up and affordable
export function maybeOpenBearBonesOffer(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	defeatedPlayerId: string,
): void {
	if (actor.crewSkillsDisabled) return;
	const slot = actor.crewIds.findIndex((id) => id === CARD_IDS.CREW.BEAR_BONES);
	if (slot === -1) return;
	if (!actor.crewTurned[slot as 0 | 1]) return;
	if (actor.disabledPassiveSlots.has(slot as 0 | 1)) return;
	if (!state.players.has(defeatedPlayerId)) return;
	if (state.eliminatedPlayers.has(defeatedPlayerId)) return;
	if (actor.cash < BEAR_BONES_STRIKE_CASH_COST) return;

	state.pendingInteraction = {
		type: "bear_bones_bonus_strike",
		actorId: actor.playerId,
		eligibleTargetIds: [defeatedPlayerId],
		cashCost: BEAR_BONES_STRIKE_CASH_COST,
	};
}

export function resolveBearBonesBonusStrike(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	confirmed: boolean,
	targetPlayerId: string | null,
	targetSlot: number | null,
): StrikeOrExecuteOutcome | null {
	if (!confirmed) return null;
	if (!targetPlayerId) return null;
	if (actor.cash < BEAR_BONES_STRIKE_CASH_COST) return null;
	const target = state.players.get(targetPlayerId);
	if (!target || state.eliminatedPlayers.has(targetPlayerId)) return null;

	actor.cash -= BEAR_BONES_STRIKE_CASH_COST;
	const outcome = resolveStrikeOrExecute(
		state,
		target,
		actor.playerId,
		true,
		targetSlot !== null ? (targetSlot as 0 | 1) : undefined,
	);
	// a bonus strike still counts as a strike for blood money
	applyBloodMoneyOnStrike(state, actor);
	return outcome;
}

// background check: wrong guess auto-turns one of the guesser's own crew
export function resolveBackgroundCheckGuess(
	state: FaceturnServerState,
	challenger: FaceturnServerPlayer,
	target: FaceturnServerPlayer,
	guessedSlot: number,
	guessedClass: "striker" | "defender" | "collector" | "unturner",
	eligibleSlots: readonly number[],
): { correct: boolean } {
	if (!eligibleSlots.includes(guessedSlot)) return { correct: false };
	const slot = guessedSlot as 0 | 1;
	const matches = resolveCrewClass(target, slot, guessedClass) === true;
	if (!matches) {
		const ownSlot =
			firstUnturnedSlot(challenger) ?? firstTurnedSlot(challenger);
		if (ownSlot !== null) {
			turnCrewAtSlot(state, challenger, ownSlot);
			recomputePassives(challenger, state);
			triggerCrewTurnedEffects(state, challenger, ownSlot);
		}
	}
	return { correct: matches };
}

// warrant of Arrest: on turn start, decrements marks; resolves/discards when countdown hits 0 or crew is invalidated, ensuring cards leave play once their purpose is moot without double‑discard
export function processWarrantOfArrestTicks(
	state: FaceturnServerState,
	caster: FaceturnServerPlayer,
): void {
	for (const [ownSlot, mark] of [...caster.warrantMarks]) {
		if (caster.activeMoves[ownSlot] !== CARD_IDS.MOVE.WARRANT_OF_ARREST) {
			caster.warrantMarks.delete(ownSlot);
			continue;
		}

		mark.turnsRemaining--;
		if (mark.turnsRemaining > 0) continue;

		caster.warrantMarks.delete(ownSlot);
		caster.activeMoves[ownSlot] = null;
		caster.discardPile.push(CARD_IDS.MOVE.WARRANT_OF_ARREST);
		caster.totalCardsDiscarded++;
		recomputePassives(caster, state);

		const target = state.players.get(mark.targetPlayerId);
		if (!target || state.eliminatedPlayers.has(mark.targetPlayerId)) continue;
		if (target.crewIds[mark.targetSlot] !== mark.targetCrewId) continue;
		if (target.crewTurned[mark.targetSlot]) continue;

		// not a strike
		turnCrewAtSlot(state, target, mark.targetSlot);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, mark.targetSlot, true);
	}
}

// mama mercy armor ally boss on any ally crew turn; suplex strikes enemy crew only on ally's own turn (not forced)
function triggerAllyTurnReactions(
	state: FaceturnServerState,
	turner: FaceturnServerPlayer,
	causedByEnemy: boolean,
): void {
	for (const holder of getLivingPlayers(state)) {
		if (holder.crewSkillsDisabled) continue;
		const isSelfOrTeammate =
			holder.playerId === turner.playerId ||
			getTeammates(state, holder.playerId).some(
				(t) => t.playerId === turner.playerId,
			);
		if (!isSelfOrTeammate) continue;

		let mamaSlot: 0 | 1 | null = null;
		for (let i = 0; i < 2; i++) {
			if (holder.crewIds[i as 0 | 1] === CARD_IDS.CREW.MAMA_MERCY) {
				mamaSlot = i as 0 | 1;
				break;
			}
		}
		if (mamaSlot === null) continue;
		if (!holder.crewTurned[mamaSlot]) continue;
		if (holder.disabledPassiveSlots.has(mamaSlot)) continue;

		const mamaArmorAmount = findEffectAmount(
			getCrew(CARD_IDS.CREW.MAMA_MERCY).passiveEffects,
			"passive_armor_on_ally_crew_turn",
		);
		holder.bossArmor += mamaArmorAmount;
		holder.hasArmoredBossThisGame = true;
	}

	if (!causedByEnemy) {
		for (const holder of getLivingPlayers(state)) {
			if (holder.crewSkillsDisabled) continue;
			const isSelfOrTeammate =
				holder.playerId === turner.playerId ||
				getTeammates(state, holder.playerId).some(
					(t) => t.playerId === turner.playerId,
				);
			if (!isSelfOrTeammate) continue;

			let suplexSlot: 0 | 1 | null = null;
			for (let i = 0; i < 2; i++) {
				if (holder.crewIds[i as 0 | 1] === CARD_IDS.CREW.SUPLEX) {
					suplexSlot = i as 0 | 1;
					break;
				}
			}
			if (suplexSlot === null) continue;
			if (!holder.crewTurned[suplexSlot]) continue;
			if (holder.disabledPassiveSlots.has(suplexSlot)) continue;

			resolveEffects([{ type: "strike_enemy_crew" }], { state, actor: holder });
		}
	}
}

export function triggerCrewTurnedEffects(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	slotIndex: 0 | 1,
	causedByEnemy = false,
): void {
	const crewId = player.crewIds[slotIndex];
	if (!crewId) return;
	if (player.crewSkillsDisabled) return;

	const crew = getCrew(crewId);
	const ctx: EffectContext = {
		state,
		actor: player,
		targetAllySlot: slotIndex,
		selfTurnedByEnemy: causedByEnemy,
	};

	resolveEffects(crew.passiveEffects, ctx);

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

export function triggerRoundEndPassives(state: FaceturnServerState): void {
	const living = getLivingPlayers(state);

	for (const player of living) {
		// tick incoming poison
		for (const [sourceId, damage] of player.incomingPoison) {
			if (state.eliminatedPlayers.has(sourceId)) {
				player.incomingPoison.delete(sourceId);
				continue;
			}
			const sourcePlayer = state.players.get(sourceId);
			if (!sourcePlayer) continue;
			applyDamage(state, player, damage, sourcePlayer);
		}

		if (player.bossImmunityTurns > 0) {
			player.bossImmunityTurns--;
		}

		// reset per-turn/round flags
		player.playedMoveThisTurn = false;
		player.classActionUsedThisTurn = false;
		player.ratQueenDrawUsedThisTurn = false;
		player.prankCallBonusUsedThisRound = false;
	}
}

export function resolveEffects(
	effects: readonly CardEffect[],
	ctx: EffectContext,
): void {
	let skipNext = false;

	for (const effect of effects) {
		if (skipNext) {
			skipNext = false;
			continue;
		}

		if (isConditionalEffect(effect)) {
			const ce = effect;
			const passes = evaluateCondition(ce.condition, ctx);
			const shouldRun = ce.negated ? !passes : passes;
			if (!shouldRun) continue;
			const handler = handlers[ce.effect.type];
			if (handler) {
				const result = handler(ce.effect, ctx);
				if (result === false) skipNext = true;
			}
		} else {
			const ep = effect;
			const handler = handlers[ep.type];
			if (handler) {
				const result = handler(ep, ctx);
				if (result === false) skipNext = true;
			}
		}
	}
}

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