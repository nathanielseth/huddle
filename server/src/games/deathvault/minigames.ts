import type {
	MinigameServerState,
	DeathvaultServerState,
	DeathvaultServerPlayer,
	PrisonersDilemmaServerState,
	FloorIsLavaServerState,
	WordScrambleServerState,
	ToxicTriviaServerState,
	MoneyGrabServerState,
	HigherLowerServerState,
	FinalCutServerState,
	DeathvaultParsedAction,
} from "./types";
import type {
	MinigameId,
	MinigameState,
	PrisonersDilemmaOutcome,
	FloorIsLavaOutcome,
	WordScrambleOutcome,
	ToxicTriviaOutcome,
	MoneyGrabOutcome,
	HigherLowerOutcome,
	FinalCutOutcome,
} from "../../../../shared/games/deathvault/index";
import {
	DILEMMA_STAKE_PER_PLAYER,
	LAVA_GRID_SIZE,
	LAVA_WAVES,
	MINIGAME_STAKE_PER_PLAYER,
	MONEY_GRAB_DURATION_MS,
	MONEY_GRAB_PENALTY_PER_LOSER,
	HIGHER_LOWER_SEQUENCE_LENGTH,
	HIGHER_LOWER_NUMBER_RANGE,
	HIGHER_LOWER_STREAK_MULTIPLIERS,
	CASH_FLOOR,
} from "./constants";
import { shuffle, pickRandom, randomIntBetween } from "../lib/random";
import { invariant } from "../lib/assert";
import { SCRAMBLE_WORDS } from "./words";

export interface MinigameResolution {
	cashDeltas: Record<string, number>;
}

function scrambleWord(word: string): string {
	const chars = word.split("");
	let result = word;
	let attempts = 0;
	while (result === word && attempts < 20) {
		result = shuffle([...chars]).join("");
		attempts++;
	}
	return result;
}

// forces prisoners_dilemma with exactly 2 alive players to avoid stalemates
export function selectMinigame(state: DeathvaultServerState): MinigameId {
	const count = [...state.players.values()].filter(
		(p) => p.status === "alive",
	).length;

	const recentTwo = state.usedMinigameIds.slice(-2);
	const isRecent = (id: MinigameId): boolean => recentTwo.includes(id);

	if (count === 2 && !isRecent("prisoners_dilemma")) {
		return "prisoners_dilemma";
	}

	const always: MinigameId[] = [
		"floor_is_lava",
		"word_scramble",
		"money_grab",
		"final_cut",
	];
	const twoPlus: MinigameId[] = ["toxic_trivia", "higher_lower"];
	const twoOnly: MinigameId[] = ["prisoners_dilemma"];

	const eligible: MinigameId[] = [];
	for (const id of always) {
		if (!isRecent(id)) eligible.push(id);
	}
	if (count >= 2) {
		for (const id of twoPlus) {
			if (!isRecent(id)) eligible.push(id);
		}
		if (count === 2) {
			for (const id of twoOnly) {
				if (!isRecent(id)) eligible.push(id);
			}
		}
	}

	const pool =
		eligible.length > 0
			? eligible
			: count >= 2
				? [...always, ...twoPlus]
				: always;

	return pickRandom(pool);
}

