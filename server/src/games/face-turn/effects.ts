import type {
	FaceturnServerState,
	FaceturnServerPlayer,
	PendingInteraction,
} from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import type { CardEffect, EffectPrimitive, ConditionalEffect } from "./cards";
import { getCrew, getMove, getBoss, CARD_IDS, VOID_PIECE_IDS } from "./cards";
import type { CrewClass } from "../../../../shared/games/face-turn/types";
import { shuffle } from "../lib/random";

export interface EffectContext {
	state: FaceturnServerState;
	actor: FaceturnServerPlayer;
	targetPlayerId?: string | undefined;
	targetCrewSlot?: number | undefined;
	targetAllySlot?: number | undefined;
	moveId?: string | undefined;
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

function resolveTarget(ctx: EffectContext): FaceturnServerPlayer | null {
	if (ctx.targetPlayerId) {
		const p = ctx.state.players.get(ctx.targetPlayerId);
		if (p && !ctx.state.eliminatedPlayers.has(p.playerId)) return p;
	}
	const enemies = getEnemies(ctx.state, ctx.actor.playerId);
	return enemies[0] ?? null;
}

// resolves the ally-boss target for heal/shield/hp-set effects.
// falls back to the actor's own boss when no targetPlayerId is given, or
// when the given id is invalid, eliminated, or an enemy.
// this keeps every ally-targeted primitive safe to call from duel/ffa,
// where no explicit target is ever chosen, matching the "default to self"
// ui contract.
function resolveAllyTarget(ctx: EffectContext): FaceturnServerPlayer {
	if (!ctx.targetPlayerId) return ctx.actor;
	if (ctx.targetPlayerId === ctx.actor.playerId) return ctx.actor;

	const candidate = ctx.state.players.get(ctx.targetPlayerId);
	if (!candidate) return ctx.actor;
	if (ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) return ctx.actor;

	const isAlly = candidate.teamIndex === ctx.actor.teamIndex;
	return isAlly ? candidate : ctx.actor;
}

export function isConditionalEffect(e: CardEffect): e is ConditionalEffect {
	return "condition" in e && "effect" in e;
}

// finds the numeric amount field on the first primitive of a given type
// inside a card's effect list, unwrapping conditionals. used when a
// passive's magnitude needs to be read back from the card database rather
// than duplicated as a magic number at the trigger site, e.g. mama mercy's
// shield amount
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

// scans every living player's active moves for a live
// passive_disable_all_crew_skills source (Blackmail). crewSkillsDisabled is
// global — any player's Blackmail disables everyone's crew passives — so
// recomputePassives must resolve this up front, from the raw move list,
// rather than from the derived flag it is still in the middle of computing.
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

// conditions

function checkVoidPiecesAssembled(actor: FaceturnServerPlayer): boolean {
	return VOID_PIECE_IDS.every((id) => actor.activeMoves.includes(id));
}

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

		case "has_shielded_boss":
			return actor.bossShield > 0;

		case "void_pieces_assembled":
			return checkVoidPiecesAssembled(actor);

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
		case "has_shielded_boss":
			return player.bossShield > 0;
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
		default: {
			const _exhaustive: never = condition;
			return _exhaustive;
		}
	}
}

export function resolveCrewClass(
	player: FaceturnServerPlayer,
	slot: 0 | 1,
	cls?: "striker" | "blocker" | "collector" | "turner",
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
	// defensive fallback
	recomputePassives(target, state);
}

// damage pipeline: multiplier → reduction% → immunity (full negate) →
// shield absorb → life insurance (one-shot 1hp floor, consumes itself).
// unblockable bypasses shield, immunity, reduction; cannotBeMultiplied skips the
// actor's damageMultiplier.
function applyDamage(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
	unblockable = false,
	cannotBeMultiplied = false,
): number {
	let dmg =
		unblockable || cannotBeMultiplied
			? rawAmount
			: Math.floor(rawAmount * sourceActor.damageMultiplier);

	if (!unblockable) {
		if (target.damageReductionPercent > 0) {
			dmg = Math.floor(dmg * (1 - target.damageReductionPercent / 100));
		}
		if (target.bossImmunityTurns > 0) {
			return 0;
		}
		if (target.bossShield > 0) {
			const absorbed = Math.min(target.bossShield, dmg);
			target.bossShield -= absorbed;
			dmg -= absorbed;
		}
	}

	if (dmg <= 0) return 0;

	if (target.hasLifeInsurance && target.bossHp - dmg <= 0) {
		target.bossHp = 1;
		consumeLifeInsuranceProtecting(state, target);
		return rawAmount;
	}

	target.bossHp = clampHp(target.bossHp - dmg, target.bossMaxHp);
	return dmg;
}

