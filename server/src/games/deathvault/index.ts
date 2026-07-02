import type {
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type { DeathvaultServerState, DeathvaultServerPlayer } from "./types";
import type { DeathvaultPlayerSecret } from "../../../../shared/games/deathvault";
import { parseDeathvaultAction } from "./schemas";
import { buildPublicState, buildPlayerSecret } from "./projection";
import {
	selectMinigame,
	buildMinigame,
	handleMinigameAction,
	isMinigameComplete,
	resolveMinigame,
	advanceLavaWave,
} from "./minigames";
import { QUESTION_BANK } from "./questions";
import { shuffle } from "../lib/random";
import { invariant } from "../lib/assert";
import {
	STARTING_CASH,
	CASH_FLOOR,
	MIN_WAGER,
	TOTAL_ROUNDS,
	NORMAL_ROUNDS,
	WAGER_MS,
	QUESTION_MS,
	QUESTION_RESULT_MS,
	MINIGAME_INTRO_MS,
	ROUND_END_MS,
	LAVA_PICK_MS,
	SCRAMBLE_MS,
	MONEY_GRAB_MS,
	HIGHER_LOWER_GUESS_MS,
	FINAL_CUT_MS,
	DILEMMA_MS,
	MINIGAME_RESULT_MS,
} from "./constants";

const MIN_PLAYERS = 1;
const MAX_PLAYERS = 8;

function log(
	state: DeathvaultServerState,
	event: string,
	meta?: Record<string, unknown>,
): void {
	console.log(
		JSON.stringify({
			game: "deathvault",
			event,
			phase: state.phase,
			round: state.round,
			playerCount: state.players.size,
			...meta,
		}),
	);
}

function alivePlayers(state: DeathvaultServerState): DeathvaultServerPlayer[] {
	return [...state.players.values()].filter((p) => p.status === "alive");
}

function allAliveWagered(state: DeathvaultServerState): boolean {
	return alivePlayers(state).every((p) => p.wager !== null);
}

function allAliveAnswered(state: DeathvaultServerState): boolean {
	return alivePlayers(state).every((p) => p.answer !== null);
}

function resetRoundFields(state: DeathvaultServerState): void {
	for (const p of state.players.values()) {
		p.wager = null;
		p.answer = null;
		p.lastDelta = null;
	}
}

function enterWager(state: DeathvaultServerState): void {
	const isFinal = state.round === state.totalRounds;
	state.phase = isFinal ? "final_wager" : "question_wager";
	resetRoundFields(state);

	const next = state.questionQueue.shift();
	invariant(next, "Question queue exhausted");
	state.currentQuestion = next;
	state.questionResult = null;

	log(state, "enter_wager", {
		questionId: next.id,
		category: next.category,
		difficulty: next.difficulty,
	});
}

function enterAnswer(state: DeathvaultServerState): void {
	const isFinal = state.round === state.totalRounds;
	state.phase = isFinal ? "final_answer" : "question_answer";
	log(state, "enter_answer");
}

// captures whether this is the final round *before* mutating state.phase,
// since state.phase changes to either "question_result" or "final_result" inside
// cash deltas are returned for the caller to report as scoreDeltas
function enterQuestionResult(state: DeathvaultServerState): {
	cashDeltas: Record<string, number>;
	isFinal: boolean;
} {
	const isFinal = state.round === state.totalRounds;
	state.phase = isFinal ? "final_result" : "question_result";

	const question = state.currentQuestion;
	invariant(question, "enterQuestionResult: no current question");

	const answers: Record<string, string> = {};
	const cashDeltas: Record<string, number> = {};
	const correctPlayerIds: string[] = [];
	const wrongPlayerIds: string[] = [];

	for (const p of state.players.values()) {
		if (p.status === "ghost") continue;

		const answer = p.answer;
		if (!answer) {
			wrongPlayerIds.push(p.playerId);
			answers[p.playerId] = "";
			continue;
		}

		answers[p.playerId] = answer;
		const wager = p.wager ?? 0;

		if (answer === question.correctChoiceId) {
			correctPlayerIds.push(p.playerId);
			cashDeltas[p.playerId] = wager;
			p.cash = Math.max(CASH_FLOOR, p.cash + wager);
			p.lastDelta = wager;
		} else {
			wrongPlayerIds.push(p.playerId);
			cashDeltas[p.playerId] = -wager;
			p.cash = Math.max(CASH_FLOOR, p.cash - wager);
			p.lastDelta = -wager;
		}

		if (p.cash <= 0) {
			p.cash = 0;
			p.status = "ghost";
			log(state, "player_ghosted", { playerId: p.playerId });
		}
	}

	state.questionResult = {
		questionId: question.id,
		prompt: question.prompt,
		correctChoiceId: question.correctChoiceId,
		answers,
		cashDeltas,
		correctPlayerIds,
		wrongPlayerIds,
	};
	state.roundResults.push(state.questionResult);

	const snapshot: Record<string, number> = {};
	for (const [id, p] of state.players) snapshot[id] = p.cash;
	state.cashHistory.push(snapshot);

	log(state, "question_result", {
		correct: correctPlayerIds.length,
		wrong: wrongPlayerIds.length,
		cashDeltas,
	});

	return { cashDeltas, isFinal };
}

function enterMinigameIntro(state: DeathvaultServerState): void {
	const id = selectMinigame(state);
	state.minigame = buildMinigame(id, state);
	state.usedMinigameIds.push(id);
	state.phase = "minigame_intro";
	log(state, "minigame_intro", { minigameId: id });
}

function enterMinigameActive(state: DeathvaultServerState): void {
	state.phase = "minigame_active";
	log(state, "minigame_active", { minigameId: state.minigame?.id });
}

function enterMinigameResult(
	state: DeathvaultServerState,
): Record<string, number> {
	invariant(state.minigame, "enterMinigameResult: no active minigame");

	const { cashDeltas } = resolveMinigame(state.minigame, state.players);

	for (const [id, delta] of Object.entries(cashDeltas)) {
		const p = state.players.get(id);
		if (!p) continue;
		p.cash = Math.max(CASH_FLOOR, p.cash + delta);
		p.lastDelta = delta;
	}

	state.phase = "minigame_result";
	log(state, "minigame_result", { minigameId: state.minigame.id, cashDeltas });
	return cashDeltas;
}

function enterRoundEnd(state: DeathvaultServerState): void {
	state.phase = "round_end";
	state.minigame = null;
	log(state, "round_end", { round: state.round });
}

function advanceRound(state: DeathvaultServerState): void {
	state.round++;
	log(state, "round_advance", { newRound: state.round });
}

function enterPodium(state: DeathvaultServerState): void {
	state.phase = "podium";

	const ghosts = [...state.players.values()].filter(
		(p) => p.status === "ghost",
	);
	const alive = alivePlayers(state);

	if (ghosts.length > 0 && alive.length > 0 && state.questionResult) {
		const risenIds = state.questionResult.correctPlayerIds.filter(
			(id) => state.players.get(id)?.status === "ghost",
		);

		if (risenIds.length > 0) {
			const leader = alive.reduce((a, b) => (a.cash > b.cash ? a : b));
			const stolen = Math.floor(leader.cash / 2);
			leader.cash -= stolen;
			leader.lastDelta = -stolen;

			const sharePerGhost = Math.floor(stolen / risenIds.length);
			for (const ghostId of risenIds) {
				const g = state.players.get(ghostId)!;
				g.cash = sharePerGhost;
				g.lastDelta = sharePerGhost;
				g.status = "alive";
			}

			log(state, "ghost_resurrection", {
				risenIds,
				leaderId: leader.playerId,
				stolen,
			});
		}
	}

	log(state, "podium");
}

function timerForMinigameActive(state: DeathvaultServerState): number {
	const mg = state.minigame;
	if (!mg) return SCRAMBLE_MS;
	switch (mg.id) {
		case "prisoners_dilemma":
			return DILEMMA_MS;
		case "floor_is_lava":
			return LAVA_PICK_MS;
		case "word_scramble":
			return SCRAMBLE_MS;
		case "toxic_trivia":
			return HIGHER_LOWER_GUESS_MS;
		case "money_grab":
			return MONEY_GRAB_MS;
		case "higher_lower":
			return HIGHER_LOWER_GUESS_MS;
		case "final_cut":
			return FINAL_CUT_MS;
	}
}

// engine

export const deathvaultEngine: GameEngineWithSecrets = {
	gameId: "deathvault",

	getInitialState(): DeathvaultServerState {
		return {
			phase: "question_wager",
			round: 1,
			totalRounds: TOTAL_ROUNDS,
			questionQueue: [],
			currentQuestion: null,
			questionResult: null,
			players: new Map(),
			minigame: null,
			usedMinigameIds: [],
			cashHistory: [],
			roundResults: [],
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as DeathvaultServerState;

		invariant(
			room.players.size >= MIN_PLAYERS && room.players.size <= MAX_PLAYERS,
			`Deathvault requires ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${room.players.size}`,
		);

		state.players = new Map(
			[...room.players.values()].map((p) => [
				p.playerId,
				{
					playerId: p.playerId,
					cash: STARTING_CASH,
					status: "alive",
					wager: null,
					answer: null,
					lastDelta: null,
				} satisfies DeathvaultServerPlayer,
			]),
		);

		// difficulty ramp: easy early, medium mid, hard late
		const easy = shuffle(QUESTION_BANK.filter((q) => q.difficulty === 1));
		const medium = shuffle(QUESTION_BANK.filter((q) => q.difficulty === 2));
		const hard = shuffle(QUESTION_BANK.filter((q) => q.difficulty === 3));

		const queue = [
			...easy.slice(0, 2),
			...medium.slice(0, 3),
			...medium.slice(3, 5),
			...hard.slice(0, 3),
		].slice(0, TOTAL_ROUNDS);

		invariant(
			queue.length >= TOTAL_ROUNDS,
			`Not enough questions in bank for ${TOTAL_ROUNDS} rounds (have ${queue.length})`,
		);

		state.questionQueue = queue;
		enterWager(state);

		log(state, "game_start", {
			playerCount: state.players.size,
			totalRounds: state.totalRounds,
		});

		return {
			serverPayload: state,
			publicPayload: buildPublicState(state),
			timer: { startsAt: Date.now(), duration: WAGER_MS },
		};
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as DeathvaultServerState;

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: buildPublicState(state),
			timer: room.timer,
		});

		const action = parseDeathvaultAction(raw);
		if (!action) return noOp();

		const player = state.players.get(playerId);
		if (!player) return noOp();

		// wager phase
		if (
			action.type === "place_wager" &&
			(state.phase === "question_wager" || state.phase === "final_wager")
		) {
			if (player.status === "ghost") return noOp();
			if (player.wager !== null) return noOp();

			player.wager = Math.max(MIN_WAGER, Math.min(action.amount, player.cash));
			log(state, "wager_placed", { playerId, amount: player.wager });

			if (allAliveWagered(state)) {
				enterAnswer(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: QUESTION_MS },
				};
			}
			return noOp();
		}

		// answer phase
		if (
			action.type === "submit_answer" &&
			(state.phase === "question_answer" || state.phase === "final_answer")
		) {
			if (player.status === "ghost") return noOp();
			if (player.answer !== null) return noOp();

			const validChoice = state.currentQuestion?.choices.some(
				(c) => c.id === action.choiceId,
			);
			if (!validChoice) return noOp();

			player.answer = action.choiceId;
			log(state, "answer_submitted", { playerId });

			if (allAliveAnswered(state)) {
				const { cashDeltas, isFinal } = enterQuestionResult(state);
				if (isFinal) {
					enterPodium(state);
					return {
						serverPayload: state,
						publicPayload: buildPublicState(state),
						timer: null,
						roomPhase: "ended",
						scoreDeltas: cashDeltas,
					};
				}
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: QUESTION_RESULT_MS },
					scoreDeltas: cashDeltas,
				};
			}
			return noOp();
		}

		// minigame actions
		if (state.phase === "minigame_active" && state.minigame) {
			const changed = handleMinigameAction(
				state.minigame,
				action,
				playerId,
				state,
			);
			if (!changed) return noOp();

			// word scramble resolves immediately on first correct answer
			if (
				state.minigame.id === "word_scramble" &&
				action.type === "scramble_submit" &&
				!state.minigame.settled &&
				action.word.toUpperCase().trim() === state.minigame.answer
			) {
				const cashDeltas = enterMinigameResult(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: MINIGAME_RESULT_MS },
					scoreDeltas: cashDeltas,
				};
			}

			// higher/lower: wrong guess triggers immediate resolution
			if (state.minigame.id === "higher_lower" && state.minigame.settled) {
				const cashDeltas = enterMinigameResult(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: MINIGAME_RESULT_MS },
					scoreDeltas: cashDeltas,
				};
			}

			if (isMinigameComplete(state.minigame)) {
				const cashDeltas = enterMinigameResult(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: MINIGAME_RESULT_MS },
					scoreDeltas: cashDeltas,
				};
			}

			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: room.timer,
			};
		}

		return noOp();
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as DeathvaultServerState;

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: buildPublicState(state),
			timer: null,
		});

		// absent wagers default to 0 when timer expires
		if (state.phase === "question_wager" || state.phase === "final_wager") {
			for (const p of alivePlayers(state)) {
				if (p.wager === null) {
					p.wager = 0;
					log(state, "wager_defaulted", { playerId: p.playerId });
				}
			}
			enterAnswer(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: { startsAt: Date.now(), duration: QUESTION_MS },
			};
		}

		// timer expires: score all, unanswered = wrong
		if (state.phase === "question_answer" || state.phase === "final_answer") {
			const { cashDeltas, isFinal } = enterQuestionResult(state);

			if (isFinal) {
				enterPodium(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: null,
					roomPhase: "ended",
					scoreDeltas: cashDeltas,
				};
			}

			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: { startsAt: Date.now(), duration: QUESTION_RESULT_MS },
				scoreDeltas: cashDeltas,
			};
		}

		// after question result: start minigame or advance round
		if (state.phase === "question_result") {
			// skip minigame just before final round
			if (state.round === NORMAL_ROUNDS) {
				advanceRound(state);
				enterWager(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: WAGER_MS },
				};
			}
			enterMinigameIntro(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: { startsAt: Date.now(), duration: MINIGAME_INTRO_MS },
			};
		}

		if (state.phase === "final_result") {
			enterPodium(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: null,
				roomPhase: "ended",
			};
		}

		if (state.phase === "minigame_intro") {
			enterMinigameActive(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: {
					startsAt: Date.now(),
					duration: timerForMinigameActive(state),
				},
			};
		}

		// minigame active timer expired; dispatch per game type
		if (state.phase === "minigame_active" && state.minigame) {
			if (state.minigame.id === "floor_is_lava") {
				const mg = state.minigame;
				const { eliminated } = advanceLavaWave(mg);
				log(state, "lava_wave", { wave: mg.wave, eliminated });

				const wavesLeft =
					mg.wave < Math.floor(mg.lethalTiles.length / mg.burnPerWave);
				if (wavesLeft && mg.survivors.length > 1) {
					return {
						serverPayload: state,
						publicPayload: buildPublicState(state),
						timer: { startsAt: Date.now(), duration: LAVA_PICK_MS },
					};
				}
				const cashDeltas = enterMinigameResult(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: MINIGAME_RESULT_MS },
					scoreDeltas: cashDeltas,
				};
			}

			if (state.minigame.id === "toxic_trivia") {
				const mg = state.minigame;
				mg.currentHolderIndex++;
				if (mg.currentHolderIndex < mg.passOrder.length) {
					return {
						serverPayload: state,
						publicPayload: buildPublicState(state),
						timer: { startsAt: Date.now(), duration: HIGHER_LOWER_GUESS_MS },
					};
				}
				const cashDeltas = enterMinigameResult(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: MINIGAME_RESULT_MS },
					scoreDeltas: cashDeltas,
				};
			}

			if (state.minigame.id === "higher_lower") {
				state.minigame.settled = true;
				const cashDeltas = enterMinigameResult(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state),
					timer: { startsAt: Date.now(), duration: MINIGAME_RESULT_MS },
					scoreDeltas: cashDeltas,
				};
			}

			const cashDeltas = enterMinigameResult(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: { startsAt: Date.now(), duration: MINIGAME_RESULT_MS },
				scoreDeltas: cashDeltas,
			};
		}

		if (state.phase === "minigame_result") {
			enterRoundEnd(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: { startsAt: Date.now(), duration: ROUND_END_MS },
			};
		}

		if (state.phase === "round_end") {
			advanceRound(state);
			enterWager(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state),
				timer: { startsAt: Date.now(), duration: WAGER_MS },
			};
		}

		return noOp();
	},

	getPlayerSecret(ctx: GameContext, playerId: string): DeathvaultPlayerSecret {
		const state = ctx.room.gamePayload as DeathvaultServerState;
		return buildPlayerSecret(state, playerId);
	},
};