export function buildMinigame(
	id: MinigameId,
	state: DeathvaultServerState,
): MinigameServerState {
	const alive = [...state.players.values()].filter((p) => p.status === "alive");
	const aliveIds = alive.map((p) => p.playerId);

	switch (id) {
		case "prisoners_dilemma": {
			invariant(
				aliveIds.length >= 2,
				"prisoners_dilemma requires at least 2 players",
			);
			const [a, b] = shuffle(aliveIds);
			const playerA = a!;
			const playerB = b!;
			const stake = Math.min(
				DILEMMA_STAKE_PER_PLAYER,
				state.players.get(playerA)!.cash,
				state.players.get(playerB)!.cash,
			);
			const result: PrisonersDilemmaServerState = {
				id: "prisoners_dilemma",
				playerA,
				playerB,
				prizePool: stake * 2,
				choiceA: null,
				choiceB: null,
				settled: false,
				resolvedOutcome: null,
			};
			return result;
		}

		case "floor_is_lava": {
			const tileCount = LAVA_GRID_SIZE[Math.min(aliveIds.length, 8)] ?? 25;
			const burnPerWave = Math.floor(tileCount / (LAVA_WAVES + 1));
			const allTiles = shuffle(Array.from({ length: tileCount }, (_, i) => i));
			const lethalTiles = allTiles.slice(0, burnPerWave * LAVA_WAVES);
			const result: FloorIsLavaServerState = {
				id: "floor_is_lava",
				tileCount,
				eligiblePlayerIds: aliveIds,
				lethalTiles,
				wave: 0,
				burnPerWave,
				burnedTiles: [],
				positions: new Map(),
				survivors: [...aliveIds],
				prizePool: alive.length * MINIGAME_STAKE_PER_PLAYER,
				settled: false,
				resolvedOutcome: null,
			};
			return result;
		}

		case "word_scramble": {
			const difficulty: 1 | 2 | 3 =
				state.round <= 2 ? 1 : state.round <= 5 ? 2 : 3;
			const candidates = SCRAMBLE_WORDS.filter(
				(w) => w.difficulty === difficulty,
			);
			const chosen = pickRandom(
				candidates.length > 0 ? candidates : SCRAMBLE_WORDS,
			);
			const result: WordScrambleServerState = {
				id: "word_scramble",
				answer: chosen.word,
				scrambled: scrambleWord(chosen.word),
				prizePool: alive.length * MINIGAME_STAKE_PER_PLAYER,
				submissions: new Map(),
				settled: false,
				resolvedOutcome: null,
			};
			return result;
		}

		case "toxic_trivia": {
			invariant(
				state.questionQueue.length > 0,
				"toxic_trivia has no questions left in queue",
			);
			const qIdx = randomIntBetween(0, state.questionQueue.length - 1);
			const spliced = state.questionQueue.splice(qIdx, 1);
			const question = spliced[0];
			invariant(question, "toxic_trivia question splice failed");
			const result: ToxicTriviaServerState = {
				id: "toxic_trivia",
				question,
				passOrder: shuffle([...aliveIds]),
				currentHolderIndex: 0,
				prizePool: alive.length * MINIGAME_STAKE_PER_PLAYER,
				settled: false,
				resolvedOutcome: null,
			};
			return result;
		}

		case "money_grab": {
			const tapCounts = new Map<string, number>(aliveIds.map((id) => [id, 0]));
			const result: MoneyGrabServerState = {
				id: "money_grab",
				durationMs: MONEY_GRAB_DURATION_MS,
				prizePool: alive.length * MONEY_GRAB_PENALTY_PER_LOSER,
				tapCounts,
				settled: false,
				resolvedOutcome: null,
			};
			return result;
		}

		case "higher_lower": {
			invariant(
				aliveIds.length >= 1,
				"higher_lower requires at least 1 player",
			);
			const [lo, hi] = HIGHER_LOWER_NUMBER_RANGE;
			const sequence = Array.from(
				{ length: HIGHER_LOWER_SEQUENCE_LENGTH },
				() => randomIntBetween(lo, hi),
			);
			const result: HigherLowerServerState = {
				id: "higher_lower",
				prizePool: alive.length * MINIGAME_STAKE_PER_PLAYER,
				sequence,
				revealedCount: 1,
				streak: 0,
				activePlayerId: pickRandom(aliveIds),
				settled: false,
				resolvedOutcome: null,
			};
			return result;
		}

		case "final_cut": {
			// proposals start as null but map is typed as number for arithmetic
			const proposals = new Map<string, number>(
				aliveIds.map((pid) => [pid, null as unknown as number]),
			);
			const result: FinalCutServerState = {
				id: "final_cut",
				prizePool: alive.length * MINIGAME_STAKE_PER_PLAYER,
				proposals,
				settled: false,
				resolvedOutcome: null,
			};
			return result;
		}
	}
}

export function handleMinigameAction(
	mg: MinigameServerState,
	action: DeathvaultParsedAction,
	playerId: string,
	state: DeathvaultServerState,
): boolean {
	switch (mg.id) {
		case "prisoners_dilemma":
			return handleDilemmaAction(mg, action, playerId);
		case "floor_is_lava":
			return handleLavaAction(mg, action, playerId);
		case "word_scramble":
			return handleScrambleAction(mg, action, playerId);
		case "toxic_trivia":
			return handleToxicAction(mg, action, playerId, state);
		case "money_grab":
			return handleGrabAction(mg, action, playerId);
		case "higher_lower":
			return handleHigherLowerAction(mg, action, playerId);
		case "final_cut":
			return handleFinalCutAction(mg, action, playerId);
	}
}

