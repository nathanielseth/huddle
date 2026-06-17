import type {
	GameEngine,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type {
	SabongState,
	ManokView,
	BracketSlot,
	SabongPlayerView,
	SabongPrivateView,
	SabongPhase,
	HideableStat,
} from "../../../../shared/games/sabong";
import type {
	SabongServerState,
	SabongServerPlayer,
	ManokStats,
	ServerBracketSlot,
	SlotOdds,
} from "./types";
import { SABONG_CONSTANTS, HIDEABLE_STATS } from "./types";
import { simulateBattle, type FighterStats } from "./battle";
import {
	getMatchupOdds,
	moneylineToDecimal,
	predictWinProbability,
} from "./odds";
import { MANOK_NAMES } from "./names";
import { parseSabongAction } from "./schemas";
import { describeMatchup } from "./matchup-tier";

const C = SABONG_CONSTANTS;

const MIN_STAT_DIFF = 10;
const QF_COUNT = 4;
const TOTAL_MATCHES = QF_COUNT * 2 - 1;
const FINAL_MATCH_INDEX = TOTAL_MATCHES - 1;
const BALANCE_ATTEMPTS = 30;
const BINARY_SEARCH_ITERATIONS = 8;

// set ensures o(1) membership test
const SHOP_TRIGGER_INDICES = new Set(C.SHOP_AFTER_MATCH_INDICES);

const VALID_TRANSITIONS: Record<SabongPhase, readonly SabongPhase[]> = {
	pre_tournament: ["betting"],
	shop: ["betting"],
	betting: ["fighting"],
	fighting: ["payout"],
	payout: ["shop", "betting", "finished"],
	finished: [],
};

// throws on illegal transitions (timer-driven paths, indicates bug)
// use warninvalidphase for action-driven paths (stale client actions)
function assertTransition(from: SabongPhase, to: SabongPhase): void {
	if (!VALID_TRANSITIONS[from].includes(to)) {
		throw new Error(`[sabong] illegal phase transition: ${from} → ${to}`);
	}
}

function warnInvalidPhase(expected: SabongPhase, actual: SabongPhase): void {
	if (process.env["NODE_ENV"] !== "production") {
		console.warn(
			`[sabong] action rejected: expected phase "${expected}", got "${actual}"`,
		);
	}
}

function randInt([min, max]: [number, number]): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randId(): string {
	return Math.random().toString(36).substring(2, 10);
}

function pickUniqueNames(count: number): string[] {
	return [...MANOK_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
}

function estimateFightDuration(logLength: number): number {
	return logLength * C.FIGHT_EVENT_DURATION_MS + C.FIGHT_BUFFER_MS;
}

// applies sabotage debuffs for actual fight, public odds never use this path
function toFighterStats(m: ManokStats): FighterStats {
	return {
		id: m.id,
		health: m.health,
		attack: m.isSabotaged ? Math.floor(m.attack * 0.8) : m.attack,
		defense: m.defense,
		speed: m.speed,
		critRate: m.critRate,
		determination: m.isSabotaged ? 0 : m.determination,
	};
}

// ignores sabotage for odds computation, avoids leaking sabotage status
function toCleanFighterStats(m: ManokStats): FighterStats {
	return {
		id: m.id,
		health: m.health,
		attack: m.attack,
		defense: m.defense,
		speed: m.speed,
		critRate: m.critRate,
		determination: m.determination,
	};
}

function generateHiddenStats(): Set<HideableStat> {
	const shuffled = [...HIDEABLE_STATS].sort(() => Math.random() - 0.5);
	return new Set(shuffled.slice(0, C.HIDDEN_STAT_COUNT) as HideableStat[]);
}

function generateManok(id: string, name: string): ManokStats {
	const health = randInt(C.STAT_RANGES.health);
	return {
		id,
		name,
		health,
		maxHealth: health,
		attack: randInt(C.STAT_RANGES.attack),
		defense: randInt(C.STAT_RANGES.defense),
		speed: randInt(C.STAT_RANGES.speed),
		critRate: randInt(C.STAT_RANGES.critRate),
		determination: randInt(C.STAT_RANGES.determination),
		attackBoost: 0,
		hiddenStats: generateHiddenStats(),
		isSabotaged: false,
	};
}

// ensures enough stats differ by min_stat_diff for visible contrast, mutates f2 in place
function enforceStatDifferencesInPlace(f1: ManokStats, f2: ManokStats): void {
	const differs = (a: number, b: number) => Math.abs(a - b) >= MIN_STAT_DIFF;
	const clamp = (v: number, range: readonly [number, number]) =>
		Math.max(range[0], Math.min(range[1], v));

	let count = (
		[
			[f1.health, f2.health],
			[f1.attack, f2.attack],
			[f1.defense, f2.defense],
			[f1.speed, f2.speed],
			[f1.critRate, f2.critRate],
		] as const
	).filter(([a, b]) => differs(a, b)).length;

	if (count >= C.MIN_STAT_DIFF_COUNT) return;

	const candidates: Array<{ needsAdjust: () => boolean; adjust: () => void }> =
		[
			{
				needsAdjust: () => !differs(f1.speed, f2.speed),
				adjust: () => {
					const s = f2.speed <= f1.speed ? MIN_STAT_DIFF : -MIN_STAT_DIFF;
					f2.speed = clamp(f2.speed + s, C.STAT_RANGES.speed);
				},
			},
			{
				needsAdjust: () => !differs(f1.critRate, f2.critRate),
				adjust: () => {
					const s = f2.critRate <= f1.critRate ? MIN_STAT_DIFF : -MIN_STAT_DIFF;
					f2.critRate = clamp(f2.critRate + s, C.STAT_RANGES.critRate);
				},
			},
			{
				needsAdjust: () => !differs(f1.defense, f2.defense),
				adjust: () => {
					const s = f2.defense <= f1.defense ? MIN_STAT_DIFF : -MIN_STAT_DIFF;
					f2.defense = clamp(f2.defense + s, C.STAT_RANGES.defense);
				},
			},
		];

	for (const c of candidates) {
		if (count >= C.MIN_STAT_DIFF_COUNT) break;
		if (c.needsAdjust()) {
			c.adjust();
			count++;
		}
	}
}

function createBalancedOpponent(
	base: ManokStats,
	id: string,
	name: string,
): ManokStats {
	const clamp = (v: number, range: readonly [number, number]) =>
		Math.max(range[0], Math.min(range[1], v));

	const opp: ManokStats = {
		id,
		name,
		health: C.STAT_RANGES.health[0] + C.STAT_RANGES.health[1] - base.health,
		maxHealth: 0,
		attack: base.attack,
		defense: C.STAT_RANGES.defense[0] + C.STAT_RANGES.defense[1] - base.defense,
		speed: clamp(base.speed + randInt([-10, 10]), C.STAT_RANGES.speed),
		critRate:
			C.STAT_RANGES.critRate[0] + C.STAT_RANGES.critRate[1] - base.critRate,
		determination: randInt(C.STAT_RANGES.determination),
		attackBoost: 0,
		hiddenStats: generateHiddenStats(),
		isSabotaged: false,
	};
	opp.maxHealth = opp.health;

	let lo = C.STAT_RANGES.attack[0];
	let hi = C.STAT_RANGES.attack[1];
	for (let i = 0; i < BINARY_SEARCH_ITERATIONS; i++) {
		const mid = Math.round((lo + hi) / 2);
		opp.attack = mid;
		const p = predictWinProbability(
			toCleanFighterStats(base),
			toCleanFighterStats(opp),
		);
		if (Math.abs(p - 0.5) <= C.BALANCE_TOLERANCE) break;
		if (p > 0.5) lo = mid + 1;
		else hi = mid - 1;
	}
	return opp;
}

function generateBalancedPair(
	id1: string,
	name1: string,
	id2: string,
	name2: string,
): [ManokStats, ManokStats] {
	let bestPair: [ManokStats, ManokStats] | null = null;
	let bestDist = Infinity;

	for (let attempt = 0; attempt < BALANCE_ATTEMPTS; attempt++) {
		const m1 = generateManok(id1, name1);
		const m2 = generateManok(id2, name2);
		const dist = Math.abs(
			predictWinProbability(toCleanFighterStats(m1), toCleanFighterStats(m2)) -
				0.5,
		);
		if (dist < bestDist) {
			bestDist = dist;
			bestPair = [m1, m2];
		}
		if (dist <= C.BALANCE_TOLERANCE) {
			enforceStatDifferencesInPlace(m1, m2);
			return [m1, m2];
		}
	}

	const [base] = bestPair!;
	const opp = createBalancedOpponent(base, id2, name2);
	enforceStatDifferencesInPlace(base, opp);
	return [base, opp];
}

function buildAdvancementMap(
	qfCount: number,
): Record<number, { slot: number; position: "fighter1Id" | "fighter2Id" }> {
	const map: Record<
		number,
		{ slot: number; position: "fighter1Id" | "fighter2Id" }
	> = {};
	let matchOffset = 0;
	let roundSize = qfCount;
	while (roundSize > 1) {
		const nextRoundOffset = matchOffset + roundSize;
		for (let i = 0; i < roundSize; i++) {
			map[matchOffset + i] = {
				slot: nextRoundOffset + Math.floor(i / 2),
				position: i % 2 === 0 ? "fighter1Id" : "fighter2Id",
			};
		}
		matchOffset += roundSize;
		roundSize = Math.floor(roundSize / 2);
	}
	return map;
}

const ADVANCEMENT = buildAdvancementMap(QF_COUNT);

function buildInitialBracket(manoks: ManokStats[]): ServerBracketSlot[] {
	const qf: ServerBracketSlot[] = Array.from({ length: QF_COUNT }, (_, i) => ({
		matchIndex: i,
		fighter1Id: manoks[i * 2]!.id,
		fighter2Id: manoks[i * 2 + 1]!.id,
		winnerId: null,
		odds: null,
	}));
	const later: ServerBracketSlot[] = Array.from(
		{ length: TOTAL_MATCHES - QF_COUNT },
		(_, i) => ({
			matchIndex: QF_COUNT + i,
			fighter1Id: null,
			fighter2Id: null,
			winnerId: null,
			odds: null,
		}),
	);
	return [...qf, ...later];
}

function advanceBracket(
	bracket: ServerBracketSlot[],
	completedMatchIndex: number,
	winnerId: string,
): void {
	const next = ADVANCEMENT[completedMatchIndex];
	if (next) bracket[next.slot]![next.position] = winnerId;
}

// uses clean stats so public odds unaffected by sabotage
function computeSlotOdds(
	slot: ServerBracketSlot,
	manoks: Map<string, ManokStats>,
): SlotOdds | null {
	const f1 = slot.fighter1Id ? manoks.get(slot.fighter1Id) : undefined;
	const f2 = slot.fighter2Id ? manoks.get(slot.fighter2Id) : undefined;
	if (!f1 || !f2) return null;
	return getMatchupOdds(toCleanFighterStats(f1), toCleanFighterStats(f2));
}

// builds per-player private snapshots for each engine result
function buildPrivatePayloads(
	state: SabongServerState,
): Map<string, SabongPrivateView> {
	const payloads = new Map<string, SabongPrivateView>();

	for (const [playerId, player] of state.players) {
		const revealedStats: Record<
			string,
			Partial<Record<HideableStat, number>>
		> = {};
		for (const [manokId, statNames] of player.revealedStats) {
			const manok = state.manoks.get(manokId);
			if (!manok) continue;
			revealedStats[manokId] = {};
			for (const stat of statNames) {
				revealedStats[manokId]![stat] = manok[stat];
			}
		}

		// show debuffed values only to sabotaging player
		const sabotaged: Record<string, { attack: number; determination: number }> =
			{};
		for (const manokId of player.sabotageTargets) {
			const manok = state.manoks.get(manokId);
			if (!manok) continue;
			sabotaged[manokId] = {
				attack: Math.floor(manok.attack * 0.8),
				determination: 0,
			};
		}

		payloads.set(playerId, {
			revealedStats,
			sabotaged,
			// 0 cap means unlimited, so null in view
			shopSpyRemaining:
				C.SPY_CAP === 0 ? null : Math.max(0, C.SPY_CAP - player.shopSpyUsed),
			shopSabotageRemaining:
				C.SABOTAGE_CAP === 0
					? null
					: Math.max(0, C.SABOTAGE_CAP - player.shopSabotageUsed),
		});
	}

	return payloads;
}

function markDirty(state: SabongServerState): void {
	state._publicStateCacheValid = false;
}

function getPublicState(state: SabongServerState): SabongState {
	if (state._publicStateCacheValid && state._cachedPublicState) {
		return state._cachedPublicState;
	}
	state._cachedPublicState = buildPublicState(state);
	state._publicStateCacheValid = true;
	return state._cachedPublicState;
}

function allPicksLocked(state: SabongServerState): boolean {
	return state.lockedPickCount >= state.players.size;
}

function allBetsLocked(state: SabongServerState): boolean {
	return state.lockedBetCount >= state.players.size;
}

function buildManokView(
	manok: ManokStats,
	matchOdds: SlotOdds | null,
	isFighter1: boolean,
): ManokView {
	const moneylineOdds = matchOdds
		? isFighter1
			? matchOdds.moneyline.fighter1
			: matchOdds.moneyline.fighter2
		: 0;
	const winProbability = matchOdds
		? isFighter1
			? matchOdds.probability.fighter1
			: matchOdds.probability.fighter2
		: 0.5;

	const matchup = matchOdds
		? describeMatchup(matchOdds.probability.fighter1)
		: null;
	const fighter1IsFavorite = matchOdds
		? matchOdds.probability.fighter1 >= 0.5
		: true;
	const side = matchup
		? isFighter1 === fighter1IsFavorite
			? matchup.favorite
			: matchup.underdog
		: null;

	return {
		id: manok.id,
		name: manok.name,
		stats: {
			health: manok.hiddenStats.has("health") ? null : manok.health,
			attack: manok.hiddenStats.has("attack") ? null : manok.attack,
			defense: manok.hiddenStats.has("defense") ? null : manok.defense,
			speed: manok.hiddenStats.has("speed") ? null : manok.speed,
			critRate: manok.hiddenStats.has("critRate") ? null : manok.critRate,
		},
		maxHp: manok.maxHealth,
		moneylineOdds,
		winProbability,
		matchupTier: side?.tier ?? null,
		matchupLabel: side?.label ?? null,
		matchupSubtitle: side?.subtitle ?? null,
		matchupEdge: side?.edge ?? null,
		isSabotaged: manok.isSabotaged,
	};
}

function buildPublicState(state: SabongServerState): SabongState {
	const currentSlot = state.bracket[state.currentMatchIndex];

	const manoks: Record<string, ManokView> = {};
	for (const manok of state.manoks.values()) {
		const isInMatch =
			currentSlot?.fighter1Id === manok.id ||
			currentSlot?.fighter2Id === manok.id;
		manoks[manok.id] = buildManokView(
			manok,
			isInMatch ? (currentSlot?.odds ?? null) : null,
			currentSlot?.fighter1Id === manok.id,
		);
	}

	const bracket: BracketSlot[] = state.bracket.map(
		({ matchIndex, fighter1Id, fighter2Id, winnerId }) => ({
			matchIndex,
			fighter1Id,
			fighter2Id,
			winnerId,
		}),
	);

	const players: Record<string, SabongPlayerView> = {};
	for (const [id, p] of state.players) {
		players[id] = {
			playerId: id,
			balance: p.balance,
			bracketPickId: p.bracketPickId,
			bracketPickLocked: p.bracketPickLocked,
			currentBet: p.currentBet,
			betLocked: p.betLocked,
		};
	}

	return {
		phase: state.phase,
		manoks,
		bracket,
		currentMatchIndex: state.currentMatchIndex,
		battleLog: state.battleLog,
		players,
		allBracketPicksLocked: allPicksLocked(state),
		matchCount: state.matchCount,
		shopConfig: {
			spyPrice: C.SPY_PRICE,
			sabotagePrice: C.SABOTAGE_PRICE,
			spyCap: C.SPY_CAP === 0 ? null : C.SPY_CAP,
			sabotageCap: C.SABOTAGE_CAP === 0 ? null : C.SABOTAGE_CAP,
		},
	};
}

// opens shop between rounds, resets per-phase counters
// intelligence data persists across shop phases
function openShop(state: SabongServerState): void {
	assertTransition(state.phase, "shop");
	for (const player of state.players.values()) {
		player.shopSpyUsed = 0;
		player.shopSabotageUsed = 0;
	}
	state.phase = "shop";
	markDirty(state);
}

// opens betting, compute odds from clean stats (sabotage excluded), grant ayuda to broke players
function openBetting(state: SabongServerState): void {
	// transition check happens before mutation
	assertTransition(state.phase, "betting");

	const slot = state.bracket[state.currentMatchIndex]!;
	state.lockedBetCount = 0;

	if (slot.fighter1Id && slot.fighter2Id) {
		slot.odds = computeSlotOdds(slot, state.manoks);
	}

	const ayuda = Math.round(
		C.AYUDA_AMOUNT * (1 + state.currentMatchIndex * C.AYUDA_SCALE),
	);
	for (const player of state.players.values()) {
		if (player.balance <= 0) {
			player.balance = ayuda;
			player.receivedAyudaThisRound = true;
		} else {
			player.receivedAyudaThisRound = false;
		}
		player.currentBet = null;
		player.betLocked = false;
	}

	state.phase = "betting";
	markDirty(state);
}

// simulates fight, tofighterstats applies sabotage debuff
function startFight(state: SabongServerState): number {
	assertTransition(state.phase, "fighting");

	const slot = state.bracket[state.currentMatchIndex]!;
	const f1 = state.manoks.get(slot.fighter1Id!)!;
	const f2 = state.manoks.get(slot.fighter2Id!)!;

	const { winnerId, log } = simulateBattle(
		toFighterStats(f1),
		toFighterStats(f2),
	);
	slot.winnerId = winnerId;
	state.battleLog = log;
	state.phase = "fighting";
	markDirty(state);

	return estimateFightDuration(log.length);
}

// distributes winnings with contrarian bonus
function applyPayouts(state: SabongServerState): Record<string, number> {
	const slot = state.bracket[state.currentMatchIndex]!;
	const winnerId = slot.winnerId!;
	const odds = slot.odds!;
	const deltas: Record<string, number> = {};

	let totalPool = 0;
	let fighter1Pool = 0;
	let fighter2Pool = 0;

	for (const player of state.players.values()) {
		if (!player.currentBet) continue;
		const { manokId, amount } = player.currentBet;
		totalPool += amount;
		if (manokId === slot.fighter1Id) {
			fighter1Pool += amount;
		} else {
			fighter2Pool += amount;
		}
	}

	for (const [playerId, player] of state.players) {
		if (!player.currentBet) continue;
		const { manokId, amount } = player.currentBet;
		const betOnFighter1 = manokId === slot.fighter1Id;

		if (manokId === winnerId) {
			const ml = betOnFighter1
				? odds.moneyline.fighter1
				: odds.moneyline.fighter2;
			const sidePool = betOnFighter1 ? fighter1Pool : fighter2Pool;
			const contraryMult =
				1 +
				(totalPool > 0 ? 1 - sidePool / totalPool : 0) * C.CONTRARIAN_BONUS_MAX;
			const payout = Math.round(
				Math.round(amount * moneylineToDecimal(ml)) * contraryMult,
			);
			player.balance += payout;
			deltas[playerId] = payout - amount;
		} else {
			deltas[playerId] = -amount;
		}
	}
	return deltas;
}

// defined once to avoid repeated closures
// timer explicitly passed to force caller awareness
function makeResult(
	state: SabongServerState,
	timer: EngineResult["timer"],
	extras?: Partial<EngineResult>,
): EngineResult {
	return {
		serverPayload: state,
		publicPayload: getPublicState(state),
		privatePayloads: buildPrivatePayloads(state),
		timer,
		...extras,
	};
}

export const sabongEngine: GameEngine = {
	gameId: "super-sabong",

	getInitialState(): SabongServerState {
		return {
			phase: "pre_tournament",
			manoks: new Map(),
			bracket: [],
			currentMatchIndex: 0,
			battleLog: null,
			players: new Map(),
			lockedPickCount: 0,
			lockedBetCount: 0,
			matchCount: 0,
			_publicStateCacheValid: false,
			_cachedPublicState: null,
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SabongServerState;

		const names = pickUniqueNames(C.MANOK_COUNT);
		const manoks: ManokStats[] = [];
		for (let i = 0; i < QF_COUNT; i++) {
			const [m1, m2] = generateBalancedPair(
				randId(),
				names[i * 2]!,
				randId(),
				names[i * 2 + 1]!,
			);
			manoks.push(m1, m2);
		}

		state.manoks = new Map(manoks.map((m) => [m.id, m]));
		state.bracket = buildInitialBracket(manoks);
		state.currentMatchIndex = 0;

		for (let i = 0; i < QF_COUNT; i++) {
			state.bracket[i]!.odds = computeSlotOdds(state.bracket[i]!, state.manoks);
		}

		state.players = new Map(
			Array.from(room.players.values()).map((p) => [
				p.playerId,
				{
					playerId: p.playerId,
					balance: C.STARTING_BALANCE,
					bracketPickId: null,
					bracketPickLocked: false,
					sabotageTargets: new Set(),
					revealedStats: new Map(),
					shopSpyUsed: 0,
					shopSabotageUsed: 0,
					currentBet: null,
					betLocked: false,
					receivedAyudaThisRound: false,
				} satisfies SabongServerPlayer,
			]),
		);

		state.phase = "pre_tournament";

		return makeResult(state, {
			startsAt: Date.now(),
			duration: C.PRE_TOURNAMENT_DURATION_MS,
		});
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SabongServerState;
		const action = parseSabongAction(raw);
		const player = state.players.get(playerId);

		// preserve current timer, no new phase
		const noOp = () => makeResult(state, room.timer);

		if (!action || !player) return noOp();

		switch (action.type) {
			case "pick_bracket_winner": {
				if (state.phase !== "pre_tournament") {
					warnInvalidPhase("pre_tournament", state.phase);
					return noOp();
				}
				if (player.bracketPickLocked) return noOp();
				if (!state.manoks.has(action.manokId)) return noOp();
				player.bracketPickId = action.manokId;
				markDirty(state);
				break;
			}

			case "lock_bracket_pick": {
				if (state.phase !== "pre_tournament") {
					warnInvalidPhase("pre_tournament", state.phase);
					return noOp();
				}
				if (!player.bracketPickId) return noOp();
				player.bracketPickLocked = true;
				state.lockedPickCount++;
				if (allPicksLocked(state)) {
					openBetting(state);
					return makeResult(state, {
						startsAt: Date.now(),
						duration: C.BETTING_DURATION_MS,
					});
				}
				markDirty(state);
				break;
			}

			// reveals one random hidden stat
			case "reveal_stat": {
				if (state.phase !== "shop") {
					warnInvalidPhase("shop", state.phase);
					return noOp();
				}

				const manok = state.manoks.get(action.manokId);
				if (!manok) return noOp();
				if (C.SPY_CAP > 0 && player.shopSpyUsed >= C.SPY_CAP) return noOp();
				if (player.balance < C.SPY_PRICE) return noOp();

				const alreadyRevealed =
					player.revealedStats.get(action.manokId) ?? new Set<HideableStat>();
				const unrevealed = [...manok.hiddenStats].filter(
					(s) => !alreadyRevealed.has(s),
				);
				if (unrevealed.length === 0) return noOp();

				const stat = unrevealed[Math.floor(Math.random() * unrevealed.length)]!;
				alreadyRevealed.add(stat);
				player.revealedStats.set(action.manokId, alreadyRevealed);
				player.balance -= C.SPY_PRICE;
				player.shopSpyUsed++;
				// marks dirty: balance changed
				markDirty(state);
				break;
			}

			// applies permanent debuff (attack ×0.8, determination → 0), persists, public odds not recalculated
			case "sabotage_manok": {
				if (state.phase !== "shop") {
					warnInvalidPhase("shop", state.phase);
					return noOp();
				}

				const manok = state.manoks.get(action.manokId);
				if (!manok) return noOp();
				if (manok.isSabotaged) return noOp();
				if (C.SABOTAGE_CAP > 0 && player.shopSabotageUsed >= C.SABOTAGE_CAP)
					return noOp();
				if (player.balance < C.SABOTAGE_PRICE) return noOp();

				manok.isSabotaged = true;
				player.sabotageTargets.add(action.manokId);
				player.balance -= C.SABOTAGE_PRICE;
				player.shopSabotageUsed++;
				// marks dirty: sabotage exposed and balance changed
				markDirty(state);
				break;
			}

			case "place_bet": {
				if (state.phase !== "betting") {
					warnInvalidPhase("betting", state.phase);
					return noOp();
				}
				if (player.betLocked) return noOp();

				const slot = state.bracket[state.currentMatchIndex]!;
				if (
					action.manokId !== slot.fighter1Id &&
					action.manokId !== slot.fighter2Id
				) {
					return noOp();
				}

				player.currentBet = {
					manokId: action.manokId,
					amount: Math.min(action.amount, player.balance),
				};
				markDirty(state);
				break;
			}

			case "lock_bet": {
				if (state.phase !== "betting") {
					warnInvalidPhase("betting", state.phase);
					return noOp();
				}
				if (!player.currentBet || player.betLocked) return noOp();

				player.balance -= player.currentBet.amount;
				player.betLocked = true;
				state.lockedBetCount++;

				if (!allBetsLocked(state)) {
					markDirty(state);
					break;
				}

				const slot = state.bracket[state.currentMatchIndex]!;
				if (!slot.fighter1Id || !slot.fighter2Id) return noOp();

				const duration = startFight(state);
				return makeResult(state, { startsAt: Date.now(), duration });
			}
		}

		return makeResult(state, room.timer);
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SabongServerState;

		const noOp = () => makeResult(state, null);

		if (state.phase === "pre_tournament") {
			const manokIds = [...state.manoks.keys()];
			for (const player of state.players.values()) {
				if (!player.bracketPickId) {
					player.bracketPickId =
						manokIds[Math.floor(Math.random() * manokIds.length)]!;
				}
				if (!player.bracketPickLocked) {
					player.bracketPickLocked = true;
					state.lockedPickCount++;
				}
			}
			openBetting(state);
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.BETTING_DURATION_MS,
			});
		}

		if (state.phase === "shop") {
			state.currentMatchIndex++;
			state.battleLog = null;
			openBetting(state);
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.BETTING_DURATION_MS,
			});
		}

		if (state.phase === "betting") {
			const slot = state.bracket[state.currentMatchIndex]!;
			if (!slot.fighter1Id || !slot.fighter2Id) return noOp();

			for (const player of state.players.values()) {
				if (player.betLocked) continue;
				if (!player.currentBet) {
					const manokId =
						Math.random() < 0.5 ? slot.fighter1Id : slot.fighter2Id;
					player.currentBet = { manokId, amount: Math.min(1, player.balance) };
				}
				player.balance -= player.currentBet.amount;
				player.betLocked = true;
				state.lockedBetCount++;
			}

			const duration = startFight(state);
			return makeResult(state, { startsAt: Date.now(), duration });
		}

		if (state.phase === "fighting") {
			const completedSlot = state.bracket[state.currentMatchIndex];
			if (!completedSlot?.winnerId) return noOp();

			const scoreDeltas = applyPayouts(state);
			advanceBracket(
				state.bracket,
				state.currentMatchIndex,
				completedSlot.winnerId,
			);
			state.matchCount++;
			assertTransition(state.phase, "payout");
			state.phase = "payout";
			markDirty(state);

			return makeResult(
				state,
				{ startsAt: Date.now(), duration: C.PAYOUT_DURATION_MS },
				{ scoreDeltas },
			);
		}

		if (state.phase === "payout") {
			if (state.currentMatchIndex === FINAL_MATCH_INDEX) {
				const tournamentWinner = state.bracket[FINAL_MATCH_INDEX]?.winnerId;
				if (!tournamentWinner) return noOp();

				const bonusDeltas: Record<string, number> = {};
				for (const [playerId, player] of state.players) {
					if (player.bracketPickId === tournamentWinner) {
						player.balance += C.BRACKET_PICK_BONUS;
						bonusDeltas[playerId] = C.BRACKET_PICK_BONUS;
					}
				}

				assertTransition(state.phase, "finished");
				state.phase = "finished";
				state.battleLog = null;
				markDirty(state);

				return makeResult(state, null, {
					roomPhase: "ended",
					scoreDeltas: bonusDeltas,
				});
			}

			// round break: open shop if triggered, else advance
			if (SHOP_TRIGGER_INDICES.has(state.currentMatchIndex)) {
				state.battleLog = null;
				openShop(state);
				return makeResult(state, {
					startsAt: Date.now(),
					duration: C.SHOP_DURATION_MS,
				});
			}

			state.currentMatchIndex++;
			state.battleLog = null;
			openBetting(state);
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.BETTING_DURATION_MS,
			});
		}

		return noOp();
	},
};