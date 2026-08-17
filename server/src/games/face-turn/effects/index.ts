import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type {
	CardEffect,
	EffectPrimitive,
	ConditionalEffect,
	MoveCard,
} from "../cards";
import {
	getCrew,
	VOID_PIECE_IDS,
	getMoveTargetScope,
	unwrapEffect,
} from "../cards";
import { recomputePassives } from "../derived";
import { applyDamage } from "./damage";

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

// handlers may return false to skip the next unconditional primitive (used when discard must fully succeed)
export type Handler = (
	effect: EffectPrimitive,
	ctx: EffectContext,
) => boolean | void;

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
	"strike_own_crew",
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

// exported (was file-private in effects.ts) so category files can call it; behavior unchanged
export function resolveTarget(ctx: EffectContext): FaceturnServerPlayer | null {
	if (ctx.targetPlayerId) {
		const p = ctx.state.players.get(ctx.targetPlayerId);
		if (p && !ctx.state.eliminatedPlayers.has(p.playerId)) return p;
	}
	const enemies = getEnemies(ctx.state, ctx.actor.playerId);
	return enemies[0] ?? null;
}

// defaults to self when no valid ally target (safe for duel/ffa)
// exported (was file-private in effects.ts) so category files can call it; behavior unchanged
export function resolveAllyTarget(ctx: EffectContext): FaceturnServerPlayer {
	if (!ctx.targetPlayerId) return ctx.actor;
	if (ctx.targetPlayerId === ctx.actor.playerId) return ctx.actor;

	const candidate = ctx.state.players.get(ctx.targetPlayerId);
	if (!candidate) return ctx.actor;
	if (ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) return ctx.actor;

	const isAlly = candidate.teamIndex === ctx.actor.teamIndex;
	return isAlly ? candidate : ctx.actor;
}

// unlike resolveAllyTarget, never defaults to self, returns null if no living teammate
// exported (was file-private in effects.ts) so category files can call it; behavior unchanged
export function resolveStrictAllyTarget(
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
// exported (was file-private in effects.ts) so damage.ts/draw-discard.ts/strikes.ts can call it; behavior unchanged
export function findEffectAmount(
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

export function checkVoidPiecesAssembled(actor: FaceturnServerPlayer): boolean {
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

		case "has_bluffed_successfully":
			return actor.hasBluffedSuccessfully;

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
	const overrides = player.derived.crewClassOverrides.get(slot);
	if (cls) {
		if (overrides?.has(cls)) return true;
		return getCrew(crewId).class === cls;
	}
	return getCrew(crewId).class;
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
		const overrides = player.derived.crewClassOverrides.get(idx);
		if (overrides?.has(cls)) return true;
		if (player.crewTurned[idx]) return false;
		return getCrew(crewId).class === cls;
	});
}

import { damageHandlers } from "./damage";
import { strikeHandlers } from "./strikes";
import { crewTurnHandlers } from "./crew-turn";
import { drawDiscardHandlers } from "./draw-discard";
import { cashHandlers } from "./cash";
import { bossHpArmorHandlers } from "./boss-hp-armor";
import { readPeekHandlers } from "./read-peek";
import { moveChainHandlers } from "./move-chain";
import { miscHandlers } from "./misc";

// assembled, spread-together map: a missing EffectPrimitive variant in any
// category file below is a compile error here. see Part 2 of the refactor
// plan for why. mechanics: each category file's exported *Handlers const
// uses `satisfies Partial<Record<...>>` rather than a `: Partial<Record<...>>`
// annotation, so its inferred type keeps only the keys actually present
// (an explicit Partial<Record<...>> annotation would widen keyof back to
// every possible key, defeating this). AssembledKeys is therefore the real,
// narrow union of keys covered across every category file. _AssertExhaustive
// resolves to `true` only if that union covers all of EffectPrimitive["type"];
// otherwise it resolves to a tuple naming the missing type(s), which is not
// assignable from `true` and fails to compile. the final cast to the full
// Record is sound specifically because the line above already proved
// completeness — it isn't doing the checking itself.
const assembledHandlers = {
	...damageHandlers,
	...strikeHandlers,
	...crewTurnHandlers,
	...drawDiscardHandlers,
	...cashHandlers,
	...bossHpArmorHandlers,
	...readPeekHandlers,
	...moveChainHandlers,
	...miscHandlers,
} satisfies Partial<Record<EffectPrimitive["type"], Handler>>;

type AssembledKeys = keyof typeof assembledHandlers;
type _AssertExhaustive = EffectPrimitive["type"] extends AssembledKeys
	? true
	: [
			"missing handler(s) for effect type(s):",
			Exclude<EffectPrimitive["type"], AssembledKeys>,
		];
const _assertExhaustive: _AssertExhaustive = true;
void _assertExhaustive;

const handlers = assembledHandlers as Record<EffectPrimitive["type"], Handler>;

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
			const result = handlers[ce.effect.type](ce.effect, ctx);
			if (result === false) skipNext = true;
		} else {
			const ep = effect;
			const result = handlers[ep.type](ep, ctx);
			if (result === false) skipNext = true;
		}
	}
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
	}
}

export { recomputePassives };
export { resolveReflectedSlowMoveDamage } from "./move-chain";
export {
	turnCrewAtSlot,
	unturnCrewAtSlot,
	killCrewAtSlot,
	firstTurnedSlot,
	firstUnturnedSlot,
	isStrikeDefendedByTerminal,
	resolveStrikeOrExecute,
	performStrike,
	performSelfStrike,
	triggerCrewTurnedEffects,
	triggerBertoOnCrewKill,
	applyBloodMoneyOnStrike,
	executedPlayerIdFrom,
	resolveChooseOwnCrewToStrike,
	type StrikeOrExecuteOutcome,
} from "./strikes";
export {
	clampHp,
	applyDamage,
	applyDamageIgnoreArmor,
	applyResolvedDamageToBoss,
	applyPoisonToVictim,
} from "./damage";
export {
	drawCards,
	discardFromHand,
	checkRatQueenDrawTrigger,
	sellMoveFromHand,
} from "./draw-discard";
export {
	applySupplyDropOnCollect,
	applyTrickleDownOnCollect,
	applyCoolGuyDamageOnMovePlayed,
} from "./cash";
export {
	resolveWatcherStealPick,
	resolveTruthSerumReveal,
	resolveLighthouseDisablePick,
} from "./read-peek";
export {
	resolveVoidLegsChoice,
	resolveChooseDiscardCount,
	resolveChooseFromDiscard,
	resolveDigDeepPick,
	resolveSwitchUpPick,
	resolveTacticalSupportUnturn,
	resolveWatcherUnturn,
	resolveTagOutPick,
	resolveTooBigSwapPick,
	maybeOpenBearBonesOffer,
	resolveBearBonesBonusStrike,
	resolveBackgroundCheckGuess,
	processWarrantOfArrestTicks,
} from "./misc";