// piercing strike: bypasses shield but still respects immunity and
// reduction%
function applyDamageIgnoreShield(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	rawAmount: number,
	sourceActor: FaceturnServerPlayer,
): number {
	let dmg = Math.floor(rawAmount * sourceActor.damageMultiplier);

	if (target.bossImmunityTurns > 0) return 0;
	if (target.damageReductionPercent > 0) {
		dmg = Math.floor(dmg * (1 - target.damageReductionPercent / 100));
	}
	if (dmg <= 0) return 0;

	if (target.hasLifeInsurance && target.bossHp - dmg <= 0) {
		target.bossHp = 1;
		consumeLifeInsuranceProtecting(state, target);
		return rawAmount;
	}

	target.bossHp = clampHp(target.bossHp - dmg, target.bossMaxHp);
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
	const beforeCount = player.totalCardsDiscarded;
	const toDiscard = player.hand.splice(0, Math.min(count, player.hand.length));
	player.discardPile.push(...toDiscard);
	player.totalCardsDiscarded += toDiscard.length;
	for (const id of toDiscard) player.costOverrides.delete(id);

	if (toDiscard.length > 0) {
		maybeTriggerDoctorNorman(player, beforeCount);
		checkVanessaDrawTrigger(player, state);
	}

	return toDiscard;
}

const DOCTOR_NORMAN_TRIGGER_DISCARD_COUNT = 4;

function maybeTriggerDoctorNorman(
	player: FaceturnServerPlayer,
	beforeCount: number,
): void {
	if (player.doctorNormanTriggered) return;
	if (beforeCount >= DOCTOR_NORMAN_TRIGGER_DISCARD_COUNT) return;
	if (player.totalCardsDiscarded < DOCTOR_NORMAN_TRIGGER_DISCARD_COUNT) return;
	const slot = player.crewIds.findIndex(
		(id) => id === CARD_IDS.CREW.DOCTOR_NORMAN,
	);
	if (slot === -1) return;
	if (!player.crewTurned[slot as 0 | 1]) return;
	if (player.crewSkillsDisabled) return;
	if (player.disabledPassiveSlots.has(slot as 0 | 1)) return;
	player.bossHp = player.bossMaxHp;
	player.doctorNormanTriggered = true;
}

export function checkVanessaDrawTrigger(
	player: FaceturnServerPlayer,
	_state: FaceturnServerState,
): void {
	if (player.hand.length !== 0) return;
	if (player.vanessaDrawUsedThisTurn) return;
	const slot = player.crewIds.findIndex(
		(id) => id === CARD_IDS.CREW.VANESSA_DE_VERA,
	);
	if (slot === -1) return;
	if (!player.crewTurned[slot as 0 | 1]) return;
	if (player.crewSkillsDisabled) return;
	if (player.disabledPassiveSlots.has(slot as 0 | 1)) return;
	player.vanessaDrawUsedThisTurn = true;

	const amount = findEffectAmount(
		getCrew(CARD_IDS.CREW.VANESSA_DE_VERA).passiveEffects,
		"passive_draw_on_hand_empty_once_per_turn",
	);
	drawCards(player, amount);
}

export function turnCrewAtSlot(
	player: FaceturnServerPlayer,
	slot: 0 | 1,
): void {
	if (!player.crewIds[slot]) return;
	player.crewTurned[slot] = true;
	player.hasTurnedAllyCrewThisGame = true;
}

