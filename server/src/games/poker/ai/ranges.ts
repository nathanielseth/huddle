import { getCardCode, evaluate } from "@pokertools/evaluator";
import { RANK_CHARS, SUIT_CHARS } from "../lib/cards";
import { PREFLOP_EQUITY_DATA } from "./equity/table";

// integer card code for rank r [0-12, A=12] and suit s [0-3]
function cc(r: number, s: number): number {
	return getCardCode(`${RANK_CHARS[r]}${SUIT_CHARS[s]}`);
}

const CARD_TO_SUIT = new Map<number, number>();
for (let r = 0; r <= 12; r++) {
	for (let s = 0; s < 4; s++) {
		CARD_TO_SUIT.set(cc(r, s), s);
	}
}

export interface HandType {
	readonly index: number; // 0–168
	readonly name: string; // "AA", "AKs", "AKo"
	readonly r1: number; // high rank [0-12, A=12]
	readonly r2: number; // low rank (= r1 for pairs)
	readonly suited: boolean;
	readonly isPair: boolean;
	readonly combos: ReadonlyArray<readonly [number, number]>;
}

function buildHandTypes(): HandType[] {
	const types: HandType[] = [];
	let idx = 0;

	// 13 pairs: AA=0 … 22=12 (6 combos each)
	for (let r = 12; r >= 0; r--) {
		const combos: [number, number][] = [];
		for (let s1 = 0; s1 < 4; s1++)
			for (let s2 = s1 + 1; s2 < 4; s2++) combos.push([cc(r, s1), cc(r, s2)]);
		types.push({
			index: idx++,
			name: `${RANK_CHARS[r]}${RANK_CHARS[r]}`,
			r1: r,
			r2: r,
			suited: false,
			isPair: true,
			combos,
		});
	}

	// 78 suited: AKs=13 … 32s=90 (4 combos each)
	for (let r1 = 12; r1 >= 1; r1--)
		for (let r2 = r1 - 1; r2 >= 0; r2--) {
			const combos: [number, number][] = [];
			for (let s = 0; s < 4; s++) combos.push([cc(r1, s), cc(r2, s)]);
			types.push({
				index: idx++,
				name: `${RANK_CHARS[r1]}${RANK_CHARS[r2]}s`,
				r1,
				r2,
				suited: true,
				isPair: false,
				combos,
			});
		}

	// 78 offsuit: AKo=91 … 32o=168 (12 combos each)
	for (let r1 = 12; r1 >= 1; r1--)
		for (let r2 = r1 - 1; r2 >= 0; r2--) {
			const combos: [number, number][] = [];
			for (let s1 = 0; s1 < 4; s1++)
				for (let s2 = 0; s2 < 4; s2++)
					if (s1 !== s2) combos.push([cc(r1, s1), cc(r2, s2)]);
			types.push({
				index: idx++,
				name: `${RANK_CHARS[r1]}${RANK_CHARS[r2]}o`,
				r1,
				r2,
				suited: false,
				isPair: false,
				combos,
			});
		}

	return types; // 13 + 78 + 78 = 169
}

export const ALL_HAND_TYPES: readonly HandType[] =
	Object.freeze(buildHandTypes());

export const PREFLOP_EQUITY: ReadonlyArray<Float32Array> = Object.freeze(
	PREFLOP_EQUITY_DATA.map((row) => new Float32Array(row)),
);

export type RangeWeights = Float32Array;

export function uniformRange(): RangeWeights {
	return new Float32Array(169).fill(1.0);
}

// builds a range with top topPct% of all 1326 combos, ranked by preflop equity
export function buildRangeByPercentile(
	topPct: number,
	numOpp: number,
): RangeWeights {
	const oppIdx = Math.min(Math.max(numOpp - 1, 0), 4);
	const pct = Math.max(0, Math.min(100, topPct));

	const sorted = Array.from(ALL_HAND_TYPES)
		.map((ht) => ({
			index: ht.index,
			equity: PREFLOP_EQUITY[ht.index]![oppIdx]!,
			n: ht.combos.length,
		}))
		.sort((a, b) => b.equity - a.equity);

	const target = Math.round((1326 * pct) / 100);
	const weights = new Float32Array(169);
	let included = 0;

	for (const { index, n } of sorted) {
		if (included >= target) break;
		const space = target - included;
		if (space >= n) {
			weights[index] = 1.0;
			included += n;
		} else {
			weights[index] = space / n;
			included = target;
		}
	}

	return weights;
}

