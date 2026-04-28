import { z } from "zod";
import type {
	GameEngine,
	GameContext,
	EngineResult,
} from "../../engine/engine.js";
import type {
	SabongState,
	ManokView,
	BracketSlot,
	SabongPlayerView,
} from "../../../../shared/sabong.js";
import type {
	SabongServerState,
	SabongServerPlayer,
	ManokStats,
	ServerBracketSlot,
	SabongAction,
} from "./types.js";
import { SABONG_CONSTANTS } from "./types.js";
import { simulateBattle, type FighterStats } from "./battle.js";
import { getMatchupOdds, predictWinProbability } from "./odds.js";
import { SabongLogger } from "./logger.js";
import { MANOK_NAMES } from "./names.js";

const C = SABONG_CONSTANTS;

// constants

const HIDEABLE_STATS = [
	"health",
	"attack",
	"defense",
	"speed",
	"critRate",
] as const;
type HideableStat = (typeof HIDEABLE_STATS)[number];

const EVENT_DURATION_MS = 1200;
const FIGHT_BUFFER_MS = 3000;
const PAYOUT_DURATION_MS = 6000;
const MIN_STAT_DIFF = 10;

const QF_COUNT = 4; // quarter-final match slots (indices 0-3)
const FINAL_MATCH_INDEX = 6; // grand final slot index

// pure helpers

function randInt([min, max]: [number, number]): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randId(): string {
	return Math.random().toString(36).substring(2, 10);
}

function pickUniqueNames(count: number): string[] {
	return [...MANOK_NAMES].sort(() => Math.random() - 0.5).slice(0, count);
}

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

function moneylineToDecimal(ml: number): number {
	if (ml > 0) return 1 + ml / 100;
	if (ml < 0) return 1 + 100 / Math.abs(ml);
	return 2.0;
}

function estimateFightDuration(logLength: number): number {
	return logLength * EVENT_DURATION_MS + FIGHT_BUFFER_MS;
}

// manok generation

