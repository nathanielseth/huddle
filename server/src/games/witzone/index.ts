import type {
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type {
	WitzoneServerState,
	WitzoneServerPrompt,
	WitzoneAnswerSlot,
} from "./types";
import type {
	WitzoneState,
	WitzonePlayerSecret,
	WitzonePublicPrompt,
	WitzonePlayerView,
} from "../../../../shared/witzone";
import {
	ANSWERING_MS,
	VOTING_MS,
	REVEAL_MS,
	ROUND_END_MS,
	FINAL_ANSWERING_MS,
	FINAL_VOTING_MS,
	FINAL_VOTE_TOKENS,
} from "./constants";
import { scorePromptR1R2, scorePromptFinal } from "./scoring";
import { QUESTION_BANK } from "./questions";
import { parseWitzoneAction } from "./schemas";
import type { Room } from "../../room/registry";
import { shuffle, shortId } from "../lib/random";

// helpers

function normalize(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
		.trim();
}

// draw n questions from the pool with an exhaustion guard
// if the pool runs dry (shouldn't happen given onstart sizing, but defensive), we refill from a fresh shuffle rather than returning undefined
function drawQuestions(state: WitzoneServerState, n: number): string[] {
	while (state.questionPool.length < n) {
		state.questionPool.push(...shuffle([...QUESTION_BANK]));
	}
	return state.questionPool.splice(0, n);
}

// public-state cache

function markDirty(state: WitzoneServerState): void {
	state._publicStateDirty = true;
}

// returns the cached public state if clean, otherwise rebuilds and caches
// callers must call markdirty() before this — never after — so the cache accurately reflects the current state
function getPublicState(state: WitzoneServerState, room: Room): WitzoneState {
	if (!state._publicStateDirty && state._cachedPublicState) {
		return state._cachedPublicState;
	}
	state._cachedPublicState = buildPublicState(state, room);
	state._publicStateDirty = false;
	return state._cachedPublicState;
}

// public state builder

function buildPublicState(state: WitzoneServerState, room: Room): WitzoneState {
	const players: Record<string, WitzonePlayerView> = {};

	for (const id of state.playerIds) {
		const score = room.players.get(id)?.score ?? 0;

		const hasAnswered: boolean = (() => {
			if (state.phase === "answering")
				return (state.playerAnswerCount.get(id) ?? 0) >= 2;
			if (state.phase === "final_answering")
				return (state.finalPrompt?.answers.get(id)?.text ?? null) !== null;
			return false;
		})();

		const hasVoted: boolean = (() => {
			if (state.phase === "voting_prompt" && state.promptStage === "voting") {
				return state.prompts[state.currentPromptIndex]?.votes.has(id) ?? false;
			}
			if (state.phase === "final_voting")
				return state.finalPrompt?.votes.has(id) ?? false;
			return false;
		})();

		players[id] = { id, score, hasAnswered, hasVoted };
	}

	// current prompt — only during the voting sub-stage
	let currentPrompt: WitzonePublicPrompt | null = null;
	if (state.phase === "voting_prompt" && state.promptStage === "voting") {
		const prompt = state.prompts[state.currentPromptIndex];
		if (prompt) {
			// sort by answerid for stable presentation that doesn't change on rebuild
			const sorted = [...prompt.slots].sort((a, b) =>
				a.answerId.localeCompare(b.answerId),
			);
			currentPrompt = {
				text: prompt.text,
				answers: sorted.map((s) => ({ id: s.answerId, text: s.text ?? "" })),
				authorIds: prompt.slots.map((s) => s.authorId),
				votedCount: prompt.votes.size,
				eligibleVoterCount: prompt.eligibleVoterIds.size,
			};
		}
	}

	// final answers — only during final_voting
	let finalAnswers: Array<{ id: string; text: string }> | null = null;
	if (state.phase === "final_voting" && state.finalPrompt) {
		finalAnswers = [...state.finalPrompt.answers.values()]
			.filter((e) => e.text !== null)
			.map((e) => ({ id: e.answerId, text: e.text! }))
			.sort((a, b) => a.id.localeCompare(b.id));
	}

	// answered count
	let answeredCount = 0;
	if (state.phase === "answering") {
		for (const id of state.playerIds) {
			if ((state.playerAnswerCount.get(id) ?? 0) >= 2) answeredCount++;
		}
	} else if (state.phase === "final_answering") {
		answeredCount = state.finalSubmittedCount;
	}

	// finalvotedcount derived from source-of-truth rather than a shadow counter
	const finalVotedCount = state.finalPrompt?.votes.size ?? 0;

	return {
		phase: state.phase,
		round: state.round,
		players,
		answeredCount,
		totalPlayers: state.playerIds.size,
		currentPromptIndex: state.currentPromptIndex,
		totalPromptsThisRound: state.prompts.length,
		promptStage: state.promptStage,
		currentPrompt,
		lastReveal: state.lastReveal,
		finalPromptText: state.finalPrompt?.text ?? null,
		finalAnswers,
		finalVotedCount,
		finalReveal: state.finalReveal,
	};
}

// secret builder

function buildPlayerSecret(
	state: WitzoneServerState,
	playerId: string,
): WitzonePlayerSecret {
	if (
		state.phase === "final_answering" ||
		state.phase === "final_voting" ||
		state.phase === "finished"
	) {
		const fp = state.finalPrompt;
		const entry = fp?.answers.get(playerId);
		return {
			assignedPrompts: [],
			finalPrompt: fp?.text ?? null,
			finalAnswerId: entry?.answerId ?? null,
		};
	}

	const assignedPrompts = state.prompts.flatMap((prompt) => {
		const slot = prompt.slots.find((s) => s.authorId === playerId);
		if (!slot) return [];
		return [
			{
				promptIndex: prompt.index,
				text: prompt.text,
				submitted: slot.text !== null,
				answer: slot.text,
			},
		];
	});

	return { assignedPrompts, finalPrompt: null, finalAnswerId: null };
}

function buildAllSecrets(state: WitzoneServerState): Map<string, unknown> {
	const secrets = new Map<string, unknown>();
	for (const id of state.playerIds) {
		secrets.set(id, buildPlayerSecret(state, id));
	}
	return secrets;
}

// round setup

function setupRound(state: WitzoneServerState): void {
	const playerIds = shuffle([...state.playerIds]);
	const N = playerIds.length;
	const questions = drawQuestions(state, N);

	state.prompts = questions.map((text, i): WitzoneServerPrompt => {
		const authorA = playerIds[i % N]!;
		const authorB = playerIds[(i + 1) % N]!;

		// pre-compute eligible voters once; avoids repeated filter in scoring/voting
		const eligibleVoterIds = new Set(
			playerIds.filter((id) => id !== authorA && id !== authorB),
		);

		return {
			index: i,
			text,
			slots: [
				{ answerId: shortId(), authorId: authorA, text: null },
				{ answerId: shortId(), authorId: authorB, text: null },
			] as [WitzoneAnswerSlot, WitzoneAnswerSlot],
			votes: new Map(),
			eligibleVoterIds,
		};
	});

	state.submittedSlots = 0;
	state.playerAnswerCount = new Map();
	state.currentPromptIndex = 0;
	state.promptStage = "voting";
	state.lastReveal = null;
}

function setupFinalRound(state: WitzoneServerState): void {
	const [text = "If you could add one law to the world, it would be: ___"] =
		drawQuestions(state, 1);

	const answers = new Map(
		[...state.playerIds].map((id) => [id, { answerId: shortId(), text: null }]),
	);

	state.finalPrompt = { text, answers, votes: new Map() };
	state.finalSubmittedCount = 0;
	state.finalReveal = null;
}

// phase transitions

function enterVotingForCurrentPrompt(
	state: WitzoneServerState,
	room: Room,
): EngineResult {
	const prompt = state.prompts[state.currentPromptIndex]!;
	const [slot0, slot1] = prompt.slots;
	const eligibleCount = prompt.eligibleVoterIds.size;

	const isJinx =
		slot0.text !== null &&
		slot1.text !== null &&
		normalize(slot0.text) === normalize(slot1.text);

	const isDefault = !isJinx && (slot0.text === null || slot1.text === null);

	if (isJinx || isDefault) {
		const { reveal, scoreDeltas } = scorePromptR1R2(
			prompt,
			state.round as 1 | 2,
		);
		state.lastReveal = reveal;
		state.promptStage = "revealing";
		markDirty(state);
		return {
			serverPayload: state,
			publicPayload: getPublicState(state, room),
			timer: { startsAt: Date.now(), duration: REVEAL_MS },
			...(Object.keys(scoreDeltas).length > 0 ? { scoreDeltas } : {}),
		};
	}

	state.promptStage = "voting";
	state.lastReveal = null;
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getPublicState(state, room),
		timer: { startsAt: Date.now(), duration: VOTING_MS },
	};
}

