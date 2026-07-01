import type {
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import {
	type BelievableLiesServerState,
	type BelievableLiesServerPlayer,
	type BelievableLiesBuiltAnswer,
	type BelievableLiesQuestion,
	ABSTAIN,
} from "./types";
import type {
	BelievableLiesState,
	BelievableLiesPlayerView,
	BelievableLiesRoundResult,
	BelievableLiesAnswer,
} from "../../../../shared/games/believable-lies";
import {
	LIE_INPUT_MS,
	PICKING_MS,
	RESULT_MS,
	ROUND_END_MS,
	QUESTION_SELECT_MS,
	QUESTIONS_PER_ROUND,
	MIN_ANSWER_POOL_SIZE,
	CATEGORY_CHOICE_COUNT,
	MIN_PLAYERS,
} from "./constants";
import { scoreRound } from "./scoring";
import { QUESTION_BANK } from "./questions";
import { parseBelievableLiesAction } from "./schemas";
import type { Room } from "../../room/registry";
import { shuffle, shortId, pickRandom } from "../lib/random";
import { invariant } from "../lib/assert";

function log(
	state: BelievableLiesServerState,
	event: string,
	meta?: Record<string, unknown>,
): void {
	console.log(
		JSON.stringify({
			game: "believable-lies",
			event,
			round: state.roundNumber,
			questionIndex: state.questionIndex,
			phase: state.phase,
			playerCount: state.players.size,
			...meta,
		}),
	);
}

// normalises a string for truth/duplicate detection: lowercased, non-alphanumeric
// removed (except apostrophes in contractions), whitespace collapsed
function normalize(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9'\s]/g, "")
		.replace(/'\s|^'|'$/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function isTooSimilar(lie: string, question: BelievableLiesQuestion): boolean {
	const norm = normalize(lie);
	if (norm === normalize(question.truth)) return true;
	for (const alt of question.alternate_truths) {
		if (norm === normalize(alt)) return true;
	}
	return false;
}

// authoritative completion checks derived from Map.size, always consistent
function allSubmitted(state: BelievableLiesServerState): boolean {
	return state.lies.size >= state.players.size;
}

function allPicked(state: BelievableLiesServerState): boolean {
	return state.picks.size >= state.players.size;
}

// rebuilt on every result, no caching. O(n) on player count, negligible vs I/O
function buildPublicState(
	state: BelievableLiesServerState,
	room: Room,
): BelievableLiesState {
	const revealAnswers = state.phase === "picking" || state.phase === "result";
	const revealSubmissions = state.phase === "result";

	const players: Record<string, BelievableLiesPlayerView> = {};
	for (const [id] of state.players) {
		players[id] = {
			playerId: id,
			score: room.players.get(id)?.score ?? 0,
			hasSubmittedLie: state.lies.has(id),
			hasPicked: state.picks.has(id),
			submittedLie: revealSubmissions ? (state.lies.get(id) ?? null) : null,
			pickedAnswerId: revealSubmissions
				? state.picks.get(id) !== ABSTAIN
					? (state.picks.get(id) ?? null)
					: null
				: null,
		};
	}

	const answers: BelievableLiesAnswer[] | null = revealAnswers
		? state.answerPool.map(({ id, text, isGameLie }) => ({
				id,
				text,
				isGameLie,
			}))
		: null;

	const lastResult = state.results[state.results.length - 1] ?? null;

	return {
		phase: state.phase,
		roundNumber: state.roundNumber,
		questionIndex: state.questionIndex,
		totalQuestionsThisRound: QUESTIONS_PER_ROUND[state.roundNumber],
		currentPrompt: state.currentQuestion?.prompt ?? null,
		answers,
		players,
		lastResult,
		allSubmitted: allSubmitted(state),
		allPicked: allPicked(state),
		pickerPlayerId: state.pickerPlayerId,
		categoryChoices:
			state.phase === "question_select" ? state.categoryChoices : null,
	};
}

// resets rotation when every player has had a turn
function pickNextPicker(state: BelievableLiesServerState): string {
	const ids = [...state.players.keys()];

	if (state.usedPickerIds.length >= ids.length) {
		state.usedPickerIds = [];
	}

	const used = new Set(state.usedPickerIds);
	const available = ids.filter((id) => !used.has(id));
	const picked = pickRandom(available.length ? available : ids);
	state.usedPickerIds.push(picked);
	return picked;
}

function getAvailableCategories(queue: BelievableLiesQuestion[]): string[] {
	return [...new Set(queue.map((q) => q.category))];
}

// returns up to CATEGORY_CHOICE_COUNT distinct categories from remaining queue.
// may return fewer if queue is nearly exhausted
function pickCategoryChoices(queue: BelievableLiesQuestion[]): string[] {
	const cats = shuffle(getAvailableCategories(queue));
	return cats.slice(0, CATEGORY_CHOICE_COUNT);
}

function buildAnswerPool(
	state: BelievableLiesServerState,
): BelievableLiesBuiltAnswer[] {
	const question = state.currentQuestion;
	invariant(question, "buildAnswerPool called with no currentQuestion");

	// merge duplicate lies: same normalised form → single pool entry, multiple authors
	const lieGroups = new Map<string, { text: string; authorIds: string[] }>();
	for (const [playerId, rawText] of state.lies) {
		const norm = normalize(rawText);
		// silently drop lies that match the truth
		if (isTooSimilar(rawText, question)) continue;
		const existing = lieGroups.get(norm);
		if (existing) {
			existing.authorIds.push(playerId);
		} else {
			lieGroups.set(norm, { text: rawText, authorIds: [playerId] });
		}
	}

	const pool: BelievableLiesBuiltAnswer[] = [];
	for (const { text, authorIds } of lieGroups.values()) {
		pool.push({
			id: shortId(),
			text,
			normalizedText: normalize(text),
			authorIds,
			isGameLie: false,
			isTruth: false,
		});
	}

	// pad with game_lies when player pool is too small
	const existingNorms = new Set(pool.map((a) => a.normalizedText));
	const truthNorm = normalize(question.truth);
	const gameLies = shuffle([...question.game_lies]);
	for (const lie of gameLies) {
		if (pool.length >= MIN_ANSWER_POOL_SIZE - 1) break;
		const norm = normalize(lie);
		if (existingNorms.has(norm) || norm === truthNorm) continue;
		existingNorms.add(norm);
		pool.push({
			id: shortId(),
			text: lie,
			normalizedText: norm,
			authorIds: [],
			isGameLie: true,
			isTruth: false,
		});
	}

	// truth is always present — enterResult depends on this invariant
	pool.push({
		id: shortId(),
		text: question.truth,
		normalizedText: truthNorm,
		authorIds: [],
		isGameLie: false,
		isTruth: true,
	});

	return shuffle(pool);
}

function buildQuestionQueue(): BelievableLiesQuestion[] {
	const totalNeeded = Object.values(QUESTIONS_PER_ROUND).reduce(
		(sum, n) => sum + n,
		0,
	);

	// hard fail at startup if question bank is too small
	invariant(
		QUESTION_BANK.length >= totalNeeded,
		`Question bank has ${QUESTION_BANK.length} questions but ${totalNeeded} are needed for a full game`,
	);

	return shuffle([...QUESTION_BANK]).slice(0, totalNeeded);
}

function dequeueQuestion(
	state: BelievableLiesServerState,
): BelievableLiesQuestion {
	const q = state.questionQueue.shift();
	invariant(q, "Question queue exhausted unexpectedly");
	return q;
}

function enterQuestionSelect(state: BelievableLiesServerState): void {
	state.phase = "question_select";
	state.pickerPlayerId = pickNextPicker(state);
	state.categoryChoices = pickCategoryChoices(state.questionQueue);
	state.lies = new Map();
	state.picks = new Map();
	state.answerPool = [];
	state.currentQuestion = null;

	log(state, "question_select", {
		pickerPlayerId: state.pickerPlayerId,
		categoryChoices: state.categoryChoices,
		questionIndex: state.questionIndex,
		queueRemaining: state.questionQueue.length,
	});
}

function enterLieInputForCategory(
	state: BelievableLiesServerState,
	category: string,
): void {
	const idx = state.questionQueue.findIndex((q) => q.category === category);
	let question: BelievableLiesQuestion;
	if (idx !== -1) {
		const spliced = state.questionQueue.splice(idx, 1);
		question = spliced[0] ?? dequeueQuestion(state);
	} else {
		// category no longer in queue, fall through to next available question
		question = dequeueQuestion(state);
	}

	state.currentQuestion = question;
	state.categoryChoices = null;
	state.phase = "lie_input";

	log(state, "lie_input", {
		questionId: question.id,
		category: question.category,
	});
}

// assigns game_lie fallbacks to players who didn't submit before timer expired.
// if game_lies pool is exhausted, affected players have no lie this round
function autoAssignLies(state: BelievableLiesServerState): void {
	const question = state.currentQuestion;
	invariant(question, "autoAssignLies called with no currentQuestion");

	const usedLieNorms = new Set([...state.lies.values()].map(normalize));
	const availableGameLies = shuffle([...question.game_lies]).filter(
		(gl) => !usedLieNorms.has(normalize(gl)),
	);

	if (!availableGameLies.length) {
		log(state, "auto_assign_lies_exhausted", {
			playersWithoutLie: [...state.players.keys()].filter(
				(id) => !state.lies.has(id),
			).length,
		});
		return;
	}

	let idx = 0;
	const unsubmitted: string[] = [];
	for (const id of state.players.keys()) {
		if (state.lies.has(id)) continue;
		state.lies.set(id, availableGameLies[idx % availableGameLies.length]!);
		unsubmitted.push(id);
		idx++;
	}

	log(state, "auto_assign_lies", { count: unsubmitted.length });
}

function enterPicking(state: BelievableLiesServerState): void {
	state.answerPool = buildAnswerPool(state);
	state.picks = new Map();
	state.phase = "picking";

	log(state, "picking", { poolSize: state.answerPool.length });
}

function enterResult(
	state: BelievableLiesServerState,
	_room: Room,
): { scoreDeltas: Record<string, number> } {
	const question = state.currentQuestion;
	invariant(question, "enterResult called with no currentQuestion");

	const truthAnswer = state.answerPool.find((a) => a.isTruth);
	invariant(
		truthAnswer,
		"enterResult called with no truth entry in answerPool",
	);

	const scoreDeltas = scoreRound({
		round: state.roundNumber,
		answerPool: state.answerPool,
		picks: state.picks,
		playerIds: [...state.players.keys()],
	});

	const truthPickerIds: string[] = [];
	for (const [pid, aid] of state.picks) {
		if (aid === truthAnswer.id) truthPickerIds.push(pid);
	}

	state.results.push({
		prompt: question.prompt,
		truth: question.truth,
		answers: state.answerPool.map(
			({ id, text, authorIds, isGameLie, isTruth }) => ({
				id,
				text,
				authorIds,
				isGameLie,
				isTruth,
			}),
		),
		picks: Object.fromEntries(state.picks),
		scoreDeltas,
		truthPickerIds,
	} satisfies BelievableLiesRoundResult);

	state.phase = "result";

	log(state, "result", {
		truthPickerCount: truthPickerIds.length,
		scoreDeltas,
	});

	return { scoreDeltas };
}

// determines what follows the result phase: more questions → question_select,
// last question of last round → finished, last question of rounds 1–2 → round_end
function resolveAfterResult(
	state: BelievableLiesServerState,
	room: Room,
): EngineResult {
	const questionsThisRound = QUESTIONS_PER_ROUND[state.roundNumber];
	const isLastQuestionInRound = state.questionIndex + 1 >= questionsThisRound;

	if (!isLastQuestionInRound) {
		state.questionIndex++;
		enterQuestionSelect(state);
		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: { startsAt: Date.now(), duration: QUESTION_SELECT_MS },
		};
	}

	if (state.roundNumber >= 3) {
		state.phase = "finished";
		log(state, "game_finished");
		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: null,
			roomPhase: "ended",
		};
	}

	state.phase = "round_end";
	log(state, "round_end", { completedRound: state.roundNumber });
	return {
		serverPayload: state,
		publicPayload: buildPublicState(state, room),
		timer: { startsAt: Date.now(), duration: ROUND_END_MS },
	};
}

