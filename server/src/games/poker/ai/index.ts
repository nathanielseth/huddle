import { getCardCode } from "@pokertools/evaluator";
import type { BettingPhase } from "../../../../../shared/poker";
import type { GameTimer } from "../../../../../shared/types";
import type { PokerServerState, PokerServerAction } from "../types";
import { validateAction, countInHandPlayers } from "../betting";
import {
	calculateEquity,
	calculateEquityVsRanges,
	toCardCodes,
} from "./equity/monteCarlo";
import { computePotOdds, stackToPotRatio } from "./ev";
import { selectAction } from "./strategy/decisions";
import type { AIDecisionContext, AIPersonality } from "./types";
import { POKER_CONSTANTS as C } from "../constants";
import {
	uniformRange,
	narrowPreflopRange,
	narrowPostflopRange,
	type RangeWeights,
	type RangeProfile,
} from "./ranges";
import {
	selectLine,
	lineBias,
	type ActiveLine,
	expireLine,
} from "./strategy/lines";
import { makePreflopDecision } from "./strategy/preflop";

export type { AIPersonality, AIDecisionContext } from "./types";
export {
	generateAIPlayer,
	createAIPlayer,
	PERSONALITIES,
	NameDispenser,
} from "./personality.js";
export type { AIPlayerConfig, PersonalityId } from "./personality";

const STREET_INDEX: Record<BettingPhase, number> = {
	pre_flop: 0,
	flop: 1,
	turn: 2,
	river: 3,
} as const;

// pre-flop handled by range gates (makePreflopDecision), MC never run there
function simulationSamples(phase: BettingPhase): number {
	if (phase === "flop") return 5_000;
	if (phase === "turn") return 7_000;
	return 10_000;
}

const DEFAULT_HUMAN_RANGE_PROFILE: RangeProfile = {
	openRangePct: 22,
	threeBetRangePct: 8,
	coldCallPct: 15,
};

export function initializeRangeModels(state: PokerServerState): void {
	state.opponentRangeModels = new Map<string, RangeWeights>();
	state.activeLines = new Map<string, ActiveLine | null>();

	for (const [id, player] of state.players) {
		if (player.status === "out") continue;
		state.opponentRangeModels.set(id, uniformRange());
	}
}

// narrows the acting player's estimated range based on their observed action
export function updateOpponentRange(
	state: PokerServerState,
	playerId: string,
	action: PokerServerAction,
	prevBetToCall: number,
	phase: string,
): void {
	const currentRange = state.opponentRangeModels.get(playerId);
	if (!currentRange) return;

	const numOpp = Math.max(1, countInHandPlayers(state) - 1);
	const posFactor = _positionFactor(playerId, state);

	const player = state.players.get(playerId)!;
	const profile: RangeProfile = player.aiPersonality
		? {
				openRangePct: player.aiPersonality.openRangePct,
				threeBetRangePct: player.aiPersonality.threeBetRangePct,
				coldCallPct: player.aiPersonality.coldCallPct,
			}
		: DEFAULT_HUMAN_RANGE_PROFILE;

	let newRange: RangeWeights;

	if (phase === "pre_flop") {
		newRange = narrowPreflopRange(
			currentRange,
			action.type,
			prevBetToCall,
			C.BIG_BLIND,
			profile,
			numOpp,
			posFactor,
		);
	} else {
		let betFraction = 0.5;
		if (action.type === "raise" || action.type === "all_in") {
			const totalPot = [...state.players.values()].reduce(
				(s, p) => s + p.totalContributed,
				0,
			);
			const betIncrement = state.betting.betToCall - prevBetToCall;
			const potBeforeBet = Math.max(1, totalPot - betIncrement);
			betFraction = betIncrement / potBeforeBet;
		}

		newRange = narrowPostflopRange(
			currentRange,
			action.type,
			toCardCodes(state.communityCards),
			betFraction,
		);
	}

	state.opponentRangeModels.set(playerId, newRange);
}