function handleDilemmaAction(
	mg: PrisonersDilemmaServerState,
	action: DeathvaultParsedAction,
	playerId: string,
): boolean {
	if (action.type !== "dilemma_choose") return false;
	if (mg.settled) return false;
	const isA = playerId === mg.playerA;
	const isB = playerId === mg.playerB;
	if (!isA && !isB) return false;
	if (isA && mg.choiceA !== null) return false;
	if (isB && mg.choiceB !== null) return false;

	if (isA) mg.choiceA = action.choice;
	else mg.choiceB = action.choice;
	return true;
}

function handleLavaAction(
	mg: FloorIsLavaServerState,
	action: DeathvaultParsedAction,
	playerId: string,
): boolean {
	if (action.type !== "lava_pick_tile") return false;
	if (mg.settled) return false;
	if (!mg.survivors.includes(playerId)) return false;
	if (mg.positions.has(playerId)) return false;
	if (action.tileIndex < 0 || action.tileIndex >= mg.tileCount) return false;
	mg.positions.set(playerId, action.tileIndex);
	return true;
}

function handleScrambleAction(
	mg: WordScrambleServerState,
	action: DeathvaultParsedAction,
	playerId: string,
): boolean {
	if (action.type !== "scramble_submit") return false;
	if (mg.settled) return false;
	if (mg.submissions.has(playerId)) return false;
	mg.submissions.set(playerId, action.word.toUpperCase().trim());
	return true;
}

function handleToxicAction(
	mg: ToxicTriviaServerState,
	action: DeathvaultParsedAction,
	playerId: string,
	_state: DeathvaultServerState,
): boolean {
	if (action.type !== "toxic_answer") return false;
	if (mg.settled) return false;
	if (mg.passOrder[mg.currentHolderIndex] !== playerId) return false;
	mg.currentHolderIndex++;
	return true;
}

function handleGrabAction(
	mg: MoneyGrabServerState,
	action: DeathvaultParsedAction,
	playerId: string,
): boolean {
	if (action.type !== "money_tap") return false;
	if (mg.settled) return false;
	mg.tapCounts.set(playerId, (mg.tapCounts.get(playerId) ?? 0) + 1);
	return true;
}

function handleHigherLowerAction(
	mg: HigherLowerServerState,
	action: DeathvaultParsedAction,
	playerId: string,
): boolean {
	if (action.type !== "higher_lower_guess") return false;
	if (mg.settled) return false;
	if (mg.activePlayerId !== playerId) return false;
	if (mg.revealedCount >= mg.sequence.length) return false;

	const current = mg.sequence[mg.revealedCount - 1]!;
	const next = mg.sequence[mg.revealedCount]!;
	const correct = action.guess === "higher" ? next > current : next < current;

	mg.revealedCount++;
	if (correct) mg.streak++;
	else mg.settled = true;
	return true;
}

function handleFinalCutAction(
	mg: FinalCutServerState,
	action: DeathvaultParsedAction,
	playerId: string,
): boolean {
	if (action.type !== "final_cut_propose") return false;
	if (mg.settled) return false;
	if (!mg.proposals.has(playerId)) return false;
	if (mg.proposals.get(playerId) !== null) return false;
	mg.proposals.set(playerId, action.percentage);
	return true;
}

export function isMinigameComplete(mg: MinigameServerState): boolean {
	switch (mg.id) {
		case "prisoners_dilemma":
			return mg.choiceA !== null && mg.choiceB !== null;
		case "floor_is_lava":
			return mg.survivors.every((id) => mg.positions.has(id));
		case "word_scramble":
			return mg.settled;
		case "toxic_trivia":
			return mg.currentHolderIndex >= mg.passOrder.length || mg.settled;
		case "money_grab":
			return mg.settled;
		case "higher_lower":
			return mg.settled || mg.revealedCount >= mg.sequence.length;
		case "final_cut":
			return [...mg.proposals.values()].every((v) => v !== null);
	}
}

export function resolveMinigame(
	mg: MinigameServerState,
	players: Map<string, DeathvaultServerPlayer>,
): MinigameResolution {
	switch (mg.id) {
		case "prisoners_dilemma":
			return resolveDilemma(mg);
		case "floor_is_lava":
			return resolveLava(mg);
		case "word_scramble":
			return resolveScramble(mg);
		case "toxic_trivia":
			return resolveToxic(mg);
		case "money_grab":
			return resolveGrab(mg);
		case "higher_lower":
			return resolveHigherLower(mg);
		case "final_cut":
			return resolveFinalCut(mg, players);
	}
}

