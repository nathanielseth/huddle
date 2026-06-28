import type { AIPersonality, AIDecisionContext } from "../types";
import type { PokerServerAction } from "../../types";
import {
	ALL_HAND_TYPES,
	buildRangeByPercentile,
	type RangeWeights,
} from "../ranges";
import { humanizeBet } from "../personality";
import { gaussianSample, multiWayPenalty } from "../ev";
import { calculateEquityVsRanges } from "../equity/monteCarlo";

// bb-multiple thresholds for situation detection.
const THREE_BET_THRESHOLD_BB = 7;
const FOUR_BET_THRESHOLD_BB = 22;

// Below this effective stack depth in bb, skip small-open sizing and use pure shove/fold
const SHORT_STACK_THRESHOLD_BB = 15;

function isHandInRange(
	holeCardCodes: readonly [number, number],
	range: RangeWeights,
): boolean {
	const [h0, h1] = holeCardCodes;
	for (const ht of ALL_HAND_TYPES) {
		const w = range[ht.index] ?? 0;
		if (w <= 0) continue;
		for (const [c0, c1] of ht.combos) {
			if ((c0 === h0 && c1 === h1) || (c0 === h1 && c1 === h0)) {
				return w >= 1.0 || Math.random() < w;
			}
		}
	}
	return false;
}

// position-adjusts a range percentage
function posAdjusted(basePct: number, positionFactor: number): number {
	return Math.max(3, basePct * (0.6 + positionFactor * 0.4));
}

type PreflopSituation = "bb_walk" | "open" | "vs_open" | "vs_3bet" | "vs_4bet";

// classifies preflop decision from bet level relative to big blind
function detectSituation(
	betLevel: number,
	bigBlind: number,
	canCheck: boolean,
): PreflopSituation {
	if (canCheck && betLevel <= bigBlind) return "bb_walk";
	if (betLevel <= bigBlind) return "open";
	if (betLevel <= bigBlind * THREE_BET_THRESHOLD_BB) return "vs_open";
	if (betLevel <= bigBlind * FOUR_BET_THRESHOLD_BB) return "vs_3bet";
	return "vs_4bet";
}

// short-stack shove/fold. Replaces small-open and re-raise logic when the effective stack is below SHORT_STACK_THRESHOLD_BB
function handleShoveOrFold(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	holeCardCodes: readonly [number, number],
	numOpp: number,
): PokerServerAction {
	const stackBB = ctx.stack / ctx.bigBlind;
	const shovePct = posAdjusted(
		Math.min(personality.openRangePct, Math.max(6, stackBB * 0.85)),
		ctx.positionFactor,
	);
	const shoveRange = buildRangeByPercentile(shovePct, numOpp);
	if (isHandInRange(holeCardCodes, shoveRange)) {
		return { type: "all_in" };
	}
	return { type: "fold" };
}

// computes concrete preflop raise-to amount
function computePreflopRaiseTo(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	isReRaise: boolean,
): number {
	const {
		betLevel,
		bigBlind,
		positionFactor,
		minRaiseTo,
		maxRaiseTo,
		stack,
		callAmount,
		numOpponents,
	} = ctx;

	const posAdj = 0.6 - positionFactor * 0.6;
	const aggrBoost = personality.aggression * 0.5;

	// short stacks open tighter to preserve shove equity
	const stackDepthBB = stack / bigBlind;
	const shortStackAdj =
		stackDepthBB < 20 ? -0.25 : stackDepthBB < 30 ? -0.12 : 0;

	// more players behind = open larger to punish cold calls
	const multiWayAdj = Math.max(0, numOpponents - 2) * 0.12;

	let raw: number;
	if (!isReRaise) {
		const noise = Math.max(-0.3, Math.min(0.3, gaussianSample(0.13)));
		raw = Math.round(
			(2.2 + posAdj + aggrBoost + shortStackAdj + multiWayAdj + noise) *
				bigBlind,
		);
	} else {
		// independent draw: re-raise noise must not correlate with open noise
		const noise = gaussianSample(0.08);
		raw = Math.round(betLevel * (2.6 + posAdj * 0.4 + aggrBoost * 0.5 + noise));
	}

	const clamped = humanizeBet(raw, personality, minRaiseTo, maxRaiseTo - 1);
	if (clamped >= stack * 0.85 + callAmount) return maxRaiseTo;
	return clamped;
}

