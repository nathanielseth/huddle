import type { FaceturnServerState } from "../types";
import type { CardEffect, EffectPrimitive } from "../cards";
import { recomputePassives } from "../derived";
import { applyDamage } from "./damage";
import {
	type EffectContext,
	type Handler,
	isConditionalEffect,
	evaluateCondition,
	getLivingPlayers,
} from "./shared";

import { damageHandlers } from "./damage";
import { strikeHandlers } from "./strikes";
import { crewTurnHandlers } from "./crew-turn";
import { drawDiscardHandlers } from "./draw-discard";
import { cashHandlers } from "./cash";
import { bossHpArmorHandlers } from "./boss-hp-armor";
import { readPeekHandlers } from "./read-peek";
import { moveChainHandlers } from "./move-chain";
import { miscHandlers } from "./misc";

// compile error if any effect type lacks a handler; see per-category satisfies usage
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
	firstTurnedSlot,
	firstUnturnedSlot,
	isStrikeDefendedByTerminal,
	resolveStrikeOrExecute,
	performStrike,
	triggerCrewTurnedEffects,
	applyBloodMoneyOnStrike,
	executedPlayerIdFrom,
	type StrikeOrExecuteOutcome,
} from "./strikes";
export { clampHp, applyDamage, applyPoisonToVictim } from "./damage";
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
export {
	checkVoidPiecesAssembled,
	getEnemies,
	getLivingPlayers,
	getTeammates,
	isConditionalEffect,
	isPlayerOrTeammate,
	moveHasLegalTarget,
	playerHasClass,
	requiresStrictAllyTarget,
	resolveCrewClass,
} from "./shared";