// absent players default to steal as deterrent
function resolveDilemma(mg: PrisonersDilemmaServerState): MinigameResolution {
	const choiceA = mg.choiceA ?? "steal";
	const choiceB = mg.choiceB ?? "steal";
	const { playerA, playerB, prizePool } = mg;

	let deltaA = 0;
	let deltaB = 0;

	if (choiceA === "share" && choiceB === "share") {
		const half = Math.floor(prizePool / 2);
		deltaA = half;
		deltaB = half;
	} else if (choiceA === "steal" && choiceB === "share") {
		deltaA = prizePool;
	} else if (choiceA === "share" && choiceB === "steal") {
		deltaB = prizePool;
	}

	const cashDeltas: Record<string, number> = {
		[playerA]: deltaA,
		[playerB]: deltaB,
	};
	const outcome: PrisonersDilemmaOutcome = {
		playerAChoice: choiceA,
		playerBChoice: choiceB,
		cashDeltas,
	};
	mg.resolvedOutcome = outcome;
	mg.settled = true;
	return { cashDeltas };
}

// advances lava wave, eliminates players on lethal tiles or afk. mutates mg. returns eliminated ids.
export function advanceLavaWave(mg: FloorIsLavaServerState): {
	eliminated: string[];
} {
	const waveBurn = mg.lethalTiles.slice(
		mg.wave * mg.burnPerWave,
		(mg.wave + 1) * mg.burnPerWave,
	);
	mg.burnedTiles.push(...waveBurn);
	const burnedSet = new Set(mg.burnedTiles);

	const eliminated: string[] = [];
	for (const id of mg.survivors) {
		const tile = mg.positions.get(id);
		if (tile === undefined || burnedSet.has(tile)) eliminated.push(id);
	}

	mg.survivors = mg.survivors.filter((id) => !eliminated.includes(id));
	mg.wave++;
	mg.positions.clear();

	return { eliminated };
}

function resolveLava(mg: FloorIsLavaServerState): MinigameResolution {
	const { survivors, prizePool } = mg;
	const cashDeltas: Record<string, number> = {};

	if (survivors.length > 0) {
		const share = Math.floor(prizePool / survivors.length);
		for (const id of survivors) cashDeltas[id] = share;
	}

	const outcome: FloorIsLavaOutcome = { winnerIds: survivors, cashDeltas };
	mg.resolvedOutcome = outcome;
	mg.settled = true;
	return { cashDeltas };
}

function resolveScramble(mg: WordScrambleServerState): MinigameResolution {
	const winners: string[] = [];
	for (const [playerId, word] of mg.submissions) {
		if (word === mg.answer) winners.push(playerId);
	}

	const cashDeltas: Record<string, number> = {};
	if (winners.length > 0) {
		const share = Math.floor(mg.prizePool / winners.length);
		for (const id of winners) cashDeltas[id] = share;
	}

	const outcome: WordScrambleOutcome = {
		answer: mg.answer,
		winnerIds: winners,
		cashDeltas,
	};
	mg.resolvedOutcome = outcome;
	mg.settled = true;
	return { cashDeltas };
}

function resolveToxic(mg: ToxicTriviaServerState): MinigameResolution {
	// the last holder when time runs out or the chain completes takes the penalty
	const lastIdx = Math.min(mg.currentHolderIndex, mg.passOrder.length - 1);
	const loserId = mg.passOrder[lastIdx]!;
	const cashDeltas: Record<string, number> = { [loserId]: -mg.prizePool };

	const outcome: ToxicTriviaOutcome = {
		correctChoiceId: mg.question.correctChoiceId,
		loserIds: [loserId],
		cashDeltas,
	};
	mg.resolvedOutcome = outcome;
	mg.settled = true;
	return { cashDeltas };
}

function resolveGrab(mg: MoneyGrabServerState): MinigameResolution {
	const totalTaps = [...mg.tapCounts.values()].reduce((a, b) => a + b, 0);
	const cashDeltas: Record<string, number> = {};

	if (totalTaps > 0) {
		for (const [id, taps] of mg.tapCounts) {
			const share = Math.floor((taps / totalTaps) * mg.prizePool);
			if (share > 0) cashDeltas[id] = share;
		}
	}

	const outcome: MoneyGrabOutcome = { cashDeltas };
	mg.resolvedOutcome = outcome;
	mg.settled = true;
	return { cashDeltas };
}