function scoreAndReveal(state: WitzoneServerState, room: Room): EngineResult {
	const prompt = state.prompts[state.currentPromptIndex]!;
	const { reveal, scoreDeltas } = scorePromptR1R2(prompt, state.round as 1 | 2);
	state.lastReveal = reveal;
	state.promptStage = "revealing";
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getPublicState(state, room),
		timer: { startsAt: Date.now(), duration: REVEAL_MS },
		...(Object.keys(scoreDeltas).length > 0 ? { scoreDeltas } : {}),
	};
}

function advanceVoting(state: WitzoneServerState, room: Room): EngineResult {
	const nextIndex = state.currentPromptIndex + 1;

	if (nextIndex < state.prompts.length) {
		state.currentPromptIndex = nextIndex;
		markDirty(state);
		return enterVotingForCurrentPrompt(state, room);
	}

	state.phase = "round_end";
	state.lastReveal = null;
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getPublicState(state, room),
		timer: { startsAt: Date.now(), duration: ROUND_END_MS },
	};
}

function enterVotingPhase(state: WitzoneServerState, room: Room): EngineResult {
	state.phase = "voting_prompt";
	state.currentPromptIndex = 0;
	state.lastReveal = null;
	markDirty(state);
	return enterVotingForCurrentPrompt(state, room);
}