export function unturnCrewAtSlot(
	player: FaceturnServerPlayer,
	slot: 0 | 1,
): void {
	if (!player.crewIds[slot]) return;
	player.crewTurned[slot] = false;
	// lighthouse's disable expires when the disabled crew turns face-down.
	player.disabledPassiveSlots.delete(slot);
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

export function playerHasClass(
	player: FaceturnServerPlayer,
	cls: "striker" | "blocker" | "collector" | "turner",
): boolean {
	return player.crewIds.some((crewId, i) => {
		if (!crewId) return false;
		const idx = i as 0 | 1;
		if (player.disabledPassiveSlots.has(idx)) return false;
		const overrides = player.crewClassOverrides.get(idx);
		if (overrides?.has(cls)) return true;
		return getCrew(crewId).class === cls;
	});
}

// unified strike / execute resolution

export type StrikeOrExecuteOutcome =
	| { outcome: "crew_turned"; slot: 0 | 1 }
	| { outcome: "pending" }
	| { outcome: "executed"; survivedViaLifeInsurance: boolean }
	| { outcome: "negated"; negatedBy: "terminal" | "immunity" };

// single source of truth: used by both the strike resolver and the
// declare-time gate, so they can never disagree.
export function isStrikeBlockedByTerminal(
	target: FaceturnServerPlayer,
): boolean {
	return target.hasTerminalStrikeBlock && target.bossHp > 50;
}

// turns a face-down enemy crew slot face-up, or, if none are left, attempts to execute their boss
export function resolveStrikeOrExecute(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	actorId: string | null,
	isStrike: boolean,
	preSelectedSlot?: 0 | 1,
): StrikeOrExecuteOutcome {
	if (isStrikeBlockedByTerminal(target)) {
		return { outcome: "negated", negatedBy: "terminal" };
	}

	const unturnedSlots = ([0, 1] as const).filter(
		(i) => target.crewIds[i] !== null && !target.crewTurned[i],
	);

	const resolvedPreSelected =
		preSelectedSlot !== undefined && unturnedSlots.includes(preSelectedSlot)
			? preSelectedSlot
			: null;

	let result: StrikeOrExecuteOutcome;

	if (resolvedPreSelected !== null) {
		turnCrewAtSlot(target, resolvedPreSelected);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, resolvedPreSelected);
		result = { outcome: "crew_turned", slot: resolvedPreSelected };
	} else if (unturnedSlots.length === 1) {
		const slot = unturnedSlots[0]!;
		turnCrewAtSlot(target, slot);
		recomputePassives(target, state);
		triggerCrewTurnedEffects(state, target, slot);
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
		};
		return { outcome: "pending" }; // blood money deferred to interaction resolution
	} else if (target.bossImmunityTurns > 0) {
		return { outcome: "negated", negatedBy: "immunity" }; // no blood money
	} else if (target.hasLifeInsurance) {
		target.bossHp = 1;
		consumeLifeInsuranceProtecting(state, target);
		result = { outcome: "executed", survivedViaLifeInsurance: true };
	} else {
		target.bossHp = 0;
		result = { outcome: "executed", survivedViaLifeInsurance: false };
	}

	if (isStrike && actorId) {
		const striker = state.players.get(actorId);
		if (striker) applyBloodMoneyOnStrike(state, striker);
	}
	return result;
}

// gives cash to every enemy with the blood money passive whenever the
// striker performs a strike, covering class-action strikes and
// card-driven strikes.
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

// grants cash to the team whenever any collector class action resolves
// somewhere, for every living player with the supply drop passive who
// shares a team with the collector.
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

// trickle-down economics
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

// resolves a strike via the unified resolver, returning the outcome so
// callers can build a lastResolution.
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

// centralised helper so every place that constructs a ResolutionResult
// answers "did this action execute someone's boss?" identically.
export function executedPlayerIdFrom(
	outcome: StrikeOrExecuteOutcome | null | undefined,
	targetPlayerId: string,
): string | null {
	return outcome?.outcome === "executed" ? targetPlayerId : null;
}

// passive recompute

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
		case "passive_shield_per_turn":
			player.shieldPerTurn += effect.amount;
			break;
		case "passive_damage_multiplier":
			player.damageMultiplier *= effect.multiplier;
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
		case "passive_block_strikes_above_half_hp":
			player.hasTerminalStrikeBlock = true;
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
		// event-triggered / once-per-game / interaction-driven passives
		// don't accumulate a derived stat — their presence is checked live
		// at the trigger site. nothing to do here.
		case "passive_mirror_enemy_collect_cash":
		case "passive_poison_per_round":
		case "passive_shield_on_enemy_striker_turned":
		case "passive_full_heal_on_sixth_discard_once":
		case "passive_draw_on_hand_empty_once_per_turn":
		case "passive_unturn_self_on_first_successful_challenge_call":
		case "passive_optional_strike_on_successful_challenge":
			break;
	}
}