// bb walk: check always available. optionally squeeze with top of 3-bet range
function handleBBWalk(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	holeCardCodes: readonly [number, number],
	numOpp: number,
): PokerServerAction {
	if (ctx.canRaise) {
		const squeezePct = posAdjusted(
			personality.threeBetRangePct * 0.6,
			ctx.positionFactor,
		);
		const squeezeRange = buildRangeByPercentile(squeezePct, numOpp);

		if (isHandInRange(holeCardCodes, squeezeRange)) {
			const raiseTo = computePreflopRaiseTo(ctx, personality, false);
			if (raiseTo >= ctx.maxRaiseTo) return { type: "all_in" };
			if (raiseTo >= ctx.minRaiseTo) return { type: "raise", amount: raiseTo };
		}
	}
	return { type: "check" };
}

function handleOpen(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	holeCardCodes: readonly [number, number],
	numOpp: number,
): PokerServerAction {
	if (ctx.stack / ctx.bigBlind < SHORT_STACK_THRESHOLD_BB && ctx.canRaise) {
		return handleShoveOrFold(ctx, personality, holeCardCodes, numOpp);
	}

	if (ctx.canRaise) {
		const openPct =
			posAdjusted(personality.openRangePct, ctx.positionFactor) *
			multiWayPenalty(numOpp);
		const openRange = buildRangeByPercentile(openPct, numOpp);

		if (isHandInRange(holeCardCodes, openRange)) {
			const raiseTo = computePreflopRaiseTo(ctx, personality, false);
			if (raiseTo >= ctx.maxRaiseTo) return { type: "all_in" };
			if (raiseTo >= ctx.minRaiseTo) return { type: "raise", amount: raiseTo };
			return { type: "raise", amount: ctx.minRaiseTo }; // noise pushed size below min
		}

		const lightStealFreq =
			personality.bluffFrequency * Math.max(0, ctx.positionFactor - 0.5) * 0.6;
		if (Math.random() < lightStealFreq) {
			const raiseTo = computePreflopRaiseTo(ctx, personality, false);
			if (raiseTo >= ctx.maxRaiseTo) return { type: "all_in" };
			if (raiseTo >= ctx.minRaiseTo) return { type: "raise", amount: raiseTo };
			return { type: "raise", amount: ctx.minRaiseTo };
		}
	}

	// passive personalities occasionally limp rather than fold
	if (
		ctx.canCall &&
		ctx.positionFactor > 0.6 &&
		personality.aggression < 0.45 &&
		Math.random() < (1 - personality.aggression) * 0.08
	) {
		return { type: "call" };
	}

	return { type: "fold" };
}

// facing single open. short stacks shove or fold, flatting and 3-bet-folding
function handleVsOpen(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	holeCardCodes: readonly [number, number],
	numOpp: number,
): PokerServerAction {
	if (ctx.stack / ctx.bigBlind < SHORT_STACK_THRESHOLD_BB) {
		return handleShoveOrFold(ctx, personality, holeCardCodes, numOpp);
	}

	const { positionFactor, canRaise, canCall } = ctx;

	const threeBetPct = posAdjusted(personality.threeBetRangePct, positionFactor);
	const threeBetRange = buildRangeByPercentile(threeBetPct, numOpp);
	const in3BetRange = canRaise && isHandInRange(holeCardCodes, threeBetRange);

	if (in3BetRange) {
		const raiseTo = computePreflopRaiseTo(ctx, personality, true);
		if (raiseTo >= ctx.maxRaiseTo) return { type: "all_in" };
		if (raiseTo >= ctx.minRaiseTo) return { type: "raise", amount: raiseTo };
	}

	if (canRaise && !in3BetRange) {
		const bluffBandPct = personality.bluffFrequency * 15;
		const bluff3BetRange = buildRangeByPercentile(
			posAdjusted(personality.threeBetRangePct + bluffBandPct, positionFactor),
			numOpp,
		);
		if (
			isHandInRange(holeCardCodes, bluff3BetRange) &&
			Math.random() < personality.bluffFrequency * 0.7
		) {
			const raiseTo = computePreflopRaiseTo(ctx, personality, true);
			if (raiseTo >= ctx.maxRaiseTo) return { type: "all_in" };
			if (raiseTo >= ctx.minRaiseTo) return { type: "raise", amount: raiseTo };
		}
	}

	if (canCall) {
		const callTopPct = posAdjusted(
			personality.threeBetRangePct + personality.coldCallPct,
			positionFactor,
		);
		const callRange = buildRangeByPercentile(callTopPct, numOpp);

		if (!in3BetRange && isHandInRange(holeCardCodes, callRange)) {
			return { type: "call" };
		}
	}

	return { type: "fold" };
}