function _positionFactor(playerId: string, state: PokerServerState): number {
	const { seatOrder, dealerIndex, players } = state;
	const count = seatOrder.length;
	const inHand: string[] = [];

	for (let i = 1; i <= count; i++) {
		const id = seatOrder[(dealerIndex + i) % count]!;
		const p = players.get(id)!;
		if (p.status === "active" || p.status === "allin") inHand.push(id);
	}

	const myIdx = inHand.indexOf(playerId);
	if (inHand.length <= 1 || myIdx === -1) return 1;
	return myIdx / (inHand.length - 1);
}

function _countActiveOpponents(
	state: PokerServerState,
	heroId: string,
): number {
	let n = 0;
	for (const [id, p] of state.players) {
		if (id !== heroId && p.status === "active") n++;
	}
	return n;
}

function _isLimpOpportunity(
	state: PokerServerState,
	heroId: string,
	callAmount: number,
	phase: BettingPhase,
): boolean {
	const player = state.players.get(heroId)!;
	return (
		phase === "pre_flop" &&
		state.betting.lastRaiserId === null &&
		callAmount > 0 &&
		player.currentBet === 0
	);
}

function _getOpponentRanges(
	state: PokerServerState,
	heroId: string,
): RangeWeights[] {
	const ranges: RangeWeights[] = [];
	for (const [id, player] of state.players) {
		if (id === heroId) continue;
		if (player.status !== "active" && player.status !== "allin") continue;
		const range = state.opponentRangeModels.get(id);
		if (range) ranges.push(range);
	}
	return ranges;
}

export function aiThinkTimer(
	personality: AIPersonality,
	equity: number,
	potOdds: number,
): GameTimer {
	const [min, max] = personality.thinkTimeMs;
	const range = max - min;
	const closeness = Math.max(0, 1 - Math.abs(equity - potOdds) * 3);
	const difficultyFactor = 0.25 + closeness * 0.5 + Math.random() * 0.35;
	return {
		startsAt: Date.now(),
		duration: Math.round(min + range * Math.min(difficultyFactor, 1)),
	};
}