// all passive stats are derived — reset then re-accumulate from every source
// also scans every OTHER living player's state twice
export function recomputePassives(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): void {
	player.cashGainPerTurn = 0;
	player.drawPerTurn = 0;
	player.cashOnEnemyMoveOrStrike = 0;
	player.healOnMovePlayed = 0;
	player.crewSkillsDisabled = false;
	player.damageMultiplier = 1;
	player.damageReductionPercent = 0;
	player.shieldPerTurn = 0;
	player.moveBaseCostReduction = 0;
	player.hasVoidArms = false;
	player.hasSupplyDrop = false;
	player.supplyDropCashAmount = 0;
	player.hasLifeInsurance = false;
	player.hasFalseFlag = false;
	player.hasVoidLegsChoice = false;
	player.voidLegsDiscardCost = 0;
	player.voidLegsDamage = 0;
	player.hasBackgroundCheck = false;
	player.hasPrankCall = false;
	player.prankCallBonusAmount = 0;
	player.hasTerminalStrikeBlock = false;

	// clean up inbound poison from eliminated or inactive sources
	const playersWithActivePoisonSource = new Set<string>();
	for (const p of state.players.values()) {
		const hasPoisonFromCrew = p.crewIds.some((crewId, i) => {
			if (!crewId || !p.crewTurned[i as 0 | 1]) return false;
			if (p.crewSkillsDisabled || p.disabledPassiveSlots.has(i as 0 | 1))
				return false;
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

	// resolve crewSkillsDisabled before building passiveSources: crew
	// passives must be filtered by the fully-resolved value, not by a flag
	// a later entry in this same pass (e.g. Blackmail) hasn't set yet.
	const crewSkillsDisabledNow = hasActiveCrewSkillsDisableSource(player, state);
	player.crewSkillsDisabled = crewSkillsDisabledNow;

	const passiveSources: readonly (readonly CardEffect[])[] = [
		...(player.bossId ? [getBoss(player.bossId).passiveEffects] : []),
		...player.crewIds.flatMap((crewId, i) => {
			const slot = i as 0 | 1;
			if (!crewId || !player.crewTurned[slot]) return [];
			if (crewSkillsDisabledNow) return [];
			// lighthouse: skip this slot's passive contribution entirely while
			// disabled, even though the crew is otherwise face-up and legal.
			if (player.disabledPassiveSlots.has(slot)) return [];
			return [getCrew(crewId).passiveEffects];
		}),
		...player.activeMoves.flatMap((moveId) => {
			if (!moveId) return [];
			return [getMove(moveId).effects];
		}),
	];

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
			// passive_poison_per_round is applied at round end via
			// incomingPoison, never as a derived stat — skip it here.
			if (effect.type === "passive_poison_per_round") continue;
			recomputePassiveSwitch(effect, player, state);
		}
	}

	// life insurance: derived from OTHER players' lifeInsuranceTargets maps,
	// not from the player's own activeMoves — the caster and the protected
	// ally can differ (teams mode). check self, then every living teammate.
	const insuranceCandidates = [player, ...getTeammates(state, player.playerId)];
	player.hasLifeInsurance = insuranceCandidates.some((candidate) =>
		[...candidate.lifeInsuranceTargets.values()].includes(player.playerId),
	);
}

// applies n poison from `source` onto `victim`'s incomingPoison map,
// stacking additively with any existing poison from the same source.
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

// primitive handlers
//
// a handler may return `false` to signal "this primitive fizzled — do not
// run the next unconditional primitive in this same effects array." this is
// how "discard n. if you do, <payoff>" cards (black fist, cash out) work:
// the discard handler returns false when it couldn't discard the full
// requested amount, and resolveEffects skips exactly the next entry.

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
			effect.unblockable,
			effect.cannotBeMultiplied,
		);
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

	deal_damage_ignore_shield(effect, ctx) {
		if (effect.type !== "deal_damage_ignore_shield") return;
		const target = resolveTarget(ctx);
		if (!target) return;
		applyDamageIgnoreShield(ctx.state, target, effect.amount, ctx.actor);
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

	// strikes
	strike_enemy_crew(_effect, ctx) {
		performStrike(ctx);
	},

	strike_enemy_crew_unblockable_with_cash_cost(effect, ctx) {
		if (effect.type !== "strike_enemy_crew_unblockable_with_cash_cost") return;
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
		turnCrewAtSlot(target, slot);
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
		turnCrewAtSlot(ctx.actor, slot);
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
			turnCrewAtSlot(actor, slot);
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
		unturnCrewAtSlot(ctx.actor, slot);
		recomputePassives(ctx.actor, ctx.state);
	},

	unturn_other_ally_crew(_effect, ctx) {
		const triggeringSlot = ctx.targetAllySlot;
		if (triggeringSlot === undefined) return;
		const otherSlot = (1 - triggeringSlot) as 0 | 1;
		if (!ctx.actor.crewIds[otherSlot]) return;
		if (!ctx.actor.crewTurned[otherSlot]) return;
		unturnCrewAtSlot(ctx.actor, otherSlot);
		recomputePassives(ctx.actor, ctx.state);
	},

	unturn_then_retrigger_ally(_effect, ctx) {
		const slot =
			ctx.targetAllySlot !== undefined
				? (ctx.targetAllySlot as 0 | 1)
				: firstTurnedSlot(ctx.actor);
		if (slot === null) return;
		unturnCrewAtSlot(ctx.actor, slot);
		recomputePassives(ctx.actor, ctx.state);
		turnCrewAtSlot(ctx.actor, slot);
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
		if (faceUpSlots.length === 0 || faceDownSlots.length === 0) return; // fizzle
		ctx.state.pendingInteraction = {
			type: "switch_up_pick",
			actorId: actor.playerId,
			faceUpSlots,
			faceDownSlots,
		} satisfies PendingInteraction;
	},

	offer_optional_ally_unturn_choice(_effect, ctx) {
		// handles: both slots are guaranteed face-up here (the
		// another_ally_is_turned condition wrapping this primitive already
		// confirmed the other slot is face-up, and this primitive only runs
		// as handles' own turned effect — meaning handles' own slot, the one
		// that triggered this, is also face-up by definition). still genuinely
		// offer both slots rather than assuming which one the player wants
		// turned down.
		const actor = ctx.actor;
		const eligibleSlots = ([0, 1] as const).filter(
			(i) => actor.crewIds[i] !== null && actor.crewTurned[i],
		);
		if (eligibleSlots.length === 0) return; // defensive fizzle
		ctx.state.pendingInteraction = {
			type: "handles_unturn_offer",
			actorId: actor.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
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
		const beforeCount = target.totalCardsDiscarded;
		const discarded = target.hand.splice(0);
		target.discardPile.push(...discarded);
		target.totalCardsDiscarded += discarded.length;
		for (const id of discarded) target.costOverrides.delete(id);
		ctx.state.lastEnemyHandDiscardCount = discarded.length;
		if (discarded.length > 0) {
			maybeTriggerDoctorNorman(target, beforeCount);
			checkVanessaDrawTrigger(target, ctx.state);
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
		if (ctx.actor.discardPile.length === 0) return; // fizzle
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
		actor.costOverrides.set(effect.cardId, 0);
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

	set_both_cash_zero_then_draw(effect, ctx) {
		if (effect.type !== "set_both_cash_zero_then_draw") return;
		ctx.actor.cash = 0;
		const target = resolveTarget(ctx);
		if (target) target.cash = 0;
		drawCards(ctx.actor, effect.drawAmount);
	},

	// boss hp / shield
	heal_boss(effect, ctx) {
		if (effect.type !== "heal_boss") return;
		const target = resolveAllyTarget(ctx);
		target.bossHp = clampHp(target.bossHp + effect.amount, target.bossMaxHp);
	},

	shield_boss(effect, ctx) {
		if (effect.type !== "shield_boss") return;
		const target = resolveAllyTarget(ctx);
		target.bossShield += effect.amount;
		target.hasShieldedBossThisGame = true;
	},

	remove_all_shields(effect, ctx) {
		if (effect.type !== "remove_all_shields") return;
		if (effect.target === "enemy_boss") {
			const target = resolveTarget(ctx);
			if (!target) return;
			target.bossShield = 0;
		} else {
			ctx.actor.bossShield = 0;
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
		if (eligibleSlots.length === 0) return; // fizzle: no face-down crew
		ctx.state.pendingInteraction = {
			type: "truth_serum_reveal",
			actorId: ctx.actor.playerId,
			targetPlayerId: target.playerId,
			eligibleSlots,
		} satisfies PendingInteraction;
	},

	// replace a face-up ally crew with the player's reserved (draft-time)
	// crew card; new crew enters face-down, no turned effects. purely a
	// descriptive marker in commandEffects — the real logic is
	// special-cased in engine.ts's use_boss_command dispatch (boss.id ===
	// "the-dealer"), same pattern as command_guess_crew_class_turn_if_correct.
	negate_enemy_slow_move() {},
	reflect_slow_move_base_damage() {},

	// passives
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
	passive_shield_per_turn() {},
	passive_optional_discard_for_damage_per_turn() {},
	passive_damage_multiplier() {},
	passive_negate_damage_percent() {},
	passive_reduce_all_move_costs() {},
	passive_disable_all_crew_skills() {},
	passive_defender_chooses_crew_to_turn() {},
	passive_background_check() {},
	passive_bonus_cash_on_first_bluff_per_round() {},
	passive_team_cash_on_ally_collect() {},
	passive_life_insurance(_effect, ctx) {
		// life insurance active-move target lock-in. the cast-time target
		// (self or teammate) is stored in lifeInsuranceTargets, keyed by the
		// slot this card just landed in.
		if (!ctx.moveId) return;
		const slot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (slot === -1) return; // defensive
		const protectedAlly = resolveAllyTarget(ctx);
		ctx.actor.lifeInsuranceTargets.set(slot, protectedAlly.playerId);
	},
	passive_mirror_enemy_collect_cash(_effect, ctx) {
		// trickle-down economics active-move target lock-in, mirrors
		// passive_life_insurance's pattern: the cast-time enemy target is
		// stored in trickleDownTargets, keyed by the slot this card just
		// landed in.
		if (!ctx.moveId) return;
		const slot = ctx.actor.activeMoves.indexOf(ctx.moveId) as 0 | 1 | 2 | -1;
		if (slot === -1) return; // defensive
		if (!ctx.targetPlayerId) return; // fizzle: no enemy targeted at cast time
		const target = ctx.state.players.get(ctx.targetPlayerId);
		if (!target || ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) return;
		ctx.actor.trickleDownTargets.set(slot, ctx.targetPlayerId);
	},
	passive_false_flag() {},
	passive_block_strikes_above_half_hp() {},
	passive_full_heal_on_sixth_discard_once() {},
	passive_draw_on_hand_empty_once_per_turn() {},
	passive_watcher_unturn_on_challenge_win() {},
	passive_unturn_self_on_first_successful_challenge_call() {},
	passive_optional_strike_on_successful_challenge() {},

	// win conditions
	win_if_void_pieces_assembled(_effect, ctx) {
		// fizzle if not assembled, but the card is still discarded
		if (!checkVoidPiecesAssembled(ctx.actor)) return;
		ctx.state.winnerId = ctx.actor.playerId;
		ctx.state.winCondition = "void_assembly";
		ctx.state.phase = "finished";
	},

	become_also_striker(_effect, ctx) {
		const slot = (ctx.targetAllySlot ?? 0) as 0 | 1;
		const existing = ctx.actor.crewClassOverrides.get(slot) ?? new Set();
		existing.add("striker");
		ctx.actor.crewClassOverrides.set(slot, existing);
		recomputePassives(ctx.actor, ctx.state);
	},

	become_also_turner(_effect, ctx) {
		const slot = (ctx.targetAllySlot ?? 0) as 0 | 1;
		const existing = ctx.actor.crewClassOverrides.get(slot) ?? new Set();
		existing.add("turner");
		ctx.actor.crewClassOverrides.set(slot, existing);
		recomputePassives(ctx.actor, ctx.state);
	},

	transform_andrew_into_wolfman(_effect, ctx) {
		const actor = ctx.actor;
		const slot = actor.crewIds.findIndex(
			(id, i) =>
				id === CARD_IDS.CREW.ANDREW &&
				actor.crewTurned[i as 0 | 1] &&
				!actor.disabledPassiveSlots.has(i as 0 | 1),
		);
		if (slot === -1) return; // no face-up andrew, fizzle
		const s = slot as 0 | 1;
		actor.crewIds[s] = CARD_IDS.CREW.WOLFMAN;
		actor.crewTurned[s] = false;
		actor.crewClassOverrides.delete(s);
		actor.disabledPassiveSlots.delete(s);
		recomputePassives(actor, ctx.state);
	},

	// newly-required primitives
	disable_target_crew_passive(_effect, ctx) {
		let target: FaceturnServerPlayer | null = null;
		let slot: 0 | 1 | null = null;

		if (ctx.targetAllySlot !== undefined) {
			target = ctx.actor;
			slot = ctx.targetAllySlot as 0 | 1;
		} else if (ctx.targetPlayerId !== undefined) {
			target = ctx.state.players.get(ctx.targetPlayerId) ?? null;
			slot =
				ctx.targetCrewSlot !== undefined ? (ctx.targetCrewSlot as 0 | 1) : null;
		}

		if (!target || slot === null) return;
		if (!target.crewIds[slot]) return;
		target.disabledPassiveSlots.add(slot);
		recomputePassives(target, ctx.state);
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
		if (!hasFaceUpCrew) return; // no interaction opens

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
		if (discarded.length !== effect.discardCost) return; // not enough cards, fizzle

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

// exported resolutions

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
		if (count <= 0) continue; // not present (or already consumed), skip
		availableCounts.set(cardId, count - 1);
		actuallyPicked.push(cardId);
	}

	if (actuallyPicked.length === 0) return; // nothing valid picked, fizzle

	actor.deck.splice(0, lookCount); // remove the looked-at cards from the deck

	const remaining: string[] = [];
	for (const [id, count] of availableCounts) {
		for (let i = 0; i < count; i++) remaining.push(id);
	}

	for (const cardId of actuallyPicked) {
		if (actor.hand.length < C.HAND_LIMIT) {
			actor.hand.push(cardId);
		} else {
			remaining.push(cardId); // hand full — shuffle it back too rather than lose it
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
	unturnCrewAtSlot(actor, unturnSlot as 0 | 1);
	recomputePassives(actor, state);
	turnCrewAtSlot(actor, turnSlot as 0 | 1);
	recomputePassives(actor, state);
	triggerCrewTurnedEffects(state, actor, turnSlot as 0 | 1);
}

export function resolveTacticalSupportUnturn(
	state: FaceturnServerState,
	target: FaceturnServerPlayer,
	slot: number | null,
	eligibleSlots: readonly number[],
): void {
	if (slot === null) return; // actor declined
	if (!eligibleSlots.includes(slot)) return;
	unturnCrewAtSlot(target, slot as 0 | 1);
	recomputePassives(target, state);
}

// kept as a separate named function so the dispatch stays
// self-documenting about which card is firing, matching the pattern for
// tactical support.
export function resolveHandlesUnturnOffer(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	slot: number | null,
	eligibleSlots: readonly number[],
): void {
	if (slot === null) return; // actor declined — "may" honored
	if (!eligibleSlots.includes(slot)) return;
	unturnCrewAtSlot(actor, slot as 0 | 1);
	recomputePassives(actor, state);
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
	if (!target.crewTurned[crewSlot]) return; // must still be face-up
	target.disabledPassiveSlots.add(crewSlot);
	recomputePassives(target, state);
}

// gathers every currently face-up crew slot across every living player,
// for lighthouse's eligible-target pool.
function gatherFaceUpCrewSlots(
	state: FaceturnServerState,
): { playerId: string; slot: 0 | 1 }[] {
	const result: { playerId: string; slot: 0 | 1 }[] = [];
	for (const player of getLivingPlayers(state)) {
		for (const i of [0, 1] as const) {
			if (player.crewIds[i] && player.crewTurned[i]) {
				result.push({ playerId: player.playerId, slot: i });
			}
		}
	}
	return result;
}

// truth serum's resolution. a face-down crew can never have
// crewClassOverrides active yet (overrides are only granted inside
// turnedEffects, which only run once a crew turns face-up), so the crew's
// base getCrew(id).class is always the correct and complete answer here;
// resolveCrewClass's broader override-aware logic isn't needed.
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

// too big's once-per-game optional self-unturn. chains into bear bones:
// both passives trigger off the same event and the engine only supports
// one pendingInteraction at a time. too big resolves first (simpler
// yes/no, closer to "self"); if the same player also has bear bones
// face-up, this function opens bear_bones_bonus_strike immediately after,
// rather than silently dropping it. this ordering is a deliberate choice,
// not a limitation — if a player ever has both, too big's offer always
// comes first.
export function resolveTooBigUnturnOffer(
	state: FaceturnServerState,
	actor: FaceturnServerPlayer,
	confirmed: boolean,
	defeatedPlayerId: string,
): void {
	if (!actor.tooBigUnturnUsed) {
		actor.tooBigUnturnUsed = true; // once-per-game, consumed regardless of answer
		if (confirmed) {
			const slot = actor.crewIds.findIndex(
				(id) => id === CARD_IDS.CREW.TOO_BIG,
			);
			if (slot !== -1 && actor.crewTurned[slot as 0 | 1]) {
				unturnCrewAtSlot(actor, slot as 0 | 1);
				recomputePassives(actor, state);
			}
		}
	}

	maybeOpenBearBonesOffer(state, actor, defeatedPlayerId);
}

const BEAR_BONES_STRIKE_CASH_COST = 1;

// opens bear bones' bonus-strike offer if the actor has it face-up, isn't
// skill-disabled, and can afford the strike's cash cost.
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
	const slot =
		targetSlot !== null ? (targetSlot as 0 | 1) : firstUnturnedSlot(target);
	if (slot === null) return null;
	if (!target.crewIds[slot]) return null;
	actor.cash -= BEAR_BONES_STRIKE_CASH_COST;
	turnCrewAtSlot(target, slot);
	recomputePassives(target, state);
	triggerCrewTurnedEffects(state, target, slot);
	// per blood money's scoping rule: a bonus strike is still a strike.
	applyBloodMoneyOnStrike(state, actor);
	return { outcome: "crew_turned", slot };
}

// background check resolution: the challenger guesses a class for one of
// the challenged player's face-down crew slots. wrong guess auto-turns
// one of the guesser's own crew.
export function resolveBackgroundCheckGuess(
	state: FaceturnServerState,
	challenger: FaceturnServerPlayer,
	target: FaceturnServerPlayer,
	guessedSlot: number,
	guessedClass: "striker" | "blocker" | "collector" | "turner",
	eligibleSlots: readonly number[],
): { correct: boolean } {
	if (!eligibleSlots.includes(guessedSlot)) return { correct: false };
	const slot = guessedSlot as 0 | 1;
	const matches = resolveCrewClass(target, slot, guessedClass) === true;
	if (!matches) {
		const ownSlot =
			firstUnturnedSlot(challenger) ?? firstTurnedSlot(challenger);
		if (ownSlot !== null) {
			turnCrewAtSlot(challenger, ownSlot);
			recomputePassives(challenger, state);
			triggerCrewTurnedEffects(state, challenger, ownSlot);
		}
	}
	return { correct: matches };
}

// mama mercy's on‑turn shield trigger fires here; everything else routes
// through the crew's own turnedEffects/passiveEffects arrays via
// resolveEffects.
export function triggerCrewTurnedEffects(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
	slotIndex: 0 | 1,
): void {
	const crewId = player.crewIds[slotIndex];
	if (!crewId) return;
	if (player.crewSkillsDisabled) return;
	// lighthouse-disabled: turned effects still fire (disabling a passive
	// doesn't suppress the one-time turned trigger) — only the passive
	// contribution is skipped, handled by recomputePassives, not here.

	const crew = getCrew(crewId);
	const ctx: EffectContext = {
		state,
		actor: player,
		targetAllySlot: slotIndex,
	};

	resolveEffects(crew.passiveEffects, ctx);

	// lighthouse: disable_target_crew_passive can't be resolved generically
	// — it needs a real player choice spanning all face-up crew (ally or
	// enemy), not just "the slot that's already in context" like every
	// other turnedEffect. handle it here, then run the rest of lighthouse's
	// turnedEffects (currently none) through the normal path.
	const isLighthouse = crewId === CARD_IDS.CREW.LIGHTHOUSE;
	const turnedEffectsToResolve = isLighthouse
		? crew.turnedEffects.filter((e) => {
				const eff = isConditionalEffect(e) ? e.effect : e;
				return eff.type !== "disable_target_crew_passive";
			})
		: crew.turnedEffects;

	if (isLighthouse) {
		const eligibleTargets = gatherFaceUpCrewSlots(state);
		if (eligibleTargets.length <= 2) {
			for (const t of eligibleTargets) {
				resolveLighthouseDisablePick(
					state,
					t.playerId,
					t.slot,
					eligibleTargets,
				);
			}
		} else {
			state.pendingInteraction = {
				type: "lighthouse_disable_pick",
				actorId: player.playerId,
				eligibleTargets,
				maxPicks: 2,
			};
		}
	}

	resolveEffects(turnedEffectsToResolve, ctx);

	// mama mercy: whenever an enemy striker turns face-up, every enemy of the
	// turned player who has mama mercy face-up (and not skill-disabled) gets
	// shield.
	if (resolveCrewClass(player, slotIndex, "striker") === true) {
		const mamaShieldAmount = findEffectAmount(
			getCrew(CARD_IDS.CREW.MAMA_MERCY).passiveEffects,
			"passive_shield_on_enemy_striker_turned",
		);
		for (const enemy of getEnemies(state, player.playerId)) {
			let mamaSlot: 0 | 1 | null = null;
			for (let i = 0; i < 2; i++) {
				if (enemy.crewIds[i as 0 | 1] === CARD_IDS.CREW.MAMA_MERCY) {
					mamaSlot = i as 0 | 1;
					break;
				}
			}
			if (mamaSlot === null) continue;
			if (!enemy.crewTurned[mamaSlot]) continue;
			if (enemy.crewSkillsDisabled) continue;
			if (enemy.disabledPassiveSlots.has(mamaSlot)) continue;
			enemy.bossShield += mamaShieldAmount;
			enemy.hasShieldedBossThisGame = true;
		}
	}

	recomputePassives(player, state);
}

// round-end passives

export function triggerRoundEndPassives(state: FaceturnServerState): void {
	const living = getLivingPlayers(state);

	for (const player of living) {
		// inbound poison ticks
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

		// reset per‑turn / per‑round flags
		player.playedMoveThisTurn = false;
		player.classActionUsedThisTurn = false;
		player.vanessaDrawUsedThisTurn = false;
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

// reverse card's resolution. finds the targeted slow move's base
// deal_damage primitive (if any), applies it back at the move's own
// caster through that caster's own defenses — reduction%, immunity,
// shield all apply normally, since this is not unblockable; only the
// original caster's damageMultiplier is skipped (cannotBeMultiplied:
// true), matching "reflect its base damage."
//
// only the first deal_damage primitive on the move is reflected. every
// current slow move with damage (backstab, kamikaze) has at most one
// deal_damage entry.
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