function startRound2(state: WitzoneServerState, room: Room): EngineResult {
	state.round = 2;
	state.phase = "answering";
	setupRound(state);
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getPublicState(state, room),
		timer: { startsAt: Date.now(), duration: ANSWERING_MS },
		privatePayloads: buildAllSecrets(state),
	};
}

function startFinalRound(state: WitzoneServerState, room: Room): EngineResult {
	state.round = 3;
	state.phase = "final_answering";
	setupFinalRound(state);
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getPublicState(state, room),
		timer: { startsAt: Date.now(), duration: FINAL_ANSWERING_MS },
		privatePayloads: buildAllSecrets(state),
	};
}

function enterFinalVoting(state: WitzoneServerState, room: Room): EngineResult {
	state.phase = "final_voting";
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getPublicState(state, room),
		timer: { startsAt: Date.now(), duration: FINAL_VOTING_MS },
		privatePayloads: buildAllSecrets(state),
	};
}

// projects scoreDeltas into publicState.players scores
function withProjectedScores(
    publicState: WitzoneState,
    deltas: Record<string, number>,
): WitzoneState {
    if (Object.keys(deltas).length === 0) return publicState;
    return {
        ...publicState,
        players: Object.fromEntries(
            Object.entries(publicState.players).map(([id, p]) => [
                id,
                { ...p, score: p.score + (deltas[id] ?? 0) },
            ]),
        ),
    };
}

function enterFinished(state: WitzoneServerState, room: Room): EngineResult {
    if (!state.finalPrompt) {
        state.phase = "finished";
        markDirty(state);
        return {
            serverPayload: state,
            publicPayload: getPublicState(state, room),
            timer: null,
            roomPhase: "ended",
        };
    }

    const { reveal, scoreDeltas } = scorePromptFinal(state.finalPrompt);
    state.finalReveal = reveal;
    state.phase = "finished";
    markDirty(state);

    return {
        serverPayload: state,
        publicPayload: withProjectedScores(getPublicState(state, room), scoreDeltas),
        timer: null,
        roomPhase: "ended",
        ...(Object.keys(scoreDeltas).length > 0 ? { scoreDeltas } : {}),
    };
}

// engine