function resolveHigherLower(mg: HigherLowerServerState): MinigameResolution {
	const streakIdx = Math.min(
		mg.streak,
		HIGHER_LOWER_STREAK_MULTIPLIERS.length - 1,
	);
	const multiplier = HIGHER_LOWER_STREAK_MULTIPLIERS[streakIdx] ?? 1;
	const payout = Math.floor(mg.prizePool * multiplier);
	const cashDeltas: Record<string, number> = { [mg.activePlayerId]: payout };

	const outcome: HigherLowerOutcome = { finalStreak: mg.streak, cashDeltas };
	mg.resolvedOutcome = outcome;
	mg.settled = true;
	return { cashDeltas };
}

function resolveFinalCut(
	mg: FinalCutServerState,
	_players: Map<string, DeathvaultServerPlayer>,
): MinigameResolution {
	const trueHalf = 50;
	const cashDeltas: Record<string, number> = {};
	let closestId: string | null = null;
	let closestDist = Infinity;

	for (const [id, pct] of mg.proposals) {
		if (pct === null) continue;
		cashDeltas[id] = Math.floor((pct / 100) * mg.prizePool);
		const dist = Math.abs(pct - trueHalf);
		if (dist < closestDist) {
			closestDist = dist;
			closestId = id;
		}
	}

	// leftover prize goes to the player closest to 50% split as tiebreaker
	const awarded = Object.values(cashDeltas).reduce((a, b) => a + b, 0);
	const remainder = mg.prizePool - awarded;
	if (remainder > 0 && closestId !== null) {
		cashDeltas[closestId] = (cashDeltas[closestId] ?? 0) + remainder;
	}

	const outcome: FinalCutOutcome = { trueHalf, cashDeltas };
	mg.resolvedOutcome = outcome;
	mg.settled = true;
	return { cashDeltas };
}

// strips internal secrets before broadcasting to clients
export function projectMinigamePublic(mg: MinigameServerState): MinigameState {
	switch (mg.id) {
		case "prisoners_dilemma":
			return {
				id: "prisoners_dilemma",
				playerA: mg.playerA,
				playerB: mg.playerB,
				prizePool: mg.prizePool,
				playerALocked: mg.choiceA !== null,
				playerBLocked: mg.choiceB !== null,
				outcome: mg.resolvedOutcome,
			};

		case "floor_is_lava":
			return {
				id: "floor_is_lava",
				tileCount: mg.tileCount,
				wave: mg.wave,
				burnedTiles: mg.burnedTiles,
				positions: Object.fromEntries(mg.positions),
				survivors: mg.survivors,
				prizePool: mg.prizePool,
				outcome: mg.resolvedOutcome,
			};

		case "word_scramble":
			return {
				id: "word_scramble",
				scrambled: mg.scrambled,
				prizePool: mg.prizePool,
				submissions: Object.fromEntries(mg.submissions),
				outcome: mg.resolvedOutcome,
			};

		case "toxic_trivia": {
			const lastIdx = Math.min(mg.currentHolderIndex, mg.passOrder.length - 1);
			return {
				id: "toxic_trivia",
				prompt: mg.question.prompt,
				choices: mg.question.choices,
				passOrder: mg.passOrder,
				currentHolderId: mg.passOrder[lastIdx]!,
				correctChoiceId: mg.settled ? mg.question.correctChoiceId : null,
				prizePool: mg.prizePool,
				outcome: mg.resolvedOutcome,
			};
		}

		case "money_grab":
			return {
				id: "money_grab",
				durationMs: mg.durationMs,
				prizePool: mg.prizePool,
				tapCounts: Object.fromEntries(mg.tapCounts),
				outcome: mg.resolvedOutcome,
			};

		case "higher_lower":
			return {
				id: "higher_lower",
				prizePool: mg.prizePool,
				revealed: [...mg.sequence].slice(0, mg.revealedCount),
				streak: mg.streak,
				activePlayerId: mg.activePlayerId,
				outcome: mg.resolvedOutcome,
			};

		case "final_cut":
			return {
				id: "final_cut",
				prizePool: mg.prizePool,
				// proposals: null if not yet submitted, number otherwise
				proposals: Object.fromEntries(
					[...mg.proposals.entries()].map(
						([id, v]) => [id, v ?? null] as const,
					),
				),
				outcome: mg.resolvedOutcome,
			};
	}
}

// exported for potential external use
export function clampToCashFloor(amount: number): number {
	return Math.max(CASH_FLOOR, amount);
}