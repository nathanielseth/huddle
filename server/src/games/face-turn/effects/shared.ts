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
	EFFECT_TARGETING,
	EFFECT_REQUIRES_CREW,
	CARD_IDS,
} from "../cards";

export interface EffectContext {
	state: FaceturnServerState;
	actor: FaceturnServerPlayer;
	targetPlayerId?: string | undefined;
	targetCrewSlot?: number | undefined;
	targetAllySlot?: number | undefined;
	targetActiveMoveSlot?: number | undefined;
	moveId?: string | undefined;
	selfTurnedByEnemy?: boolean | undefined;
	// damage handlers accumulate post-mitigation damage here for chain resolution
	damageAccumulator?: { value: number } | undefined;
}

// false skips the next unconditional primitive, used when discard must fully succeed
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

// derived from cards.ts EFFECT_TARGETING and EFFECT_REQUIRES_CREW
// single source of truth
function requiresOwnFaceDownCrew(move: MoveCard): boolean {
	return move.effects.some(
		(e) => EFFECT_REQUIRES_CREW[unwrapEffect(e).type] === "own_face_down",
	);
}

function requiresOwnFaceUpCrew(move: MoveCard): boolean {
	return move.effects.some(
		(e) => EFFECT_REQUIRES_CREW[unwrapEffect(e).type] === "own_face_up",
	);
}

function requiresOwnMixedCrew(move: MoveCard): boolean {
	return move.effects.some(
		(e) => EFFECT_REQUIRES_CREW[unwrapEffect(e).type] === "own_mixed",
	);
}

function requiresEnemyFaceDownCrew(move: MoveCard): boolean {
	return move.effects.some(
		(e) => EFFECT_REQUIRES_CREW[unwrapEffect(e).type] === "enemy_face_down",
	);
}

function requiresEnemyActiveMove(move: MoveCard): boolean {
	return move.effects.some(
		(e) => EFFECT_REQUIRES_CREW[unwrapEffect(e).type] === "enemy_active_move",
	);
}

export function requiresStrictAllyTarget(move: MoveCard): boolean {
	return move.effects.some((e) => {
		const targeting = EFFECT_TARGETING[unwrapEffect(e).type];
		return targeting.scope === "ally" && targeting.strict === true;
	});
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

// full moon needs face-up andrew specifically, not generic face-up
function hasOwnFaceUpAndrew(actor: FaceturnServerPlayer): boolean {
	return ([0, 1] as const).some(
		(i) =>
			actor.crewIds[i] === CARD_IDS.CREW.ANDREW &&
			actor.crewTurned[i] &&
			!actor.disabledPassiveSlots.has(i),
	);
}

function requiresOwnFaceUpAndrew(move: MoveCard): boolean {
	return move.effects.some(
		(e) => unwrapEffect(e).type === "transform_andrew_into_wolfman",
	);
}

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

			// swap_crew_with_teammate needs both actor and teammate to have filled crew slots
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

	if (requiresOwnFaceUpAndrew(move)) {
		const actor = state.players.get(actorId);
		if (!actor || !hasOwnFaceUpAndrew(actor)) return false;
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

export interface TargetScopeCheck {
	readonly ok: boolean;
	readonly reason?: string;
}

export function validateMoveTargetScope(
	state: FaceturnServerState,
	playerId: string,
	move: MoveCard,
	targetPlayerId: string | undefined,
): TargetScopeCheck {
	if (!targetPlayerId) return { ok: true };

	const scope = getMoveTargetScope(move);

	if (scope === "enemy") {
		const targetIsEnemy = getEnemies(state, playerId).some(
			(e) => e.playerId === targetPlayerId,
		);
		return targetIsEnemy
			? { ok: true }
			: {
					ok: false,
					reason: "This move can only target an enemy, not that player.",
				};
	}

	if (scope === "ally") {
		// self target only allowed for non-strict ally moves
		const selfAllowed = !requiresStrictAllyTarget(move);
		const isValidAlly =
			(selfAllowed && targetPlayerId === playerId) ||
			getTeammates(state, playerId).some((t) => t.playerId === targetPlayerId);
		return isValidAlly
			? { ok: true }
			: {
					ok: false,
					reason: selfAllowed
						? "This move can only target an ally."
						: "This move needs a teammate — it can't target yourself.",
				};
	}

	return { ok: false, reason: "This move doesn't take a target." };
}

export function resolveTarget(ctx: EffectContext): FaceturnServerPlayer | null {
	if (ctx.targetPlayerId) {
		const p = ctx.state.players.get(ctx.targetPlayerId);
		if (p && !ctx.state.eliminatedPlayers.has(p.playerId)) return p;
	}
	const enemies = getEnemies(ctx.state, ctx.actor.playerId);
	return enemies[0] ?? null;
}

// defaults to self when no valid ally target, safe for duel/ffa
export function resolveAllyTarget(ctx: EffectContext): FaceturnServerPlayer {
	if (!ctx.targetPlayerId) return ctx.actor;
	if (ctx.targetPlayerId === ctx.actor.playerId) return ctx.actor;

	const candidate = ctx.state.players.get(ctx.targetPlayerId);
	if (!candidate) return ctx.actor;
	if (ctx.state.eliminatedPlayers.has(ctx.targetPlayerId)) return ctx.actor;

	const isAlly = candidate.teamIndex === ctx.actor.teamIndex;
	return isAlly ? candidate : ctx.actor;
}

// never defaults to self, returns null if no living teammate
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

// reads passive magnitude from card db to avoid magic numbers
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

export function evaluateCondition(
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
			return [actor, ...getTeammates(ctx.state, actor.playerId)].every((p) =>
				p.crewIds.every((crewId, i) => !crewId || !p.crewTurned[i as 0 | 1]),
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
	cls?: "striker" | "defender" | "collector" | "hider",
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

// face-up crew are spent, only face-down count for class declarations
export function playerHasClass(
	player: FaceturnServerPlayer,
	cls: "striker" | "defender" | "collector" | "hider",
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