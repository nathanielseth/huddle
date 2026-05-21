import type { AIPersonality, AIDecisionContext } from "../types";
import type { PokerServerAction } from "../../types";
import {
	bluffEV,
	estimateFoldEquity,
	fractionToBetAmount,
	gaussianSample,
	sampleBetFraction,
	STREET_SIZING_MULTIPLIER,
} from "../ev";
import { humanizeBet } from "../personality";

function sprAfterBet(
	fraction: number,
	effectivePot: number,
	betLevel: number,
	stack: number,
	callAmount: number,
): number {
	const raiseIncr =
		fractionToBetAmount(fraction, effectivePot, betLevel) - betLevel;
	const stackAfter = stack - raiseIncr - callAmount;
	const potAfter = effectivePot + raiseIncr;
	return stackAfter <= 0 ? 0 : stackAfter / potAfter;
}

// buildPot: strong hand, wants to commit chips and reduce SPR
// avoidCommitment: medium hand, wants to preserve fold equity and stack depth
function sprAdjustedFraction(
	sampledFraction: number,
	ctx: AIDecisionContext,
): number {
	const { equity, effectivePot, betLevel, stack, callAmount, streetIndex } =
		ctx;

	if (streetIndex === 3) return sampledFraction;

	const buildPot = equity > 0.65;
	const avoidCommitment = equity >= 0.35 && equity <= 0.65;

	if (!buildPot && !avoidCommitment) return sampledFraction;

	const candidates = [0.33, 0.67, 1.0, 1.5] as const;
	let bestFraction = sampledFraction;
	let bestScore = -Infinity;

	for (const frac of candidates) {
		const spr = sprAfterBet(frac, effectivePot, betLevel, stack, callAmount);
		const score = buildPot ? -spr : spr < 3 ? -Infinity : spr;
		if (score > bestScore) {
			bestScore = score;
			bestFraction = frac;
		}
	}

	return Math.abs(bestFraction - sampledFraction) >= 0.33
		? bestFraction
		: sampledFraction;
}

// computes a concrete raise-to chip amount
function computeRaiseTo(
	ctx: AIDecisionContext,
	personality: AIPersonality,
): number {
	const {
		effectivePot,
		betLevel,
		minRaiseTo,
		maxRaiseTo,
		stack,
		callAmount,
		spr,
		streetIndex,
		equity,
	} = ctx;

	const sizingWeights: readonly [number, number, number, number] =
		equity < 0.35
			? ([
					personality.sizingWeights[0],
					personality.sizingWeights[1],
					Math.round((personality.sizingWeights[2] + 3) / 2),
					Math.round((personality.sizingWeights[3] + 4) / 2),
				] as const)
			: personality.sizingWeights;

	const streetMultiplier = STREET_SIZING_MULTIPLIER[streetIndex] ?? 1.0;
	let baseFraction = sampleBetFraction(sizingWeights, spr, streetIndex);
	baseFraction = sprAdjustedFraction(baseFraction, ctx);

	const scaledFraction = baseFraction * streetMultiplier;
	const raw = fractionToBetAmount(scaledFraction, effectivePot, betLevel);
	const clamped = humanizeBet(raw, personality, minRaiseTo, maxRaiseTo - 1);

	if (clamped >= stack * 0.85 + callAmount) return maxRaiseTo;
	return clamped;
}

type ActionKey = "fold" | "check" | "call" | "raise" | "all_in";
type ActionScores = Record<ActionKey, number>;

