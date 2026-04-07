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
import { getMatchupOdds, simulateBattle, type FighterStats } from "./battle.js";

const C = SABONG_CONSTANTS;

// names pool

const MANOK_NAMES: string[] = [
	"Alfredo",
	"Antonio",
	"Bruno",
	"Buto",
	"Covid Bryant",
	"Dick",
	"Eduardo",
	"Elena",
	"Jacob",
	"Jeppy",
	"Jhenyfher",
	"Jhemerlyn",
	"Jhavascript",
	"Jollybird",
	"Jomar",
	"Joseph",
	"Juan",
	"Maria",
	"Mike Jordan",
	"Pedro",
	"Priest",
	"Princess",
	"Raphael",
	"Rosebowl",
];

const HIDEABLE_STATS = [
	"health",
	"attack",
	"defense",
	"speed",
	"critRate",
] as const;
type HideableStat = (typeof HIDEABLE_STATS)[number];

const EVENT_DURATION_MS = 1200; // approximate ms per battle log event
const FIGHT_BUFFER_MS = 3000; // extra breathing room after last event
const PAYOUT_DURATION_MS = 6000;

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
		attack: m.attack,
		defense: m.defense,
		speed: m.speed,
		critRate: m.critRate,
		determination: m.determination,
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
	// 1 or 2 hidden stats - determination is always hidden (server-only)
	const count = Math.random() < 0.5 ? 1 : 2;
	return new Set(shuffled.slice(0, count) as HideableStat[]);
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
	};
}

// tries up to 30 times to produce a balanced pair.
// falls back to unbalanced - clear favorites make for interesting betting.
function generateBalancedPair(
	id1: string,
	name1: string,
	id2: string,
	name2: string,
): [ManokStats, ManokStats] {
	for (let attempt = 0; attempt < 30; attempt++) {
		const m1 = generateManok(id1, name1);
		const m2 = generateManok(id2, name2);
		const { probability } = getMatchupOdds(
			toFighterStats(m1),
			toFighterStats(m2),
			200,
		);
		const isBalanced =
			probability.fighter1 >= 0.5 - C.BALANCE_TOLERANCE &&
			probability.fighter1 <= 0.5 + C.BALANCE_TOLERANCE;
		if (isBalanced) return [m1, m2];
	}
	return [generateManok(id1, name1), generateManok(id2, name2)];
}

// bracket - slots 0–3: qf | slots 4–5: sf | slot 6: final
// advancement map:
//   qf0 winner → sf4.fighter1   qf1 winner → sf4.fighter2
//   qf2 winner → sf5.fighter1   qf3 winner → sf5.fighter2
//   sf4 winner → final6.fighter1  sf5 winner → final6.fighter2

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

	// qf: pair manoks sequentially - 0v1, 2v3, 4v5, 6v7
	for (let i = 0; i < 4; i++) {
		bracket.push({
			matchIndex: i,
			fighter1Id: manoks[i * 2]!.id,
			fighter2Id: manoks[i * 2 + 1]!.id,
			winnerId: null,
			odds: null,
		});
	}

	// sf + final - fighters filled in as winners advance
	for (let i = 4; i < 7; i++) {
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
	if (!next) return; // final (6) - no advancement
	bracket[next.slot]![next.position] = winnerId;
}

function computeSlotOdds(
	slot: ServerBracketSlot,
	manoks: Map<string, ManokStats>,
): { fighter1: number; fighter2: number } {
	const f1 = manoks.get(slot.fighter1Id!)!;
	const f2 = manoks.get(slot.fighter2Id!)!;
	return getMatchupOdds(toFighterStats(f1), toFighterStats(f2)).moneyline;
}

// player state helpers

function allPicksLocked(state: SabongServerState): boolean {
	return [...state.players.values()].every((p) => p.bracketPickLocked);
}

function allBetsLocked(state: SabongServerState): boolean {
	return [...state.players.values()].every((p) => p.betLocked);
}