// personality parameters for range inference
export interface RangeProfile {
	openRangePct: number;
	threeBetRangePct: number;
	coldCallPct: number;
}

// narrows opponent's preflop range based on observed action
export function narrowPreflopRange(
	current: RangeWeights,
	action: string,
	betToCall: number,
	bigBlind: number,
	profile: RangeProfile,
	numOpp: number,
	positionFactor: number,
): RangeWeights {
	const posMult = 0.55 + positionFactor * 0.45;

	if (action === "raise" || action === "all_in") {
		let basePct: number;

		if (betToCall <= bigBlind) {
			basePct = profile.openRangePct;
		} else if (betToCall <= bigBlind * 7) {
			basePct = profile.threeBetRangePct;
		} else {
			basePct = Math.max(3, profile.threeBetRangePct * 0.45);
		}

		const actionRange = buildRangeByPercentile(
			Math.max(3, basePct * posMult),
			numOpp,
		);

		const result = new Float32Array(169);
		for (let i = 0; i < 169; i++) {
			result[i] = (current[i] ?? 0) * (actionRange[i] ?? 0);
		}

		// renormalise so weights stay in [0, 1]
		let maxWeight = 0;
		for (let i = 0; i < 169; i++) {
			if (result[i]! > maxWeight) maxWeight = result[i]!;
		}
		if (maxWeight > 0) {
			for (let i = 0; i < 169; i++) result[i] = result[i]! / maxWeight;
		}

		return result;
	}

	if (action === "call") {
		const effectivePct = Math.max(8, profile.coldCallPct * posMult);
		return buildRangeByPercentile(effectivePct, numOpp);
	}

	return current;
}

// evaluates a hand type on the actual board
function _boardScore(
	ht: HandType,
	boardSet: ReadonlySet<number>,
	boardCodes: readonly number[],
): number {
	for (const [c0, c1] of ht.combos) {
		if (!boardSet.has(c0) && !boardSet.has(c1)) {
			return evaluate([c0, c1, ...boardCodes] as number[]);
		}
	}
	return 7462;
}

// returns the fraction of board cards sharing the most common suit [0, 1]
function boardFlushTexture(boardCodes: readonly number[]): number {
	if (boardCodes.length === 0) return 0;
	const counts = [0, 0, 0, 0];
	for (const code of boardCodes) {
		const suit = CARD_TO_SUIT.get(code) ?? 0;
		counts[suit] = (counts[suit] ?? 0) + 1;
	}
	return Math.max(...counts) / boardCodes.length;
}

// fraction of range to remove when opponent bets. scales with bet size
const CULL_BASE = 0.3;
const CULL_SCALE = 0.22;
const CULL_MAX = 0.65;

// fraction removed from top of range when opponent checks
const CHECK_CULL_PCT = 0.2;

// culls a percentage of the range by board-relative strength
function _cull(
	result: Float32Array,
	scored: readonly { index: number; score: number }[],
	pct: number,
	removeWeakest: boolean,
): void {
	const totalCombos = ALL_HAND_TYPES.reduce(
		(s, ht) => s + ht.combos.length * (result[ht.index] ?? 0),
		0,
	);
	const target = totalCombos * pct;
	let removed = 0;

	const order = removeWeakest ? [...scored].reverse() : [...scored];

	for (const { index } of order) {
		if (removed >= target) break;
		const ht = ALL_HAND_TYPES[index]!;
		const combos = ht.combos.length * (result[index] ?? 0);
		if (combos <= 0) continue;

		const space = target - removed;
		if (space >= combos) {
			result[index] = 0;
			removed += combos;
		} else {
			result[index]! *= (combos - space) / combos;
			removed = target;
		}
	}
}

