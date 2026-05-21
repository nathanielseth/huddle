import { evaluate, getCardCode } from "@pokertools/evaluator";
import type { Card } from "../../../../../../shared/poker";
import {
	buildComboAlias,
	sampleComboAlias,
	type ComboAlias,
	type RangeWeights,
} from "../ranges";
import { RANK_CHARS, SUIT_CHARS } from "../../lib/cards";
export const ALL_CARD_CODES: readonly number[] = Object.freeze(
	RANK_CHARS.flatMap((r) => SUIT_CHARS.map((s) => getCardCode(`${r}${s}`))),
);

// do NOT use in calculateEquityVsRanges
const _hero: number[] = [0, 0, 0, 0, 0, 0, 0];
const _opp: number[] = [0, 0, 0, 0, 0, 0, 0];
const _deck: number[] = new Array<number>(52);

function fillAvailableDeck(usedSet: ReadonlySet<number>): number {
	let n = 0;
	for (const code of ALL_CARD_CODES) {
		if (!usedSet.has(code)) _deck[n++] = code;
	}
	return n;
}

function shuffleDeck(length: number): void {
	for (let i = length - 1; i > 0; i--) {
		const j = (Math.random() * (i + 1)) | 0;
		const tmp = _deck[i]!;
		_deck[i] = _deck[j]!;
		_deck[j] = tmp;
	}
}

export interface EquityResult {
	readonly equity: number; // hero's win probability [0, 1]
	readonly samples: number;
	readonly exact: boolean; // true when mathematically exact
}

// routes to exact river enumeration (HU on river) or monte carlo
export function calculateEquity(
	holeCardCodes: readonly [number, number],
	boardCodes: readonly number[],
	numOpponents: number,
	samples: number,
): EquityResult {
	if (boardCodes.length === 5 && numOpponents === 1) {
		return enumerateRiverEquity(holeCardCodes, boardCodes);
	}
	return monteCarloEquity(holeCardCodes, boardCodes, numOpponents, samples);
}

export function calculateEquityVsRanges(
	holeCardCodes: readonly [number, number],
	boardCodes: readonly number[],
	opponentRanges: readonly RangeWeights[],
	samples: number,
): EquityResult {
	const numOpp = opponentRanges.length;
	if (numOpp === 0) return { equity: 1, samples: 0, exact: false };

	const boardCount = boardCodes.length;
	const boardNeeded = 5 - boardCount;
	const heroBlocked = new Set<number>([...holeCardCodes, ...boardCodes]);

	// vose's method
	const oppAlias: ComboAlias[] = opponentRanges.map((r) =>
		buildComboAlias(r, heroBlocked),
	);

	// if any range collapses to zero valid combos, fall back to uniform MC
	for (const ca of oppAlias) {
		if (ca.combos.length === 0) {
			return calculateEquity(holeCardCodes, boardCodes, numOpp, samples);
		}
	}

	if (boardCodes.length === 5 && numOpp === 1) {
		return enumerateRiverEquityVsRange(holeCardCodes, boardCodes, oppAlias[0]!);
	}

	// pool of cards available for board runout
	const basePool = ALL_CARD_CODES.filter((c) => !heroBlocked.has(c));

	// pre-allocated runout buffer
	const runoutBuf = new Array<number>(basePool.length);

	// working hands
	const heroHand = new Array<number>(7);
	heroHand[0] = holeCardCodes[0];
	heroHand[1] = holeCardCodes[1];
	for (let i = 0; i < boardCount; i++) heroHand[2 + i] = boardCodes[i]!;

	const oppHand = new Array<number>(7);
	for (let i = 0; i < boardCount; i++) oppHand[2 + i] = boardCodes[i]!;

	let wins = 0;
	let counted = 0;

	for (let smp = 0; smp < samples; smp++) {
		// sample opponent hole cards from their ranges
		const usedThisSample = new Set<number>(heroBlocked);
		const sampledOppCards: [number, number][] = [];
		let valid = true;

		for (let o = 0; o < numOpp; o++) {
			let found: [number, number] | null = null;

			// rejection sampling
			for (let attempt = 0; attempt < 20; attempt++) {
				const candidate = sampleComboAlias(oppAlias[o]!);
				if (
					candidate !== null &&
					!usedThisSample.has(candidate[0]) &&
					!usedThisSample.has(candidate[1])
				) {
					found = candidate;
					usedThisSample.add(candidate[0]);
					usedThisSample.add(candidate[1]);
					break;
				}
			}

			if (!found) {
				valid = false;
				break;
			}
			sampledOppCards.push(found);
		}

		if (!valid) continue;

		// build runout pool in-place (no allocation)
		let poolLen = 0;
		for (let bi = 0; bi < basePool.length; bi++) {
			if (!usedThisSample.has(basePool[bi]!)) {
				runoutBuf[poolLen++] = basePool[bi]!;
			}
		}

		// partial fisher-yates over runoutBuf
		for (let i = 0; i < boardNeeded; i++) {
			const j = i + ((Math.random() * (poolLen - i)) | 0);
			const tmp = runoutBuf[i]!;
			runoutBuf[i] = runoutBuf[j]!;
			runoutBuf[j] = tmp;
			heroHand[2 + boardCount + i] = runoutBuf[i]!;
			oppHand[2 + boardCount + i] = runoutBuf[i]!;
		}

		// evaluate
		const heroScore = evaluate(heroHand);
		let heroWins = true;
		let tied = 0;

		for (let o = 0; o < numOpp; o++) {
			const [c0, c1] = sampledOppCards[o]!;
			oppHand[0] = c0;
			oppHand[1] = c1;
			const oppScore = evaluate(oppHand);
			if (oppScore < heroScore) {
				heroWins = false;
				break;
			}
			if (oppScore === heroScore) tied++;
		}

		if (heroWins) wins += tied === 0 ? 1 : 1 / (tied + 1);
		counted++;
	}

	const equity = counted > 0 ? wins / counted : 0.5;
	return { equity, samples: counted, exact: false };
}

