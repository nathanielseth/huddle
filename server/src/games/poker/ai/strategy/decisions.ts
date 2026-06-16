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
import { lineValidActions, type ActiveLine } from "./lines";
import {
	classifyHand,
	classifyBetSize,
	type HandBucket,
	type BetSizeBucket,
} from "./handBucket";

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
	return stackAfter <= 0 ? 0 : stackAfter / (effectivePot + raiseIncr);
}

function sprAdjustedFraction(
	sampledFraction: number,
	ctx: AIDecisionContext,
	personality: AIPersonality,
): number {
	const { equity, effectivePot, betLevel, stack, callAmount, streetIndex } =
		ctx;

	if (streetIndex === 3) return sampledFraction;

	const buildPot = equity > 0.65;
	const avoidCommitment = equity >= 0.35 && equity <= 0.65;
	if (!buildPot && !avoidCommitment) return sampledFraction;

	const candidates = [0.33, 0.67, 1.0, 1.5, 2.0] as const;
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

	const gap = Math.abs(bestFraction - sampledFraction);
	const maxJump = 0.33 + personality.aggression * 0.67;
	return gap >= 0.33 && gap <= maxJump ? bestFraction : sampledFraction;
}

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
		boardTexture,
	} = ctx;

	const sizingWeights: readonly [number, number, number, number] =
		equity < 0.35
			? [
					personality.sizingWeights[0],
					personality.sizingWeights[1],
					Math.round((personality.sizingWeights[2] + 3) / 2),
					Math.round((personality.sizingWeights[3] + 4) / 2),
				]
			: personality.sizingWeights;

	const streetMultiplier = STREET_SIZING_MULTIPLIER[streetIndex] ?? 1.0;
	const baseFraction = sprAdjustedFraction(
		sampleBetFraction(sizingWeights, spr, streetIndex, boardTexture),
		ctx,
		personality,
	);

	const raw = fractionToBetAmount(
		baseFraction * streetMultiplier,
		effectivePot,
		betLevel,
	);
	const clamped = humanizeBet(raw, personality, minRaiseTo, maxRaiseTo - 1);
	return clamped >= stack * 0.85 + callAmount ? maxRaiseTo : clamped;
}

type ActionKey = "fold" | "check" | "call" | "raise" | "all_in";
type ActionScores = Record<ActionKey, number>;