// board-relative postflop range filter
export function narrowPostflopRange(
	current: RangeWeights,
	action: string,
	boardCodes: readonly number[],
	betFraction = 0.5,
): RangeWeights {
	if (boardCodes.length === 0) return new Float32Array(current);

	const result = new Float32Array(current);
	const boardSet = new Set<number>(boardCodes);

	// score all in-range hand types on this board, strongest first
	const scored: { index: number; score: number }[] = [];
	for (const ht of ALL_HAND_TYPES) {
		if ((result[ht.index] ?? 0) <= 0) continue;
		scored.push({
			index: ht.index,
			score: _boardScore(ht, boardSet, boardCodes),
		});
	}
	scored.sort((a, b) => a.score - b.score);

	if (action === "raise" || action === "all_in") {
		// on flush-heavy boards, villain also barrels non-flush hands for protection and fold equity
		const flushTexture = boardFlushTexture(boardCodes);
		const adjustedBase = CULL_BASE * (1 - flushTexture * 0.35);
		const clamped = Math.max(0.2, Math.min(betFraction, 3));
		const cullPct = Math.min(CULL_MAX, adjustedBase + clamped * CULL_SCALE);
		_cull(result, scored, cullPct, true);
	} else if (action === "check") {
		_cull(result, scored, CHECK_CULL_PCT, false);
	} else if (action === "call") {
		const clamped = Math.max(0.2, Math.min(betFraction, 1.5));
		_cull(result, scored, 0.06 + clamped * 0.04, false);
	}

	return result;
}

export interface WeightedCombo {
	c0: number;
	c1: number;
	weight: number; // normalized: sum across all combos = 1
}

// converts RangeWeights into normalized list of specific two-card combos,
// excluding any combo blocked by hero's hand + board
export function buildWeightedCombos(
	range: RangeWeights,
	blocked: ReadonlySet<number>,
): WeightedCombo[] {
	const result: WeightedCombo[] = [];
	let totalWeight = 0;

	for (const ht of ALL_HAND_TYPES) {
		const w = range[ht.index]!;
		if (w <= 0) continue;
		for (const [c0, c1] of ht.combos) {
			if (blocked.has(c0) || blocked.has(c1)) continue;
			result.push({ c0, c1, weight: w });
			totalWeight += w;
		}
	}

	if (totalWeight > 0) {
		for (const combo of result) combo.weight /= totalWeight;
	}

	return result;
}

export interface ComboAlias {
	readonly combos: readonly WeightedCombo[];
	readonly prob: Float64Array;
	readonly alias: Int32Array;
}

// builds a ComboAlias from a range, pre-filtered against blocked cards
export function buildComboAlias(
	range: RangeWeights,
	blocked: ReadonlySet<number>,
): ComboAlias {
	const combos = buildWeightedCombos(range, blocked);
	const n = combos.length;

	if (n === 0) {
		return { combos, prob: new Float64Array(0), alias: new Int32Array(0) };
	}

	const prob = new Float64Array(n);
	const alias = new Int32Array(n);
	const scaled = new Float64Array(n);
	const small: number[] = [];
	const large: number[] = [];

	for (let i = 0; i < n; i++) {
		scaled[i] = combos[i]!.weight * n;
		(scaled[i]! < 1 ? small : large).push(i);
	}

	while (small.length > 0 && large.length > 0) {
		const s = small.pop()!;
		const l = large.pop()!;
		prob[s] = scaled[s]!;
		alias[s] = l;
		scaled[l] = scaled[l]! + scaled[s]! - 1;
		(scaled[l]! < 1 ? small : large).push(l);
	}
	for (const i of small) prob[i] = 1;
	for (const i of large) prob[i] = 1;

	return { combos, prob, alias };
}

export function sampleComboAlias(ca: ComboAlias): [number, number] | null {
	if (ca.combos.length === 0) return null;
	const i = (Math.random() * ca.combos.length) | 0;
	const j = Math.random() < ca.prob[i]! ? i : ca.alias[i]!;
	const combo = ca.combos[j]!;
	return [combo.c0, combo.c1];
}

// kept for reference and utility; not used in hot path
export function sampleWeightedCombo(
	combos: WeightedCombo[],
): [number, number] | null {
	if (combos.length === 0) return null;
	let r = Math.random();
	for (const { c0, c1, weight } of combos) {
		r -= weight;
		if (r <= 0) return [c0, c1];
	}
	const last = combos[combos.length - 1]!;
	return [last.c0, last.c1];
}