export function makeAIAction(
	state: PokerServerState,
	playerId: string,
): PokerServerAction {
	const player = state.players.get(playerId)!;
	const personality = player.aiPersonality;

	if (!personality) {
		state.logger.log("ai_no_personality", state.handNumber, { playerId });
		return player.currentBet >= state.betting.betToCall
			? { type: "check" }
			: { type: "fold" };
	}

	if (!player.holeCards) return { type: "fold" };

	const phase = state.phase as BettingPhase;
	const streetIndex = STREET_INDEX[phase];

	const holeCardCodes: [number, number] = [
		getCardCode(player.holeCards[0]),
		getCardCode(player.holeCards[1]),
	];
	const boardCodes = toCardCodes(state.communityCards);

	const numOpponents = Math.max(1, countInHandPlayers(state) - 1);
	const activeOpponents = _countActiveOpponents(state, playerId);

	const pot = [...state.players.values()].reduce(
		(s, p) => s + p.totalContributed,
		0,
	);
	const betLevel = state.betting.betToCall;
	const callAmount = Math.max(
		0,
		Math.min(betLevel - player.currentBet, player.stack),
	);
	const effectivePot = pot + callAmount;
	const potOdds = computePotOdds(callAmount, pot);
	const minRaiseTo = betLevel + state.betting.lastRaiseIncrement;
	const maxRaiseTo = player.stack + player.currentBet;
	const positionFactor = _positionFactor(playerId, state);

	const ctx: AIDecisionContext = {
		equity: 0,
		potOdds,
		pot,
		stack: player.stack,
		callAmount,
		effectivePot,
		betLevel,
		minRaiseTo,
		maxRaiseTo,
		canCheck: player.currentBet >= betLevel,
		canRaise: player.canRaise && player.stack > 0 && maxRaiseTo > minRaiseTo,
		canCall: callAmount > 0 && player.stack > 0,
		streetIndex,
		spr: stackToPotRatio(player.stack, effectivePot),
		numOpponents,
		activeOpponents,
		positionFactor,
		bigBlind: C.BIG_BLIND,
		isLimpOpportunity: _isLimpOpportunity(state, playerId, callAmount, phase),
		chipsInvested: player.totalContributed,
	};

	// preflop: range-gated decision, no equity engine
	if (streetIndex === 0) {
		const action = makePreflopDecision(ctx, personality, holeCardCodes);

		if (validateAction(state, playerId, action)) {
			state.logger.log("ai_action", state.handNumber, {
				playerId,
				personalityId: personality.id,
				action,
				potOdds: +potOdds.toFixed(3),
				positionFactor: +positionFactor.toFixed(2),
				spr: +ctx.spr.toFixed(2),
				activeOpponents,
				numOpponents,
				isLimpOpportunity: ctx.isLimpOpportunity,
				phase,
			});
			return action;
		}

		state.logger.log("ai_invalid_action", state.handNumber, {
			playerId,
			personalityId: personality.id,
			action,
			canCheck: ctx.canCheck,
			canRaise: ctx.canRaise,
			canCall: ctx.canCall,
			phase,
			note: "BUG: makePreflopDecision returned invalid action — using safe fallback",
		});

		return ctx.canCheck ? { type: "check" } : { type: "fold" };
	}

	// postflop: equity engine + narrative
	const opponentRanges = _getOpponentRanges(state, playerId);

	const { equity, samples, exact } =
		opponentRanges.length > 0
			? calculateEquityVsRanges(
					holeCardCodes,
					boardCodes,
					opponentRanges,
					simulationSamples(phase),
				)
			: calculateEquity(
					holeCardCodes,
					boardCodes,
					numOpponents,
					simulationSamples(phase),
				);

	ctx.equity = equity;

	// line planner
	if (!state.activeLines) {
		throw new Error(
			"activeLines not initialized — initializeRangeModels must be called before makeAIAction",
		);
	}
	const isPFAggressor = state.pfAggressorId === playerId;
	const currentLine = state.activeLines.get(playerId) ?? null;
	const activeLine = selectLine(
		equity,
		ctx.spr,
		positionFactor,
		streetIndex,
		currentLine,
		personality.bluffFrequency,
		isPFAggressor,
	);

	state.activeLines.set(playerId, activeLine);

	const bias = lineBias(activeLine);

	const action = selectAction(ctx, personality, bias);

	const expiredLine = expireLine(activeLine, action.type, equity, streetIndex);
	state.activeLines.set(playerId, expiredLine);

	if (validateAction(state, playerId, action)) {
		state.logger.log("ai_action", state.handNumber, {
			playerId,
			personalityId: personality.id,
			action,
			equity: +equity.toFixed(3),
			potOdds: +potOdds.toFixed(3),
			evEdge: +(equity - potOdds).toFixed(3),
			positionFactor: +positionFactor.toFixed(2),
			spr: +ctx.spr.toFixed(2),
			activeOpponents,
			numOpponents,
			rangeWeighted: opponentRanges.length > 0,
			isLimpOpportunity: ctx.isLimpOpportunity,
			samples,
			exact,
			phase,
			activeLine: activeLine?.line ?? null,
		});
		return action;
	}

	state.logger.log("ai_invalid_action", state.handNumber, {
		playerId,
		personalityId: personality.id,
		action,
		equity: +equity.toFixed(3),
		potOdds: +potOdds.toFixed(3),
		canCheck: ctx.canCheck,
		canRaise: ctx.canRaise,
		canCall: ctx.canCall,
		activeOpponents,
		callAmount,
		minRaiseTo,
		maxRaiseTo,
		phase,
		note: "BUG: selectAction returned invalid action — using safe fallback",
	});

	return ctx.canCheck ? { type: "check" } : { type: "fold" };
}