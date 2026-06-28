import type {
	GameEngine,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type { Room } from "../../room/registry";
import type { BlankSlateServerState, BlankSlateResolvedClue } from "./types";
import type {
	BlankSlateState,
	BlankSlatePlayerView,
	BlankSlateClueResult,
	BlankSlateRoundResult,
} from "../../../../shared/games/blank-slate";
import {
	CLUE_WRITING_MS,
	GUESSING_MS,
	RESULT_MS,
	MIN_PLAYERS,
} from "./constants";
import { BlankSlateActionSchema, parseBlankSlateAction } from "./schemas";
import { scoreRound } from "./scoring";
import { WORD_BANK } from "./words";
import { shuffle } from "../lib/random";
import { invariant } from "../lib/assert";

function normalize(text: string): string {
	const base = text.toLowerCase().replace(/[^a-z]/g, "");
	return base.length > 2 && base.endsWith("s") ? base.slice(0, -1) : base;
}

function log(
	state: BlankSlateServerState,
	event: string,
	meta?: Record<string, unknown>,
): void {
	console.log(
		JSON.stringify({
			game: "blank-slate",
			event,
			round: state.roundNumber,
			phase: state.phase,
			playerCount: state.guesserRotation.length,
			...meta,
		}),
	);
}

// if multiple players submit the same normalised clue, all instances are eliminated
function resolveClues(clues: Map<string, string>): BlankSlateResolvedClue[] {
	const normCounts = new Map<string, number>();
	for (const text of clues.values()) {
		const norm = normalize(text);
		normCounts.set(norm, (normCounts.get(norm) ?? 0) + 1);
	}

	const resolved: BlankSlateResolvedClue[] = [];
	for (const [playerId, text] of clues) {
		const normalized = normalize(text);
		resolved.push({
			playerId,
			raw: text,
			normalized,
			eliminated: (normCounts.get(normalized) ?? 0) > 1,
		});
	}
	return resolved;
}

function buildPublicState(
	state: BlankSlateServerState,
	room: Room,
): BlankSlateState {
	const guesserPlayerId = state.guesserRotation[state.guesserIndex]!;
	const showClues =
		state.phase === "guessing" ||
		state.phase === "result" ||
		state.phase === "finished";
	const showResult = state.phase === "result" || state.phase === "finished";

	const survivingClues =
		showClues && state.resolvedClues !== null
			? state.resolvedClues
					.filter((c) => !c.eliminated)
					.map(({ playerId, raw }) => ({ playerId, text: raw }))
			: null;

	const players: Record<string, BlankSlatePlayerView> = {};
	for (const playerId of state.guesserRotation) {
		const isGuesser = playerId === guesserPlayerId;
		let clueResult: BlankSlateClueResult = null;

		if (showResult) {
			if (isGuesser) {
				clueResult = { kind: "guesser" };
			} else {
				const entry = state.resolvedClues?.find((c) => c.playerId === playerId);
				clueResult = entry
					? entry.eliminated
						? { kind: "eliminated", text: entry.raw }
						: { kind: "surviving", text: entry.raw }
					: null;
			}
		}

		players[playerId] = {
			playerId,
			score: room.players.get(playerId)?.score ?? 0,
			hasSubmittedClue: isGuesser || state.clues.has(playerId),
			isGuesser,
			clueResult,
		};
	}

	return {
		phase: state.phase,
		roundNumber: state.roundNumber,
		totalRounds: state.totalRounds,
		guesserPlayerId,
		secretWord: state.phase === "clue_writing" ? null : state.currentWord,
		survivingClues,
		players,
		lastResult: state.results[state.results.length - 1] ?? null,
		cluesSubmittedCount: state.clues.size,
		cluesExpectedCount: state.guesserRotation.length - 1,
	};
}

function enterClueWriting(state: BlankSlateServerState): void {
	const word = state.wordDeck.pop();
	invariant(word, "Word deck exhausted unexpectedly");

	state.currentWord = word;
	state.clues = new Map();
	state.resolvedClues = null;
	state.guess = null;
	state.guesserActed = false;
	state.phase = "clue_writing";

	log(state, "clue_writing", {
		guesserPlayerId: state.guesserRotation[state.guesserIndex],
		deckRemaining: state.wordDeck.length,
	});
}

// runs duplicate detection before showing clues to the guesser
function enterGuessing(state: BlankSlateServerState): void {
	state.resolvedClues = resolveClues(state.clues);
	state.phase = "guessing";

	const surviving = state.resolvedClues.filter((c) => !c.eliminated).length;
	log(state, "guessing", {
		submitted: state.clues.size,
		surviving,
		eliminated: state.resolvedClues.length - surviving,
	});
}

function enterResult(
	state: BlankSlateServerState,
	guess: string | null,
): Record<string, number> {
	invariant(state.resolvedClues, "enterResult called before resolveClues");

	const guesserPlayerId = state.guesserRotation[state.guesserIndex]!;
	const correct =
		guess !== null && normalize(guess) === normalize(state.currentWord);
	const scoreDeltas = scoreRound(guesserPlayerId, correct, state.resolvedClues);

	state.results.push({
		secretWord: state.currentWord,
		clueEntries: state.resolvedClues.map(({ playerId, raw, eliminated }) => ({
			playerId,
			text: raw,
			eliminated,
		})),
		guess,
		correct,
		guesserPlayerId,
		scoreDeltas,
	} satisfies BlankSlateRoundResult);

	state.phase = "result";

	log(state, "result", {
		correct,
		guess,
		word: state.currentWord,
		scoreDeltas,
	});

	return scoreDeltas;
}

// checks if all rounds are done; if so ends the game, else increments round
// and cycles the guesser role to the next player in the rotation
function resolveAfterResult(
	state: BlankSlateServerState,
	room: Room,
): EngineResult {
	if (state.roundNumber >= state.totalRounds) {
		state.phase = "finished";
		log(state, "game_finished");
		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: null,
			roomPhase: "ended",
		};
	}

	state.roundNumber += 1;
	state.guesserIndex = (state.guesserIndex + 1) % state.guesserRotation.length;
	enterClueWriting(state);

	return {
		serverPayload: state,
		publicPayload: buildPublicState(state, room),
		timer: { startsAt: Date.now(), duration: CLUE_WRITING_MS },
	};
}