export const witzoneEngine: GameEngineWithSecrets = {
	gameId: "witzone",

	getInitialState(): WitzoneServerState {
		return {
			phase: "answering",
			round: 1,
			playerIds: new Set(),
			questionPool: [],
			prompts: [],
			submittedSlots: 0,
			playerAnswerCount: new Map(),
			currentPromptIndex: 0,
			promptStage: "voting",
			lastReveal: null,
			finalPrompt: null,
			finalSubmittedCount: 0,
			finalReveal: null,
			_publicStateDirty: true,
			_cachedPublicState: null,
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as WitzoneServerState;

		state.playerIds = new Set(room.players.keys());

		// size the pool to cover all three rounds with comfortable headroom
		const needed = state.playerIds.size * 2 + 1;
		const pool = shuffle([...QUESTION_BANK]);
		while (pool.length < needed) pool.push(...shuffle([...QUESTION_BANK]));
		state.questionPool = pool;

		state.round = 1;
		state.phase = "answering";
		setupRound(state);
		markDirty(state);

		return {
			serverPayload: state,
			publicPayload: getPublicState(state, room),
			timer: { startsAt: Date.now(), duration: ANSWERING_MS },
			privatePayloads: buildAllSecrets(state),
		};
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as WitzoneServerState;

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: getPublicState(state, room),
			timer: room.timer,
		});

		const action = parseWitzoneAction(raw);
		if (!action) return noOp();
		if (!state.playerIds.has(playerId)) return noOp();

		// submit_answer
		if (action.type === "submit_answer") {
			// r1 / r2
			if (state.phase === "answering") {
				const prompt = state.prompts[action.promptIndex];
				if (!prompt) return noOp();

				const slot = prompt.slots.find((s) => s.authorId === playerId);
				if (!slot || slot.text !== null) return noOp();

				slot.text = action.text;
				state.submittedSlots++;
				state.playerAnswerCount.set(
					playerId,
					(state.playerAnswerCount.get(playerId) ?? 0) + 1,
				);
				markDirty(state);

				const privatePayloads: Map<string, unknown> = new Map([
					[playerId, buildPlayerSecret(state, playerId)],
				]);

				if (state.submittedSlots >= state.prompts.length * 2) {
					return { ...enterVotingPhase(state, room), privatePayloads };
				}

				return {
					serverPayload: state,
					publicPayload: getPublicState(state, room),
					timer: room.timer,
					privatePayloads,
				};
			}

			// final answering
			if (state.phase === "final_answering") {
				if (!state.finalPrompt) return noOp();
				const entry = state.finalPrompt.answers.get(playerId);
				if (!entry || entry.text !== null) return noOp();

				entry.text = action.text;
				state.finalSubmittedCount++;
				markDirty(state);

				if (state.finalSubmittedCount >= state.playerIds.size) {
					return enterFinalVoting(state, room);
				}

				return {
					serverPayload: state,
					publicPayload: getPublicState(state, room),
					timer: room.timer,
					privatePayloads: new Map([
						[playerId, buildPlayerSecret(state, playerId)],
					]),
				};
			}

			return noOp();
		}

		// cast_vote
		if (action.type === "cast_vote") {
			if (state.phase !== "voting_prompt" || state.promptStage !== "voting")
				return noOp();

			const prompt = state.prompts[state.currentPromptIndex];
			if (!prompt) return noOp();
			if (!prompt.eligibleVoterIds.has(playerId)) return noOp();
			if (prompt.votes.has(playerId)) return noOp();
			if (!prompt.slots.some((s) => s.answerId === action.answerId))
				return noOp();

			prompt.votes.set(playerId, action.answerId);
			markDirty(state);

			if (prompt.votes.size >= prompt.eligibleVoterIds.size) {
				return scoreAndReveal(state, room);
			}

			return noOp();
		}

		// cast_final_votes
		if (action.type === "cast_final_votes") {
			if (state.phase !== "final_voting") return noOp();
			if (!state.finalPrompt) return noOp();
			if (state.finalPrompt.votes.has(playerId)) return noOp();

			const myAnswerId = state.finalPrompt.answers.get(playerId)?.answerId;

			// validate: no self-vote, all ids exist, tokens sum to exactly final_vote_tokens
			let totalTokens = 0;
			for (const [answerId, tokens] of Object.entries(action.votes)) {
				if (answerId === myAnswerId) return noOp();
				if (
					![...state.finalPrompt.answers.values()].some(
						(e) => e.answerId === answerId,
					)
				)
					return noOp();
				totalTokens += tokens;
			}
			if (totalTokens !== FINAL_VOTE_TOKENS) return noOp();

			state.finalPrompt.votes.set(
				playerId,
				new Map(Object.entries(action.votes).map(([k, v]) => [k, v as number])),
			);
			markDirty(state);

			// source-of-truth check: votes.size rather than a shadow counter
			if (state.finalPrompt.votes.size >= state.playerIds.size) {
				return enterFinished(state, room);
			}

			return noOp();
		}

		return noOp();
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as WitzoneServerState;

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: getPublicState(state, room),
			timer: null,
		});

		if (state.phase === "answering") return enterVotingPhase(state, room);

		if (state.phase === "voting_prompt") {
			if (state.promptStage === "voting") return scoreAndReveal(state, room);
			if (state.promptStage === "revealing") return advanceVoting(state, room);
		}

		if (state.phase === "round_end")
			return state.round === 1
				? startRound2(state, room)
				: startFinalRound(state, room);
		if (state.phase === "final_answering") return enterFinalVoting(state, room);
		if (state.phase === "final_voting") return enterFinished(state, room);

		return noOp();
	},

	getPlayerSecret(
		ctx: GameContext,
		playerId: string,
	): WitzonePlayerSecret | null {
		const state = ctx.room.gamePayload as WitzoneServerState;
		if (!state.playerIds.has(playerId)) return null;
		return buildPlayerSecret(state, playerId);
	},
};