function advanceToNextRound(state: BelievableLiesServerState): void {
	state.roundNumber = (state.roundNumber + 1) as 1 | 2 | 3;
	state.questionIndex = 0;
	log(state, "round_advance", { newRound: state.roundNumber });
}

export const believableLiesEngine: GameEngineWithSecrets = {
	gameId: "believable-lies",

	getInitialState(): BelievableLiesServerState {
		return {
			phase: "question_select",
			roundNumber: 1,
			questionIndex: 0,
			questionQueue: [],
			currentQuestion: null,
			answerPool: [],
			lies: new Map(),
			picks: new Map(),
			players: new Map(),
			results: [],
			pickerPlayerId: null,
			categoryChoices: null,
			usedPickerIds: [],
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as BelievableLiesServerState;

		invariant(
			room.players.size >= MIN_PLAYERS,
			`BelievableLies requires at least ${MIN_PLAYERS} players, got ${room.players.size}`,
		);

		state.players = new Map(
			Array.from(room.players.values()).map((p) => [
				p.playerId,
				{ playerId: p.playerId } satisfies BelievableLiesServerPlayer,
			]),
		);

		state.questionQueue = buildQuestionQueue();
		state.roundNumber = 1;
		state.questionIndex = 0;
		enterQuestionSelect(state);

		log(state, "game_start", {
			playerCount: state.players.size,
			queueSize: state.questionQueue.length,
		});

		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: { startsAt: Date.now(), duration: QUESTION_SELECT_MS },
		};
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as BelievableLiesServerState;

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: room.timer,
		});

		const action = parseBelievableLiesAction(raw);
		if (!action) return noOp();
		if (!state.players.has(playerId)) return noOp();

		if (action.type === "select_category") {
			if (state.phase !== "question_select") return noOp();
			if (playerId !== state.pickerPlayerId) return noOp();
			if (!state.categoryChoices?.includes(action.category)) return noOp();

			enterLieInputForCategory(state, action.category);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: LIE_INPUT_MS },
			};
		}

		if (action.type === "submit_lie") {
			if (state.phase !== "lie_input") return noOp();
			if (state.lies.has(playerId)) return noOp();
			if (!state.currentQuestion) return noOp();
			if (isTooSimilar(action.text, state.currentQuestion)) return noOp();

			state.lies.set(playerId, action.text);

			log(state, "lie_submitted", { playerId, liesSize: state.lies.size });

			if (allSubmitted(state)) {
				enterPicking(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state, room),
					timer: { startsAt: Date.now(), duration: PICKING_MS },
				};
			}
			return noOp();
		}

		if (action.type === "pick_answer") {
			if (state.phase !== "picking") return noOp();
			if (state.picks.has(playerId)) return noOp();

			const answer = state.answerPool.find((a) => a.id === action.answerId);
			if (!answer) return noOp();
			// players cannot pick their own lie
			if (answer.authorIds.includes(playerId)) return noOp();

			state.picks.set(playerId, action.answerId);

			log(state, "pick_submitted", { playerId, picksSize: state.picks.size });

			if (allPicked(state)) {
				const { scoreDeltas } = enterResult(state, room);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state, room),
					timer: { startsAt: Date.now(), duration: RESULT_MS },
					scoreDeltas,
				};
			}
			return noOp();
		}

		return noOp();
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as BelievableLiesServerState;

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: null,
		});

		// picker didn't choose in time, auto-select a category
		if (state.phase === "question_select") {
			const choices = state.categoryChoices;
			if (choices && choices.length > 0) {
				enterLieInputForCategory(state, pickRandom(choices));
			} else {
				const fallback = state.questionQueue[0];
				if (!fallback) {
					log(state, "queue_exhausted_on_timer");
					state.phase = "finished";
					return {
						serverPayload: state,
						publicPayload: buildPublicState(state, room),
						timer: null,
						roomPhase: "ended",
					};
				}
				enterLieInputForCategory(state, fallback.category);
			}
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: LIE_INPUT_MS },
			};
		}

		// assign game_lies to unsubmitted players, then open picking
		if (state.phase === "lie_input") {
			autoAssignLies(state);
			enterPicking(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: PICKING_MS },
			};
		}

		// record ABSTAIN for players who didn't pick, then score
		if (state.phase === "picking") {
			const abstainers: string[] = [];
			for (const id of state.players.keys()) {
				if (!state.picks.has(id)) {
					state.picks.set(id, ABSTAIN);
					abstainers.push(id);
				}
			}
			if (abstainers.length) {
				log(state, "picking_abstained", { abstainers });
			}
			const { scoreDeltas } = enterResult(state, room);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: RESULT_MS },
				scoreDeltas,
			};
		}

		if (state.phase === "result") {
			return resolveAfterResult(state, room);
		}

		if (state.phase === "round_end") {
			advanceToNextRound(state);
			enterQuestionSelect(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: QUESTION_SELECT_MS },
			};
		}

		return noOp();
	},

	getPlayerSecret(_ctx: GameContext, _playerId: string): null {
		return null;
	},
};