function result(
	state: BlankSlateServerState,
	room: Room,
	timer: EngineResult["timer"],
	scoreDeltas?: Record<string, number>,
): EngineResult {
	return {
		serverPayload: state,
		publicPayload: buildPublicState(state, room),
		timer,
		...(scoreDeltas && Object.keys(scoreDeltas).length > 0
			? { scoreDeltas }
			: {}),
	};
}

export const blankSlateEngine: GameEngine = {
	gameId: "blank-slate",

	actionSchema: BlankSlateActionSchema,

	getInitialState(): BlankSlateServerState {
		return {
			phase: "clue_writing",
			roundNumber: 1,
			totalRounds: 0,
			guesserRotation: [],
			guesserIndex: 0,
			currentWord: "",
			wordDeck: [],
			clues: new Map(),
			resolvedClues: null,
			guess: null,
			guesserActed: false,
			results: [],
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as BlankSlateServerState;

		invariant(
			room.players.size >= MIN_PLAYERS,
			`BlankSlate requires at least ${MIN_PLAYERS} players, got ${room.players.size}`,
		);

		state.guesserRotation = [...room.players.keys()];
		state.totalRounds = state.guesserRotation.length;
		state.guesserIndex = 0;
		state.roundNumber = 1;

		// pre‑slice the deck to exactly totalRounds so it empties on the last round
		state.wordDeck = shuffle([...WORD_BANK]).slice(0, state.totalRounds);

		enterClueWriting(state);

		log(state, "game_start", {
			playerCount: room.players.size,
			totalRounds: state.totalRounds,
			guesserRotation: state.guesserRotation,
		});

		return result(state, room, {
			startsAt: Date.now(),
			duration: CLUE_WRITING_MS,
		});
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as BlankSlateServerState;
		const noOp = () => result(state, room, room.timer);

		const action = parseBlankSlateAction(raw);
		if (!action) return noOp();
		if (!state.guesserRotation.includes(playerId)) return noOp();

		const guesserPlayerId = state.guesserRotation[state.guesserIndex]!;
		const isGuesser = playerId === guesserPlayerId;

		if (action.type === "submit_clue") {
			if (state.phase !== "clue_writing") return noOp();
			if (isGuesser) return noOp();
			if (state.clues.has(playerId)) return noOp();

			state.clues.set(playerId, action.text);

			log(state, "clue_submitted", {
				playerId,
				clueCount: state.clues.size,
				expected: state.guesserRotation.length - 1,
			});

			// advance immediately when all non-guessers have submitted
			if (state.clues.size >= state.guesserRotation.length - 1) {
				enterGuessing(state);
				return result(state, room, {
					startsAt: Date.now(),
					duration: GUESSING_MS,
				});
			}

			return noOp();
		}

		if (action.type === "submit_guess") {
			if (state.phase !== "guessing") return noOp();
			if (!isGuesser || state.guesserActed) return noOp();

			state.guess = action.text;
			state.guesserActed = true;

			const scoreDeltas = enterResult(state, action.text);
			return result(
				state,
				room,
				{ startsAt: Date.now(), duration: RESULT_MS },
				scoreDeltas,
			);
		}

		if (action.type === "skip_guess") {
			if (state.phase !== "guessing") return noOp();
			if (!isGuesser || state.guesserActed) return noOp();

			state.guess = null;
			state.guesserActed = true;

			const scoreDeltas = enterResult(state, null);
			return result(
				state,
				room,
				{ startsAt: Date.now(), duration: RESULT_MS },
				scoreDeltas,
			);
		}

		return noOp();
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as BlankSlateServerState;

		// clue_writing -> force transition to guessing even if some players didn't submit
		if (state.phase === "clue_writing") {
			enterGuessing(state);
			return result(state, room, {
				startsAt: Date.now(),
				duration: GUESSING_MS,
			});
		}

		// guessing -> auto-skip for afk guesser
		if (state.phase === "guessing") {
			if (!state.guesserActed) {
				state.guess = null;
				state.guesserActed = true;
				log(state, "guess_timed_out", {
					guesserPlayerId: state.guesserRotation[state.guesserIndex],
				});
			}
			const scoreDeltas = enterResult(state, state.guess);
			return result(
				state,
				room,
				{ startsAt: Date.now(), duration: RESULT_MS },
				scoreDeltas,
			);
		}

		// result -> advance to next round or finish
		if (state.phase === "result") {
			return resolveAfterResult(state, room);
		}

		// defensive no-op for unexpected timer fire (should not happen)
		return result(state, room, null);
	},
};