// facing 3-bet. short stacks skip the 4-bet–then–fold line for the same
function handleVs3Bet(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	holeCardCodes: readonly [number, number],
	numOpp: number,
): PokerServerAction {
	if (ctx.stack / ctx.bigBlind < SHORT_STACK_THRESHOLD_BB) {
		return handleShoveOrFold(ctx, personality, holeCardCodes, numOpp);
	}

	const { positionFactor, canRaise, canCall } = ctx;

	const valueFourBetPct = Math.max(3, personality.threeBetRangePct * 0.65);
	const bluff4BetBonus = Math.min(
		2,
		personality.aggression * personality.bluffFrequency * 10,
	);
	const fourBetPct = posAdjusted(
		valueFourBetPct + bluff4BetBonus,
		positionFactor,
	);
	const fourBetRange = buildRangeByPercentile(fourBetPct, numOpp);
	const in4BetRange = canRaise && isHandInRange(holeCardCodes, fourBetRange);

	if (in4BetRange) {
		const raiseTo = computePreflopRaiseTo(ctx, personality, true);
		if (raiseTo >= ctx.maxRaiseTo) return { type: "all_in" };
		if (raiseTo >= ctx.minRaiseTo) return { type: "raise", amount: raiseTo };
	}

	const isInPosition = positionFactor > 0.5;
	if (canCall && isInPosition) {
		const callPct =
			fourBetPct + posAdjusted(personality.coldCallPct * 0.3, positionFactor);
		const callRange = buildRangeByPercentile(callPct, numOpp);

		if (!in4BetRange && isHandInRange(holeCardCodes, callRange)) {
			return { type: "call" };
		}
	}

	return { type: "fold" };
}

function handleVs4Bet(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	holeCardCodes: readonly [number, number],
	numOpp: number,
): PokerServerAction {
	// build the actual 4-bet range and compute equity against it
	const villainRange = buildRangeByPercentile(4, numOpp);
	const { equity } = calculateEquityVsRanges(
		holeCardCodes,
		[],
		[villainRange],
		1000,
	);

	// small personality gate
	const tightnessBuffer = 0.05 + personality.tightness * 0.10;
	if (equity >= ctx.potOdds + tightnessBuffer) {
		return { type: "all_in" };
	}

	return { type: "fold" };
}

// range-gated preflop decision
export function makePreflopDecision(
	ctx: AIDecisionContext,
	personality: AIPersonality,
	holeCardCodes: readonly [number, number],
): PokerServerAction {
	const numOpp = Math.min(Math.max(ctx.numOpponents, 1), 5);
	const situation = detectSituation(ctx.betLevel, ctx.bigBlind, ctx.canCheck);

	let action: PokerServerAction;
	switch (situation) {
		case "bb_walk":
			action = handleBBWalk(ctx, personality, holeCardCodes, numOpp);
			break;
		case "open":
			action = handleOpen(ctx, personality, holeCardCodes, numOpp);
			break;
		case "vs_open":
			action = handleVsOpen(ctx, personality, holeCardCodes, numOpp);
			break;
		case "vs_3bet":
			action = handleVs3Bet(ctx, personality, holeCardCodes, numOpp);
			break;
		case "vs_4bet":
			action = handleVs4Bet(ctx, personality, holeCardCodes, numOpp);
			break;
		default:
			action = { type: "fold" };
	}

	if (action.type === "fold" && ctx.canCheck && ctx.callAmount <= 0) {
		return { type: "check" };
	}

	return action;
}