export function scoreActions(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	nudges?: Partial<Record<ActionKey, number>>,
	bluffFired = false,
): ActionScores {
	const {
		equity,
		potOdds,
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
		boardTexture,
	} = ctx;

	const evEdge = equity - potOdds;
	const inPosition = positionFactor > 0.5;
	const evScale = 1 + 2 * equity;

	const foldEquity = estimateFoldEquity(
		activeOpponents,
		personality.aggression,
	);
	const pairedMultiplier = boardTexture?.paired ? 0.55 : 1.0;

	const bluffBonus = bluffFired
		? foldEquity *
			(0.28 + (inPosition ? 0.1 : 0)) *
			personality.aggression *
			pairedMultiplier
		: 0;

	const totalHandInvestment = chipsInvested + stack;
	const commitmentRatio =
		totalHandInvestment > 0 ? chipsInvested / totalHandInvestment : 0;
	const potCommitBonus = Math.max(0, (commitmentRatio - 0.6) * 3.0);
	const potCommitted = spr < 0.8 - personality.tightness * 0.5;
	const positionRaiseBonus = positionFactor * 0.08 * personality.aggression;
	const evScaledEdge = evEdge * evScale;

	const turnBarrelPenalty =
		streetIndex === 2 && evEdge < 0.12 && !potCommitted
			? 0.25 * (1 - equity)
			: 0;
	const raiseScore =
		canRaise && maxRaiseTo > minRaiseTo && activeOpponents > 0
			? evScaledEdge * personality.aggression +
				positionRaiseBonus +
				bluffBonus -
				turnBarrelPenalty
			: -Infinity;

	const committableEdge =
		spr < 2.0 && evEdge > 0.1 && equity > Math.max(0.57, personality.tightness);

	const allInScore =
		stack > 0 && numOpponents > 0 && (potCommitted || committableEdge)
			? evScaledEdge * personality.aggression * 1.08 + positionRaiseBonus
			: -Infinity;

	const limpBlocked = isLimpOpportunity && canRaise;
	const callScore =
		canCall && callAmount > 0 && !limpBlocked
			? (evEdge > 0
					? evEdge * (1 - personality.aggression * 0.35)
					: evEdge * (1 + personality.tightness * 0.5)) *
					(isLimpOpportunity ? 0.6 : 1.0) +
				potCommitBonus
			: -Infinity;

	const equityDamper = Math.max(0.1, 1 - Math.max(0, equity - 0.7) * 3);
	const checkScore = canCheck
		? Math.max(
				0.05,
				(1 - Math.max(0, evEdge) * personality.aggression * 2) *
					0.55 *
					equityDamper,
			)
		: -Infinity;

	const multiwayCommitPenalty = Math.max(0, (numOpponents - 1) * 0.08);
	const foldThreshold =
		potOdds + personality.tightness * 0.3 + multiwayCommitPenalty;
	const shortfall = foldThreshold - equity;
	const foldScore =
		callAmount > 0 &&
		commitmentRatio < 0.7 &&
		shortfall > 0 &&
		(!potCommitted || evEdge < -0.25)
			? shortfall * personality.tightness * (evScale + spr * 0.1)
			: -Infinity;

	const scores: ActionScores = {
		raise: raiseScore,
		all_in: allInScore,
		call: callScore,
		check: checkScore,
		fold: foldScore,
	};

	if (nudges) {
		for (const [key, nudge] of Object.entries(nudges) as [
			ActionKey,
			number,
		][]) {
			if (scores[key] !== -Infinity) scores[key] += nudge;
		}
	}

	return scores;
}

function applyBucketAdjustments(
	scores: ActionScores,
	bucket: HandBucket,
	betBucket: BetSizeBucket | null,
): void {
	if (betBucket === null) {
		if (bucket === "nuts" || bucket === "strong") {
			if (scores.raise !== -Infinity) scores.raise += 0.15;
		}
		if (bucket === "air") {
			if (scores.raise !== -Infinity) scores.raise -= 0.2;
		}
		return;
	}

	if (betBucket === "overbet") {
		switch (bucket) {
			case "nuts":
			case "strong":
				if (scores.raise !== -Infinity) scores.raise += 0.25;
				if (scores.call !== -Infinity) scores.call += 0.1;
				break;
			case "medium":
			case "draw":
				if (scores.call !== -Infinity) scores.call -= 0.35;
				if (scores.fold !== -Infinity) scores.fold += 0.3;
				break;
			case "weak":
			case "air":
				scores.call = -Infinity;
				if (scores.fold !== -Infinity) scores.fold += 0.5;
				break;
		}
		return;
	}

	if (betBucket === "large") {
		if (bucket === "air") {
			scores.call = -Infinity;
			if (scores.fold !== -Infinity) scores.fold += 0.35;
		} else if (bucket === "weak") {
			if (scores.call !== -Infinity) scores.call -= 0.2;
			if (scores.fold !== -Infinity) scores.fold += 0.15;
		}
		return;
	}

	if (betBucket === "medium") {
		switch (bucket) {
			case "nuts":
			case "strong":
				if (scores.raise !== -Infinity) scores.raise += 0.18;
				break;
			case "medium":
			case "draw":
				// fine to call or raise
				break;
			case "weak":
				if (scores.call !== -Infinity) scores.call -= 0.15;
				if (scores.fold !== -Infinity) scores.fold += 0.12;
				break;
			case "air":
				scores.call = -Infinity;
				if (scores.fold !== -Infinity) scores.fold += 0.25;
				break;
		}
		return;
	}

	if (betBucket === "small") {
		switch (bucket) {
			case "nuts":
			case "strong":
				if (scores.raise !== -Infinity) scores.raise += 0.12;
				break;
			case "medium":
			case "draw":
				// pot odds justify a call
				if (scores.call !== -Infinity) scores.call += 0.06;
				break;
			case "weak":
				// marginal
				break;
			case "air":
				if (scores.call !== -Infinity) scores.call -= 0.1;
				if (scores.fold !== -Infinity) scores.fold += 0.08;
				break;
		}
		return;
	}

	// min-bet: incentivize strong hands to punish; draws/medium can float
	if (betBucket === "min") {
		if (bucket === "nuts" || bucket === "strong") {
			if (scores.raise !== -Infinity) scores.raise += 0.25;
			if (scores.call !== -Infinity) scores.call -= 0.1;
		} else if (bucket === "medium" || bucket === "draw") {
			if (scores.raise !== -Infinity) scores.raise += 0.1;
		}
		return;
	}
}