// assigns a raw desirability score to each legal action
export function scoreActions(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	nudges?: Partial<Record<ActionKey, number>>,
): ActionScores {
	const {
		equity,
		potOdds,
		pot,
		effectivePot,
		activeOpponents,
		numOpponents,
		canCheck,
		canRaise,
		canCall,
		positionFactor,
		spr,
		stack,
		callAmount,
		minRaiseTo,
		maxRaiseTo,
		isLimpOpportunity,
		streetIndex,
		chipsInvested,
	} = ctx;

	const evEdge = equity - potOdds;
	const inPosition = positionFactor > 0.5;
	const evScale = 1 + 2 * equity;

	const foldEquity = estimateFoldEquity(
		activeOpponents,
		personality.aggression,
	);
	const bluffCost = callAmount > 0 ? callAmount : effectivePot * 0.5;
	const rawBluffEV = bluffEV(foldEquity, pot, bluffCost);
	const bluffFired =
		rawBluffEV > 0 &&
		streetIndex < 3 &&
		Math.random() < personality.bluffFrequency * (1 - equity * 0.5);
	const bluffBonus = bluffFired
		? foldEquity * (0.28 + (inPosition ? 0.1 : 0))
		: 0;

	// pot commitment and positional bonuses
	const totalHandInvestment = chipsInvested + stack;
	const commitmentRatio =
		totalHandInvestment > 0 ? chipsInvested / totalHandInvestment : 0;
	const potCommitBonus = Math.max(0, (commitmentRatio - 0.6) * 3.0);
	const positionRaiseBonus = positionFactor * 0.08 * personality.aggression;
	const evScaledEdge = evEdge * evScale;

	const raiseScore =
		canRaise && maxRaiseTo > minRaiseTo && activeOpponents > 0
			? evScaledEdge * personality.aggression + positionRaiseBonus + bluffBonus
			: -Infinity;

	// SPR gating for all-in: pot-committed, or strong edge in medium-SPR spot
	const potCommitted = spr < 0.8;
	const committableEdge =
		spr < 2.0 && evEdge > 0.1 && equity > Math.max(0.52, personality.tightness);
	const allInScore =
		stack > 0 && numOpponents > 0 && (potCommitted || committableEdge)
			? evScaledEdge * personality.aggression * 1.08 + positionRaiseBonus
			: -Infinity;

	// suppress calls that would be a preflop limp when raising is available
	const limpBlocked = isLimpOpportunity && canRaise;
	const callScore =
		canCall && callAmount > 0 && !limpBlocked
			? (evEdge > 0
					? evEdge * (1 - personality.aggression * 0.35)
					: evEdge * (1 + personality.tightness * 0.5)) *
					(isLimpOpportunity ? 0.6 : 1.0) +
				potCommitBonus
			: -Infinity;

	// free action: value of not committing chips
	const checkScore = canCheck
		? Math.max(
				0.05,
				(1 - Math.max(0, evEdge) * personality.aggression * 2) * 0.55,
			)
		: -Infinity;

	// fold only fires when behind, not pot-committed, and facing real cost
	const foldScore =
		callAmount > 0 && evEdge < -0.01 && commitmentRatio < 0.7
			? Math.abs(evEdge) * personality.tightness * evScale
			: -Infinity;

	const scores: ActionScores = {
		raise: raiseScore,
		all_in: allInScore,
		call: callScore,
		check: checkScore,
		fold: foldScore,
	};

	if (nudges) {
		for (const key of Object.keys(nudges) as ActionKey[]) {
			const nudge = nudges[key];
			if (nudge !== undefined && scores[key] !== -Infinity) {
				scores[key] += nudge;
			}
		}
	}

	return scores;
}

function topTwoMargin(scores: ActionScores): number {
	const finite = Object.values(scores).filter((s) => s !== -Infinity);
	if (finite.length < 2) return Infinity;
	finite.sort((a, b) => b - a);
	return finite[0]! - finite[1]!;
}

export function selectAction(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	nudges?: Partial<Record<ActionKey, number>>,
): PokerServerAction {
	const ACTION_KEYS: readonly ActionKey[] = [
		"raise",
		"all_in",
		"call",
		"check",
		"fold",
	];

	const base = scoreActions(ctx, personality, nudges);
	const margin = topTwoMargin(base);
	const effectiveNoise = personality.noise / (1 + margin * 2);

	let bestRawScore = -Infinity;
	for (const key of ACTION_KEYS) {
		const s = base[key];
		if (s !== -Infinity && s > bestRawScore) bestRawScore = s;
	}
	const blunderThreshold = effectiveNoise * 3.0;

	let bestKey: ActionKey = "fold";
	let bestScore = -Infinity;

	for (const key of ACTION_KEYS) {
		const s = base[key];
		if (s === -Infinity) continue;
		if (bestRawScore - s > blunderThreshold) continue;
		const noisy = s + gaussianSample(effectiveNoise);
		if (noisy > bestScore) {
			bestScore = noisy;
			bestKey = key;
		}
	}

	if (bestScore === -Infinity) {
		if (ctx.canCall && ctx.callAmount > 0) return { type: "call" };
		if (ctx.canCheck) return { type: "check" };
		return { type: "fold" };
	}

	if (bestKey === "raise") {
		const raiseTo = computeRaiseTo(ctx, personality);
		if (raiseTo >= ctx.maxRaiseTo) return { type: "all_in" };
		return { type: "raise", amount: raiseTo };
	}

	return { type: bestKey };
}