// transition to betting: give ayuda to broke players, reset bets, compute odds.
function openBetting(state: SabongServerState): void {
	const slot = state.bracket[state.currentMatchIndex]!;

	// compute odds if not already done (sf/final slots are filled late)
	if (!slot.odds && slot.fighter1Id && slot.fighter2Id) {
		slot.odds = computeSlotOdds(slot, state.manoks);
	}

	for (const player of state.players.values()) {
		if (player.balance <= 0) {
			player.balance = C.AYUDA_AMOUNT;
			player.receivedAyudaThisRound = true;
		} else {
			player.receivedAyudaThisRound = false;
		}
		player.currentBet = null;
		player.betLocked = false;
	}

	state.phase = "betting";
}

// resolves bets once the winner is known. returns score deltas for the runner.
function applyPayouts(state: SabongServerState): Record<string, number> {
	const slot = state.bracket[state.currentMatchIndex]!;
	const winnerId = slot.winnerId!;
	const odds = slot.odds!;
	const scoreDeltas: Record<string, number> = {};

	for (const [playerId, player] of state.players) {
		if (!player.currentBet) continue;

		const { manokId, amount } = player.currentBet;
		const betOnFighter1 = manokId === slot.fighter1Id;
		const betOnWinner = manokId === winnerId;

		if (betOnWinner) {
			const ml = betOnFighter1 ? odds.fighter1 : odds.fighter2;
			const payout = Math.round(amount * moneylineToDecimal(ml));
			player.balance += payout; // bet was already deducted on lock
			scoreDeltas[playerId] = payout - amount; // net profit for room score
		} else {
			scoreDeltas[playerId] = -amount; // already deducted - just record loss
		}
	}

	return scoreDeltas;
}

// public state builder - strips hidden stats and server-only fields before broadcast.

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
		currentHp: null, // client derives hp from battlelog events
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