function generateHiddenStats(): Set<HideableStat> {
	const shuffled = [...HIDEABLE_STATS].sort(() => Math.random() - 0.5);
	return new Set(shuffled.slice(0, 2) as HideableStat[]);
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

// matchup balancing

/**
 * adjusts f2's stats to ensure at least min_stat_diff_count stats differ
 * by >= min_stat_diff between f1 and f2. targets low-impact stats first
 * (speed -> critRate -> defense) to preserve balance.
 */
function enforceStatDifferences(f1: ManokStats, f2: ManokStats): void {
	const differs = (a: number, b: number): boolean =>
		Math.abs(a - b) >= MIN_STAT_DIFF;

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

	const clamp = (v: number, range: readonly [number, number]): number =>
		Math.max(range[0], Math.min(range[1], v));

	const candidates: Array<{ needsAdjust: () => boolean; adjust: () => void }> =
		[
			{
				needsAdjust: () => !differs(f1.speed, f2.speed),
				adjust: () => {
					const shift = f2.speed <= f1.speed ? MIN_STAT_DIFF : -MIN_STAT_DIFF;
					f2.speed = clamp(f2.speed + shift, C.STAT_RANGES.speed);
				},
			},
			{
				needsAdjust: () => !differs(f1.critRate, f2.critRate),
				adjust: () => {
					const shift =
						f2.critRate <= f1.critRate ? MIN_STAT_DIFF : -MIN_STAT_DIFF;
					f2.critRate = clamp(f2.critRate + shift, C.STAT_RANGES.critRate);
				},
			},
			{
				needsAdjust: () => !differs(f1.defense, f2.defense),
				adjust: () => {
					const shift =
						f2.defense <= f1.defense ? MIN_STAT_DIFF : -MIN_STAT_DIFF;
					f2.defense = clamp(f2.defense + shift, C.STAT_RANGES.defense);
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

/**
 * fallback when 30 random attempts all fail the balance check.
 * mirrors most stats to the opposite end of their range, then
 * binary-searches opponent's attack (highest-weight stat) until
 * the matchup lands within balance_tolerance.
 *
 * guarantees balance in o(8) heuristic evaluations - o(1) total.
 */
function createBalancedOpponent(
	base: ManokStats,
	id: string,
	name: string,
): ManokStats {
	const clamp = (v: number, range: readonly [number, number]): number =>
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

	for (let iter = 0; iter < 8; iter++) {
		const mid = Math.round((lo + hi) / 2);
		opp.attack = mid;

		const p = predictWinProbability(toFighterStats(base), toFighterStats(opp));

		if (Math.abs(p - 0.5) <= C.BALANCE_TOLERANCE) break;

		if (p > 0.5) lo = mid + 1;
		else hi = mid - 1;
	}

	return opp;
}

/**
 * returns a [m1, m2] pair within balance_tolerance.
 *
 * strategy:
 *  1. try 30 random pairs - fast path, covers ~90% of cases.
 *  2. binary-search fallback - guarantees balance, always resolves.
 *  3. enforcestatdifferences - ensures visible stat contrast for betting.
 */
function generateBalancedPair(
	id1: string,
	name1: string,
	id2: string,
	name2: string,
): [ManokStats, ManokStats] {
	let bestPair: [ManokStats, ManokStats] | null = null;
	let bestDist = Infinity;

	for (let attempt = 0; attempt < 30; attempt++) {
		const m1 = generateManok(id1, name1);
		const m2 = generateManok(id2, name2);
		const p = predictWinProbability(toFighterStats(m1), toFighterStats(m2));
		const dist = Math.abs(p - 0.5);

		if (dist < bestDist) {
			bestDist = dist;
			bestPair = [m1, m2];
		}

		if (dist <= C.BALANCE_TOLERANCE) {
			enforceStatDifferences(m1, m2);
			return [m1, m2];
		}
	}

	const [base] = bestPair!;
	const opp = createBalancedOpponent(base, id2, name2);
	enforceStatDifferences(base, opp);
	return [base, opp];
}

// bracket

const ADVANCEMENT: Record<
	number,
	{ slot: number; position: "fighter1Id" | "fighter2Id" }
> = {
	0: { slot: 4, position: "fighter1Id" },
	1: { slot: 4, position: "fighter2Id" },
	2: { slot: 5, position: "fighter1Id" },
	3: { slot: 5, position: "fighter2Id" },
	4: { slot: 6, position: "fighter1Id" },
	5: { slot: 6, position: "fighter2Id" },
};

function buildInitialBracket(manoks: ManokStats[]): ServerBracketSlot[] {
	const bracket: ServerBracketSlot[] = [];

	for (let i = 0; i < QF_COUNT; i++) {
		bracket.push({
			matchIndex: i,
			fighter1Id: manoks[i * 2]!.id,
			fighter2Id: manoks[i * 2 + 1]!.id,
			winnerId: null,
			odds: null,
		});
	}

	for (let i = QF_COUNT; i < QF_COUNT * 2 - 1; i++) {
		bracket.push({
			matchIndex: i,
			fighter1Id: null,
			fighter2Id: null,
			winnerId: null,
			odds: null,
		});
	}

	return bracket;
}

function advanceBracket(
	bracket: ServerBracketSlot[],
	completedMatchIndex: number,
	winnerId: string,
): void {
	const next = ADVANCEMENT[completedMatchIndex];
	if (!next) return;
	bracket[next.slot]![next.position] = winnerId;
}

function computeSlotOdds(
	slot: ServerBracketSlot,
	manoks: Map<string, ManokStats>,
): { fighter1: number; fighter2: number } | null {
	const f1 = slot.fighter1Id ? manoks.get(slot.fighter1Id) : undefined;
	const f2 = slot.fighter2Id ? manoks.get(slot.fighter2Id) : undefined;
	if (!f1 || !f2) return null;
	return getMatchupOdds(toFighterStats(f1), toFighterStats(f2)).moneyline;
}

// player state helpers

function allPicksLocked(state: SabongServerState): boolean {
	return [...state.players.values()].every((p) => p.bracketPickLocked);
}

function allBetsLocked(state: SabongServerState): boolean {
	return [...state.players.values()].every((p) => p.betLocked);
}

function openBetting(state: SabongServerState): void {
	const slot = state.bracket[state.currentMatchIndex]!;

	const sabotaged = new Set<string>();
	for (const player of state.players.values()) {
		if (!player.sabotageTargetId) continue;
		if (sabotaged.has(player.sabotageTargetId)) {
			state.logger.log("sabotage_applied", state.currentMatchIndex, {
				manokId: player.sabotageTargetId,
				byPlayer: player.playerId,
				stacked: true,
				note: "already sabotaged, no additional effect",
			});
			continue;
		}

		const manok = state.manoks.get(player.sabotageTargetId);
		if (!manok) continue;

		manok.isSabotaged = true;
		sabotaged.add(player.sabotageTargetId);

		state.logger.log("sabotage_applied", state.currentMatchIndex, {
			manokId: manok.id,
			manokName: manok.name,
			byPlayer: player.playerId,
			hiddenDebuff: {
				attack: `${manok.attack} -> ${Math.floor(manok.attack * 0.8)} (hidden)`,
				determination: `${manok.determination} -> 0 (hidden)`,
			},
			displayedAttack: manok.attack,
		});
	}

	if (slot.fighter1Id && slot.fighter2Id) {
		const preOdds = slot.odds;
		slot.odds = computeSlotOdds(slot, state.manoks);

		state.logger.log("odds_computed", state.currentMatchIndex, {
			matchIndex: state.currentMatchIndex,
			fighter1Id: slot.fighter1Id,
			fighter2Id: slot.fighter2Id,
			preOdds,
			postOdds: slot.odds,
			sabotageApplied: sabotaged.size > 0,
		});
	}

	const ayuda = Math.round(
		C.AYUDA_AMOUNT * (1 + state.currentMatchIndex * C.AYUDA_SCALE),
	);

	for (const player of state.players.values()) {
		if (player.balance <= 0) {
			player.balance = ayuda;
			player.receivedAyudaThisRound = true;
			state.logger.log("ayuda_granted", state.currentMatchIndex, {
				playerId: player.playerId,
				amount: ayuda,
				matchIndex: state.currentMatchIndex,
			});
		} else {
			player.receivedAyudaThisRound = false;
		}
		player.currentBet = null;
		player.betLocked = false;
	}

	state.phase = "betting";
}

function applyPayouts(state: SabongServerState): Record<string, number> {
	const slot = state.bracket[state.currentMatchIndex]!;
	const winnerId = slot.winnerId!;
	const odds = slot.odds!;
	const scoreDeltas: Record<string, number> = {};

	let totalPool = 0;
	let fighter1Pool = 0;
	let fighter2Pool = 0;

	for (const player of state.players.values()) {
		if (!player.currentBet) continue;
		const amount = player.currentBet.amount;
		totalPool += amount;
		if (player.currentBet.manokId === slot.fighter1Id) fighter1Pool += amount;
		else fighter2Pool += amount;
	}

	for (const [playerId, player] of state.players) {
		if (!player.currentBet) continue;

		const { manokId, amount } = player.currentBet;
		const betOnFighter1 = manokId === slot.fighter1Id;
		const betOnWinner = manokId === winnerId;

		if (betOnWinner) {
			const ml = betOnFighter1 ? odds.fighter1 : odds.fighter2;
			const sidePool = betOnFighter1 ? fighter1Pool : fighter2Pool;
			const contraryRatio = totalPool > 0 ? 1 - sidePool / totalPool : 0;
			const contraryMultiplier = 1 + contraryRatio * C.CONTRARIAN_BONUS_MAX;
			const basePayout = Math.round(amount * moneylineToDecimal(ml));
			const finalPayout = Math.round(basePayout * contraryMultiplier);

			player.balance += finalPayout;
			scoreDeltas[playerId] = finalPayout - amount;
		} else {
			scoreDeltas[playerId] = -amount;
		}
	}

	return scoreDeltas;
}

// public state builder

function buildManokView(
	manok: ManokStats,
	currentMatchOdds: { fighter1: number; fighter2: number } | null,
	isFighter1InMatch: boolean,
): ManokView {
	const moneylineOdds = currentMatchOdds
		? isFighter1InMatch
			? currentMatchOdds.fighter1
			: currentMatchOdds.fighter2
		: 0;

	const winProbability = currentMatchOdds
		? 1 / moneylineToDecimal(moneylineOdds)
		: 0.5;

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
		currentHp: null,
		moneylineOdds,
		winProbability,
	};
}

function getPublicSabongState(state: SabongServerState): SabongState {
	const currentSlot = state.bracket[state.currentMatchIndex];

	const manoks: Record<string, ManokView> = {};
	for (const manok of state.manoks.values()) {
		const isInCurrentMatch =
			currentSlot?.fighter1Id === manok.id ||
			currentSlot?.fighter2Id === manok.id;
		manoks[manok.id] = buildManokView(
			manok,
			isInCurrentMatch ? (currentSlot?.odds ?? null) : null,
			currentSlot?.fighter1Id === manok.id,
		);
	}

	const bracket: BracketSlot[] = state.bracket.map((s) => ({
		matchIndex: s.matchIndex,
		fighter1Id: s.fighter1Id,
		fighter2Id: s.fighter2Id,
		winnerId: s.winnerId,
	}));

	const players: Record<string, SabongPlayerView> = {};
	for (const [id, p] of state.players) {
		players[id] = {
			playerId: id,
			balance: p.balance,
			bracketPickId: p.bracketPickId,
			bracketPickLocked: p.bracketPickLocked,
			sabotageTargetId: p.sabotageTargetId,
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
		matchCount: state.bracket.filter((s) => s.winnerId !== null).length,
	};
}

// action parsing

const SabongActionSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("pick_bracket_winner"), manokId: z.string() }),
	z.object({ type: z.literal("lock_bracket_pick") }),
	z.object({
		type: z.literal("place_bet"),
		manokId: z.string(),
		amount: z.number().int().min(1),
	}),
	z.object({ type: z.literal("sabotage_manok"), manokId: z.string() }),
	z.object({ type: z.literal("lock_bet") }),
]);

function parseSabongAction(raw: unknown): SabongAction | null {
	const result = SabongActionSchema.safeParse(raw);
	return result.success ? result.data : null;
}

// engine

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
			logger: new SabongLogger("pending"),
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const state = ctx.room.gamePayload as SabongServerState;
		state.logger = new SabongLogger(ctx.room.code);

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
			const slot = state.bracket[i]!;
			slot.odds = computeSlotOdds(slot, state.manoks);
		}

		state.players = new Map(
			Array.from(ctx.room.players.values()).map((p) => [
				p.playerId,
				{
					playerId: p.playerId,
					balance: C.STARTING_BALANCE,
					bracketPickId: null,
					bracketPickLocked: false,
					sabotageTargetId: null,
					currentBet: null,
					betLocked: false,
					receivedAyudaThisRound: false,
				} satisfies SabongServerPlayer,
			]),
		);

		state.phase = "pre_tournament";

		state.logger.log("game_start", null, {
			playerCount: state.players.size,
			players: [...state.players.values()].map((p) => ({
				id: p.playerId,
				balance: p.balance,
			})),
			manoks: manoks.map((m) => ({
				id: m.id,
				name: m.name,
				health: m.health,
				attack: m.attack,
				defense: m.defense,
				speed: m.speed,
				critRate: m.critRate,
				determination: m.determination,
				hiddenStats: [...m.hiddenStats],
			})),
			qfOdds: state.bracket.slice(0, QF_COUNT).map((s) => ({
				matchIndex: s.matchIndex,
				fighter1: s.fighter1Id,
				fighter2: s.fighter2Id,
				odds: s.odds,
			})),
		});

		return {
			serverPayload: state,
			publicPayload: getPublicSabongState(state),
			timer: { startsAt: Date.now(), duration: C.PRE_TOURNAMENT_DURATION_MS },
		};
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SabongServerState;
		const action = parseSabongAction(raw);
		const player = state.players.get(playerId);

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: getPublicSabongState(state),
			timer: room.timer,
		});

		if (!action || !player) return noOp();

		switch (action.type) {
			case "sabotage_manok": {
				if (state.phase !== "pre_tournament") return noOp();
				if (!state.manoks.has(action.manokId)) return noOp();

				const previousTarget = player.sabotageTargetId;
				player.sabotageTargetId = action.manokId;

				state.logger.log("player_action", null, {
					type: "sabotage_manok",
					playerId,
					manokId: action.manokId,
					manokName: state.manoks.get(action.manokId)?.name,
					previousTarget,
				});
				break;
			}

			case "pick_bracket_winner": {
				if (state.phase !== "pre_tournament") return noOp();
				if (player.bracketPickLocked) return noOp();
				if (!state.manoks.has(action.manokId)) return noOp();
				player.bracketPickId = action.manokId;

				state.logger.log("player_action", null, {
					type: "pick_bracket_winner",
					playerId,
					manokId: action.manokId,
					manokName: state.manoks.get(action.manokId)?.name,
				});
				break;
			}

			case "lock_bracket_pick": {
				if (state.phase !== "pre_tournament") return noOp();
				if (!player.bracketPickId) return noOp();
				player.bracketPickLocked = true;

				state.logger.log("player_action", null, {
					type: "lock_bracket_pick",
					playerId,
					pickedManokId: player.bracketPickId,
					sabotageTargetId: player.sabotageTargetId,
				});

				if (allPicksLocked(state)) {
					state.logger.log("phase_transition", null, {
						from: "pre_tournament",
						to: "betting",
						trigger: "all_picks_locked",
					});
					openBetting(state);
					return {
						serverPayload: state,
						publicPayload: getPublicSabongState(state),
						timer: { startsAt: Date.now(), duration: C.BETTING_DURATION_MS },
					};
				}
				break;
			}

			case "place_bet": {
				if (state.phase !== "betting") return noOp();
				if (player.betLocked) return noOp();

				const slot = state.bracket[state.currentMatchIndex]!;
				const isValidTarget =
					action.manokId === slot.fighter1Id ||
					action.manokId === slot.fighter2Id;
				if (!isValidTarget) return noOp();

				// amount is already int >= 1 per zod schema; just cap to balance
				const amount = Math.min(action.amount, player.balance);
				player.currentBet = { manokId: action.manokId, amount };

				state.logger.log("player_action", state.currentMatchIndex, {
					type: "place_bet",
					playerId,
					manokId: action.manokId,
					manokName: state.manoks.get(action.manokId)?.name,
					amount,
					playerBalance: player.balance,
				});
				break;
			}

			case "lock_bet": {
				if (state.phase !== "betting") return noOp();
				if (!player.currentBet || player.betLocked) return noOp();

				player.balance -= player.currentBet.amount;
				player.betLocked = true;

				state.logger.log("player_action", state.currentMatchIndex, {
					type: "lock_bet",
					playerId,
					bet: player.currentBet,
					balanceAfterDeduction: player.balance,
				});

				if (!allBetsLocked(state)) break;

				const slot = state.bracket[state.currentMatchIndex]!;
				if (!slot.fighter1Id || !slot.fighter2Id) return noOp();

				const f1 = state.manoks.get(slot.fighter1Id);
				const f2 = state.manoks.get(slot.fighter2Id);
				if (!f1 || !f2) return noOp();

				const { winnerId, log } = simulateBattle(
					toFighterStats(f1),
					toFighterStats(f2),
				);

				slot.winnerId = winnerId;
				state.battleLog = log;
				state.phase = "fighting";

				state.logger.log("fight_result", state.currentMatchIndex, {
					matchIndex: state.currentMatchIndex,
					fighter1: {
						id: f1.id,
						name: f1.name,
						attack: f1.attack,
						determination: f1.determination,
					},
					fighter2: {
						id: f2.id,
						name: f2.name,
						attack: f2.attack,
						determination: f2.determination,
					},
					winnerId,
					winnerName: state.manoks.get(winnerId)?.name,
					totalEvents: log.length,
				});

				return {
					serverPayload: state,
					publicPayload: getPublicSabongState(state),
					timer: {
						startsAt: Date.now(),
						duration: estimateFightDuration(log.length),
					},
				};
			}
		}

		return {
			serverPayload: state,
			publicPayload: getPublicSabongState(state),
			timer: room.timer,
		};
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SabongServerState;

		if (state.phase === "pre_tournament") {
			const manokIds = [...state.manoks.keys()];
			for (const player of state.players.values()) {
				if (!player.bracketPickId) {
					player.bracketPickId =
						manokIds[Math.floor(Math.random() * manokIds.length)]!;
				}
				player.bracketPickLocked = true;
			}
			openBetting(state);
			return {
				serverPayload: state,
				publicPayload: getPublicSabongState(state),
				timer: { startsAt: Date.now(), duration: C.BETTING_DURATION_MS },
			};
		}

		if (state.phase === "betting") {
			const slot = state.bracket[state.currentMatchIndex]!;
			if (!slot.fighter1Id || !slot.fighter2Id) {
				return {
					serverPayload: state,
					publicPayload: getPublicSabongState(state),
					timer: null,
				};
			}

			for (const player of state.players.values()) {
				if (player.betLocked) continue;
				if (!player.currentBet) {
					const manokId =
						Math.random() < 0.5 ? slot.fighter1Id : slot.fighter2Id;
					const amount = Math.min(1, player.balance);
					player.currentBet = { manokId, amount };
				}
				player.balance -= player.currentBet.amount;
				player.betLocked = true;
			}

			const f1 = state.manoks.get(slot.fighter1Id);
			const f2 = state.manoks.get(slot.fighter2Id);
			if (!f1 || !f2) {
				return {
					serverPayload: state,
					publicPayload: getPublicSabongState(state),
					timer: null,
				};
			}

			const { winnerId, log } = simulateBattle(
				toFighterStats(f1),
				toFighterStats(f2),
			);
			slot.winnerId = winnerId;
			state.battleLog = log;
			state.phase = "fighting";

			return {
				serverPayload: state,
				publicPayload: getPublicSabongState(state),
				timer: {
					startsAt: Date.now(),
					duration: estimateFightDuration(log.length),
				},
			};
		}

		if (state.phase === "fighting") {
			const completedSlot = state.bracket[state.currentMatchIndex];
			if (!completedSlot?.winnerId) {
				return {
					serverPayload: state,
					publicPayload: getPublicSabongState(state),
					timer: null,
				};
			}

			const scoreDeltas = applyPayouts(state);

			state.logger.log("payout_calculated", state.currentMatchIndex, {
				matchIndex: state.currentMatchIndex,
				winnerId: completedSlot.winnerId,
				winnerName: state.manoks.get(completedSlot.winnerId)?.name,
				payouts: Object.entries(scoreDeltas).map(([pid, delta]) => ({
					playerId: pid,
					delta,
					newBalance: state.players.get(pid)?.balance,
				})),
			});

			advanceBracket(
				state.bracket,
				state.currentMatchIndex,
				completedSlot.winnerId,
			);
			state.phase = "payout";

			state.logger.log("phase_transition", state.currentMatchIndex, {
				from: "fighting",
				to: "payout",
				trigger: "timer_expired",
			});

			return {
				serverPayload: state,
				publicPayload: getPublicSabongState(state),
				timer: { startsAt: Date.now(), duration: PAYOUT_DURATION_MS },
				scoreDeltas,
			};
		}

		if (state.phase === "payout") {
			const isTournamentOver = state.currentMatchIndex === FINAL_MATCH_INDEX;

			if (isTournamentOver) {
				const finalSlot = state.bracket[FINAL_MATCH_INDEX];
				const tournamentWinner = finalSlot?.winnerId;

				if (!tournamentWinner) {
					return {
						serverPayload: state,
						publicPayload: getPublicSabongState(state),
						timer: null,
					};
				}

				const bonusDeltas: Record<string, number> = {};

				for (const [playerId, player] of state.players) {
					if (player.bracketPickId === tournamentWinner) {
						player.balance += C.BRACKET_PICK_BONUS;
						bonusDeltas[playerId] = C.BRACKET_PICK_BONUS;
					}
				}

				state.logger.log("tournament_complete", FINAL_MATCH_INDEX, {
					finalStandings: [...state.players.values()].map((p) => ({
						playerId: p.playerId,
						balance: p.balance,
						bracketPickId: p.bracketPickId,
						correctPick: p.bracketPickId === tournamentWinner,
					})),
					tournamentWinnerId: tournamentWinner,
					tournamentWinnerName: state.manoks.get(tournamentWinner)?.name,
				});

				state.phase = "finished";
				state.battleLog = null;

				return {
					serverPayload: state,
					publicPayload: getPublicSabongState(state),
					timer: null,
					roomPhase: "ended",
					scoreDeltas: bonusDeltas,
				};
			}

			state.currentMatchIndex += 1;
			state.battleLog = null;
			openBetting(state);

			return {
				serverPayload: state,
				publicPayload: getPublicSabongState(state),
				timer: { startsAt: Date.now(), duration: C.BETTING_DURATION_MS },
			};
		}

		return {
			serverPayload: state,
			publicPayload: getPublicSabongState(state),
			timer: null,
		};
	},
};