function topTwoMargin(scores: ActionScores): number {
	const sorted = (Object.values(scores) as number[])
		.filter((s) => s !== -Infinity)
		.sort((a, b) => b - a);
	return sorted.length < 2 ? Infinity : sorted[0]! - sorted[1]!;
}

export function selectAction(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	nudges?: Partial<Record<ActionKey, number>>,
	activeLine?: ActiveLine | null,
): PokerServerAction {
	const ACTION_KEYS: readonly ActionKey[] = [
		"raise",
		"all_in",
		"call",
		"check",
		"fold",
	];

	// classify the current situation before anything else
	const bucket = classifyHand(
		ctx.equity,
		ctx.boardTexture,
		ctx.streetIndex,
		ctx.spr,
	);
	const betBucket =
		ctx.callAmount > 0 ? classifyBetSize(ctx.callAmount, ctx.pot) : null;

	// bluff intent: line-driven bluffs are enforced by the restriction layer
	const foldEquity = estimateFoldEquity(
		ctx.activeOpponents,
		personality.aggression,
	);
	const bluffCost =
		ctx.callAmount > 0 ? ctx.callAmount : ctx.effectivePot * 0.5;
	const rawBluffEV = bluffEV(foldEquity, ctx.pot, bluffCost);

	const isBluffLine =
		activeLine?.active === true &&
		(activeLine.line === "bluff_2barrel" || activeLine.line === "bet_fold");

	// opportunistic bluff: only when no plan is governing the hand
	const bluffFired =
		!isBluffLine &&
		rawBluffEV > 0 &&
		ctx.streetIndex < 3 &&
		Math.random() < personality.bluffFrequency * (1 - ctx.equity * 0.5);

	// layer 1: score
	const scores = scoreActions(ctx, personality, nudges, bluffFired);

	// layer 2: restrict
	if (activeLine?.active) {
		const valid = lineValidActions(
			activeLine.line,
			ctx.callAmount > 0,
			ctx.canCheck,
			ctx.canRaise,
		);
		for (const key of ACTION_KEYS) {
			if (!valid.has(key)) scores[key] = -Infinity;
		}
	}

	// layer 3: adjust
	applyBucketAdjustments(scores, bucket, betBucket);

	const margin = topTwoMargin(scores);
	const effectiveNoise = personality.noise / (1 + margin * 2);

	let bestRawScore = -Infinity;
	for (const key of ACTION_KEYS) {
		if (scores[key] !== -Infinity && scores[key] > bestRawScore)
			bestRawScore = scores[key];
	}
	const blunderThreshold = effectiveNoise * 3.0;

	let bestKey: ActionKey = "fold";
	let bestScore = -Infinity;

	for (const key of ACTION_KEYS) {
		const s = scores[key];
		if (s === -Infinity || bestRawScore - s > blunderThreshold) continue;
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
		return raiseTo >= ctx.maxRaiseTo
			? { type: "all_in" }
			: { type: "raise", amount: raiseTo };
	}

	return { type: bestKey };
}