function parseSabongAction(raw: unknown): SabongAction | null {
	if (!raw || typeof raw !== "object") return null;
	const a = raw as Record<string, unknown>;
	if (typeof a["type"] !== "string") return null;

	switch (a["type"]) {
		case "pick_bracket_winner":
			if (typeof a["manokId"] === "string")
				return { type: "pick_bracket_winner", manokId: a["manokId"] };
			break;
		case "lock_bracket_pick":
			return { type: "lock_bracket_pick" };
		case "place_bet":
			if (typeof a["manokId"] === "string" && typeof a["amount"] === "number")
				return {
					type: "place_bet",
					manokId: a["manokId"],
					amount: a["amount"],
				};
			break;
		case "lock_bet":
			return { type: "lock_bet" };
	}
	return null;
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
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const state = ctx.room.gamePayload as SabongServerState;
		const names = pickUniqueNames(C.MANOK_COUNT);
		const manoks: ManokStats[] = [];

		// generate 4 balanced qf pairs
		for (let i = 0; i < 4; i++) {
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

		// pre-compute odds for all 4 qf matchups so the full bracket is
		// informative during pre_tournament before any betting starts.
		for (let i = 0; i < 4; i++) {
			const slot = state.bracket[i]!;
			slot.odds = computeSlotOdds(slot, state.manoks);
		}

		// initialize one player entry per room player
		state.players = new Map(
			Array.from(ctx.room.players.values()).map((p) => [
				p.playerId,
				{
					playerId: p.playerId,
					balance: C.STARTING_BALANCE,
					bracketPickId: null,
					bracketPickLocked: false,
					currentBet: null,
					betLocked: false,
					receivedAyudaThisRound: false,
				} satisfies SabongServerPlayer,
			]),
		);

		state.phase = "pre_tournament";

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
			case "pick_bracket_winner": {
				if (state.phase !== "pre_tournament") return noOp();
				if (player.bracketPickLocked) return noOp();
				if (!state.manoks.has(action.manokId)) return noOp();
				player.bracketPickId = action.manokId;
				break;
			}

			case "lock_bracket_pick": {
				if (state.phase !== "pre_tournament") return noOp();
				if (!player.bracketPickId) return noOp();
				player.bracketPickLocked = true;

				if (allPicksLocked(state)) {
					openBetting(state);
					// all players locked manually - cancel pre_tournament timer, start betting
					return {
						serverPayload: state,
						publicPayload: getPublicSabongState(state),
						timer: { startsAt: Date.now(), duration: C.BETTING_DURATION_MS },
					};
				}
				break; // still waiting - keep existing pre_tournament timer
			}

			case "place_bet": {
				if (state.phase !== "betting") return noOp();
				if (player.betLocked) return noOp();

				const slot = state.bracket[state.currentMatchIndex]!;
				const isValidTarget =
					action.manokId === slot.fighter1Id ||
					action.manokId === slot.fighter2Id;
				if (!isValidTarget) return noOp();

				// clamp to [1, balance] - enforces minimum and prevents over-betting
				const amount = Math.min(
					Math.max(Math.round(action.amount), 1),
					player.balance,
				);
				player.currentBet = { manokId: action.manokId, amount };
				break;
			}

			case "lock_bet": {
				if (state.phase !== "betting") return noOp();
				if (!player.currentBet || player.betLocked) return noOp();

				// deduct now - payout adds back winnings, losers have nothing more to do
				player.balance -= player.currentBet.amount;
				player.betLocked = true;

				if (!allBetsLocked(state)) break; // waiting on others

				// everyone locked - run the fight
				const slot = state.bracket[state.currentMatchIndex]!;
				if (!slot.fighter1Id || !slot.fighter2Id) return noOp();

				const f1 = state.manoks.get(slot.fighter1Id)!;
				const f2 = state.manoks.get(slot.fighter2Id)!;
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
					// assign a random pick for players who never selected one
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

		// betting timer ran out - force-lock anyone still pending, then fight
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
					// no bet placed at all - minimum bet on a random side
					const manokId =
						Math.random() < 0.5 ? slot.fighter1Id : slot.fighter2Id;
					const amount = Math.min(1, player.balance);
					player.currentBet = { manokId, amount };
				}
				player.balance -= player.currentBet.amount;
				player.betLocked = true;
			}

			const f1 = state.manoks.get(slot.fighter1Id)!;
			const f2 = state.manoks.get(slot.fighter2Id)!;
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

		// fight animation finished → payout
		if (state.phase === "fighting") {
			const scoreDeltas = applyPayouts(state);
			advanceBracket(
				state.bracket,
				state.currentMatchIndex,
				state.bracket[state.currentMatchIndex]!.winnerId!,
			);
			state.phase = "payout";

			return {
				serverPayload: state,
				publicPayload: getPublicSabongState(state),
				timer: { startsAt: Date.now(), duration: PAYOUT_DURATION_MS },
				scoreDeltas,
			};
		}

		// payout screen finished → next match or end
		if (state.phase === "payout") {
			const isTournamentOver = state.currentMatchIndex === 6;

			if (isTournamentOver) {
				// award bracket pick bonuses
				const finalSlot = state.bracket[6]!;
				const tournamentWinner = finalSlot.winnerId;
				const bonusDeltas: Record<string, number> = {};

				for (const [playerId, player] of state.players) {
					if (player.bracketPickId === tournamentWinner) {
						player.balance += C.BRACKET_PICK_BONUS;
						bonusDeltas[playerId] = C.BRACKET_PICK_BONUS;
					}
				}

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

			// advance to next match
			state.currentMatchIndex += 1;
			state.battleLog = null;
			openBetting(state); // gives ayuda, resets bets, computes odds for next slot

			return {
				serverPayload: state,
				publicPayload: getPublicSabongState(state),
				timer: { startsAt: Date.now(), duration: C.BETTING_DURATION_MS },
			};
		}

		// unexpected timer fire
		return {
			serverPayload: state,
			publicPayload: getPublicSabongState(state),
			timer: null,
		};
	},
};