// converts Card strings to integer codes. call once before calculateEquity*
export function toCardCodes(cards: readonly Card[]): number[] {
	return cards.map(getCardCode);
}

function monteCarloEquity(
	holeCardCodes: readonly [number, number],
	boardCodes: readonly number[],
	numOpponents: number,
	samples: number,
): EquityResult {
	const boardCount = boardCodes.length;
	const boardNeeded = 5 - boardCount;
	const runoutStart = numOpponents * 2;
	const cardsNeeded = runoutStart + boardNeeded;

	const usedSet = new Set<number>([...holeCardCodes, ...boardCodes]);
	const deckSize = fillAvailableDeck(usedSet);

	if (deckSize < cardsNeeded) {
		return { equity: 0.5, samples: 0, exact: false };
	}

	_hero[0] = holeCardCodes[0];
	_hero[1] = holeCardCodes[1];

	for (let i = 0; i < boardCount; i++) {
		_hero[2 + i] = boardCodes[i]!;
		_opp[2 + i] = boardCodes[i]!;
	}

	let wins = 0;

	for (let s = 0; s < samples; s++) {
		shuffleDeck(deckSize);

		for (let i = 0; i < boardNeeded; i++) {
			const card = _deck[runoutStart + i]!;
			_hero[2 + boardCount + i] = card;
			_opp[2 + boardCount + i] = card;
		}

		const heroScore = evaluate(_hero);
		let heroWins = true;
		let numTied = 0;

		for (let o = 0; o < numOpponents; o++) {
			_opp[0] = _deck[o * 2]!;
			_opp[1] = _deck[o * 2 + 1]!;
			const oppScore = evaluate(_opp);

			if (oppScore < heroScore) {
				heroWins = false;
				break;
			}
			if (oppScore === heroScore) numTied++;
		}

		if (heroWins) {
			wins += numTied === 0 ? 1 : 1 / (numTied + 1);
		}
	}

	return { equity: wins / samples, samples, exact: false };
}

function enumerateRiverEquity(
	holeCardCodes: readonly [number, number],
	boardCodes: readonly number[],
): EquityResult {
	const usedSet = new Set<number>([...holeCardCodes, ...boardCodes]);
	const available = ALL_CARD_CODES.filter((c) => !usedSet.has(c));

	const heroScore = evaluate([...holeCardCodes, ...boardCodes] as number[]);

	for (let i = 0; i < 5; i++) _opp[2 + i] = boardCodes[i]!;

	const totalCombos = (available.length * (available.length - 1)) / 2;
	let wins = 0;

	for (let i = 0; i < available.length - 1; i++) {
		_opp[0] = available[i]!;
		for (let j = i + 1; j < available.length; j++) {
			_opp[1] = available[j]!;
			const oppScore = evaluate(_opp);
			if (heroScore < oppScore) wins += 1;
			else if (heroScore === oppScore) wins += 0.5;
		}
	}

	return { equity: wins / totalCombos, samples: totalCombos, exact: true };
}

function enumerateRiverEquityVsRange(
	holeCardCodes: readonly [number, number],
	boardCodes: readonly number[],
	oppAlias: ComboAlias,
): EquityResult {
	const heroScore = evaluate([...holeCardCodes, ...boardCodes] as number[]);

	const oppHand = new Array<number>(7);
	for (let i = 0; i < 5; i++) oppHand[2 + i] = boardCodes[i]!;

	let equity = 0;
	let totalWeight = 0;

	for (const { c0, c1, weight } of oppAlias.combos) {
		oppHand[0] = c0;
		oppHand[1] = c1;
		const oppScore = evaluate(oppHand);

		if (heroScore < oppScore) equity += weight;
		else if (heroScore === oppScore) equity += weight * 0.5;

		totalWeight += weight;
	}

	return {
		equity: totalWeight > 0 ? equity / totalWeight : 0.5,
		samples: oppAlias.combos.length,
		exact: true,
	};
}