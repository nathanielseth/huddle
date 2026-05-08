import { z } from "zod";
import type {
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/engine.js";
import type {
	SussyServerState,
	SussyServerPlayer,
	SussyParsedAction,
} from "./types.js";
import type {
	SussyState,
	SussyPlayerView,
	SussyPlayerSecret,
	SussyRoundResult,
	SussyTaskVoteResult,
	TaskType,
} from "../../../../shared/sussy.js";
import {
	SELECTABLE_TASKS,
	TASK_DURATIONS_MS,
	HANGOUT_NO_SUBMIT_TASKS,
} from "./constants.js";
import type { Room } from "../../room/rooms.js";
import { scoreTaskVote, scoreThumbVote } from "./scoring.js";
import { PROMPT_BANK } from "./prompts.js";

// ─── Timing ───────────────────────────────────────────────────────────────────

const CATEGORY_SELECT_MS = 20_000;
const ROLE_REVEAL_MS = 5_000;
const HANGOUT_DISPLAY_MS = 8_000;
const VOTING_MS = 20_000;
const ROUND_RESULT_MS = 8_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)] as T;
}

function pickRandomPlayerId(players: Map<string, SussyServerPlayer>): string {
	const ids = [...players.keys()];
	return ids[Math.floor(Math.random() * ids.length)] as string;
}

function isNoSubmit(state: SussyServerState): boolean {
	return (
		state.mode === "hangout" &&
		(HANGOUT_NO_SUBMIT_TASKS as readonly string[]).includes(state.taskType)
	);
}

function allResponded(state: SussyServerState): boolean {
	if (isNoSubmit(state)) return true;
	for (const id of state.players.keys()) {
		if (!state.responses.has(id)) return false;
	}
	return true;
}

function allVoted(state: SussyServerState): boolean {
	for (const id of state.players.keys()) {
		if (!state.votes.has(id)) return false;
	}
	return true;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function pickPrompts(taskType: TaskType): {
	crewPrompt: string | [string, string, string];
	impostorPrompt: string | [string, string, string] | null;
} {
	if (taskType === "glitch_in_the_chat") {
		const pair = pickRandom(PROMPT_BANK.glitch_in_the_chat);
		return { crewPrompt: pair.crew, impostorPrompt: pair.impostor };
	}
	const bank = PROMPT_BANK[taskType] as Array<{
		crew: string | [string, string, string];
	}>;
	const entry = pickRandom(bank);
	return { crewPrompt: entry.crew, impostorPrompt: null };
}

// ─── Secrets ──────────────────────────────────────────────────────────────────

function buildSecrets(state: SussyServerState): Map<string, unknown> {
	const map = new Map<string, unknown>();
	const isGlitch = state.roundNumber === 4;

	for (const playerId of state.players.keys()) {
		const isImpostor = playerId === state.impostorId;
		let secret: SussyPlayerSecret;

		if (isGlitch) {
			secret = {
				role: "crew",
				prompt: isImpostor ? state.impostorPrompt : state.crewPrompt,
				isGlitchRound: true,
				taskNumber: state.taskNumber,
			};
		} else if (isImpostor) {
			secret = {
				role: "impostor",
				prompt: null,
				isGlitchRound: false,
				taskNumber: state.taskNumber,
			};
		} else {
			secret = {
				role: "crew",
				prompt: state.crewPrompt,
				isGlitchRound: false,
				taskNumber: state.taskNumber,
			};
		}

		map.set(playerId, secret);
	}

	return map;
}

// ─── Public State ─────────────────────────────────────────────────────────────

function buildPublicState(state: SussyServerState, room: Room): SussyState {
	const showResponses =
		state.phase === "task_perform" ||
		state.phase === "voting" ||
		state.phase === "round_result";
	const revealVotes = state.phase === "round_result";

	const lastResult = state.roundResults[state.roundResults.length - 1] ?? null;
	const lastTask = lastResult?.taskResults[lastResult.taskResults.length - 1];
	const caughtNow =
		state.phase === "round_result" && (lastTask?.wasCaught ?? false);

	// Compute live majority during voting so client can show real-time feedback
	let majorityTargetId: string | null = null;
	if (state.phase === "voting" && state.votes.size > 0) {
		const tally = new Map<string, number>();
		for (const targetId of state.votes.values()) {
			if (!targetId) continue;
			tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
		}
		const threshold = Math.floor(state.players.size / 2) + 1;
		for (const [targetId, count] of tally) {
			if (count >= threshold) {
				majorityTargetId = targetId;
				break;
			}
		}
	}

	const players: Record<string, SussyPlayerView> = {};
	for (const [id, p] of state.players) {
		players[id] = {
			playerId: id,
			score: room.players.get(id)?.score ?? 0,
			sleuthedCount: p.totalSleuthed,
			survivedCount: p.totalSurvived,
			hasResponded: isNoSubmit(state) ? true : state.responses.has(id),
			hasVoted: state.votes.has(id),
			response: showResponses ? (state.responses.get(id) ?? null) : null,
			voteTargetId: revealVotes ? (state.votes.get(id) ?? null) : null,
			isEliminated: caughtNow && id === state.impostorId,
		};
	}

	return {
		phase: state.phase,
		mode: state.mode,
		roundNumber: state.roundNumber,
		taskNumber: state.taskNumber,
		taskType: state.taskType,
		chooserPlayerId: state.chooserPlayerId,
		players,
		lastRoundResult: lastResult,
		allResponded: allResponded(state),
		allVoted: allVoted(state),
		majorityTargetId,
	};
}

// ─── Phase Helpers ────────────────────────────────────────────────────────────

function enterCategorySelect(state: SussyServerState): void {
	state.phase = "category_select";
	state.chooserPlayerId = pickRandomPlayerId(state.players);
}

function enterRoleReveal(state: SussyServerState): void {
	state.impostorId = pickRandomPlayerId(state.players);
	const { crewPrompt, impostorPrompt } = pickPrompts(state.taskType);
	state.crewPrompt = crewPrompt;
	state.impostorPrompt = impostorPrompt;
	state.responses = new Map();
	state.votes = new Map();
	state.phase = "role_reveal";
}

function enterTaskPerform(state: SussyServerState): number {
	state.responses = new Map();
	state.phase = "task_perform";
	return isNoSubmit(state)
		? HANGOUT_DISPLAY_MS
		: TASK_DURATIONS_MS[state.taskType];
}

function enterVoting(state: SussyServerState): void {
	state.votes = new Map();
	state.phase = "voting";
}

function advanceRound(state: SussyServerState): void {
	state.roundNumber++;
	state.taskNumber = 1;
	state.taskResults = [];
	state.correctVoteCount = new Map();
	state.responses = new Map();
	state.votes = new Map();
	state.chooserPlayerId = null;
	state.impostorId = "";
	state.crewPrompt = "";
	state.impostorPrompt = null;
}

// ─── Vote Processing ──────────────────────────────────────────────────────────

function processVotes(state: SussyServerState): {
	wasCaught: boolean;
	scoreDeltas: Record<string, number>;
} {
	const allowCaught =
		state.taskType !== "glitch_in_the_chat" || state.taskNumber === 3;

	const outcome = {
		impostorId: state.impostorId,
		votes: state.votes,
		playerCount: state.players.size,
	};

	const result =
		state.taskType === "thumb_shot"
			? scoreThumbVote(outcome)
			: scoreTaskVote(
					outcome,
					state.taskNumber,
					state.correctVoteCount,
					allowCaught,
				);

	for (const [playerId] of state.players) {
		if (playerId === state.impostorId) continue;
		if (state.votes.get(playerId) === state.impostorId) {
			state.players.get(playerId)!.totalSleuthed++;
		}
	}
	if (!result.wasCaught) {
		const imp = state.players.get(state.impostorId);
		if (imp) imp.totalSurvived++;
	}

	const voteBreakdown: Record<string, string | null> = {};
	for (const [voterId, targetId] of state.votes) {
		voteBreakdown[voterId] = targetId;
	}

	state.taskResults.push({
		taskNumber: state.taskNumber,
		wasCaught: result.wasCaught,
		voteBreakdown,
		scoreDeltas: result.deltas,
	} satisfies SussyTaskVoteResult);

	return { wasCaught: result.wasCaught, scoreDeltas: result.deltas };
}

function finalizeRound(state: SussyServerState): void {
	state.roundResults.push({
		roundNumber: state.roundNumber,
		taskType: state.taskType,
		impostorId: state.impostorId,
		taskResults: [...state.taskResults],
		crewPrompt: state.crewPrompt,
		impostorPrompt: state.impostorPrompt,
	} satisfies SussyRoundResult);
}

function resolveVoting(state: SussyServerState, room: Room): EngineResult {
	const { wasCaught, scoreDeltas } = processVotes(state);
	const isThumb = state.taskType === "thumb_shot";
	const isLastTask = state.taskNumber === 3;

	if (wasCaught || isLastTask || isThumb) {
		finalizeRound(state);
		state.phase = "round_result";
		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: { startsAt: Date.now(), duration: ROUND_RESULT_MS },
			scoreDeltas,
		};
	}

	state.taskNumber = (state.taskNumber + 1) as 2 | 3;
	const duration = enterTaskPerform(state);
	return {
		serverPayload: state,
		publicPayload: buildPublicState(state, room),
		timer: { startsAt: Date.now(), duration },
		scoreDeltas,
	};
}

function handleRoundResultExpired(
	state: SussyServerState,
	room: Room,
): EngineResult {
	if (state.roundNumber >= 4) {
		state.phase = "finished";
		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: null,
			roomPhase: "ended",
		};
	}

	advanceRound(state);

	if (state.roundNumber === 4) {
		state.taskType = "glitch_in_the_chat";
		enterRoleReveal(state);
		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: { startsAt: Date.now(), duration: ROLE_REVEAL_MS },
			privatePayloads: buildSecrets(state),
		};
	}

	enterCategorySelect(state);
	return {
		serverPayload: state,
		publicPayload: buildPublicState(state, room),
		timer: { startsAt: Date.now(), duration: CATEGORY_SELECT_MS },
	};
}

// ─── Action Parser ────────────────────────────────────────────────────────────

const ResponseSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("show_of_hands"), raised: z.boolean() }),
	z.object({
		type: z.literal("finger_pointing"),
		targetId: z.string().nullable(),
	}),
	z.object({
		type: z.literal("finger_blast"),
		count: z.number().int().min(0).max(5),
	}),
	z.object({
		type: z.literal("thumb_shot"),
		choices: z.array(z.boolean()).length(3),
	}),
	z.object({ type: z.literal("face_turn"), emoji: z.string().nullable() }),
	z.object({
		type: z.literal("glitch_in_the_chat"),
		answers: z.array(z.string()).max(3),
	}),
]);

const ActionSchema = z.discriminatedUnion("type", [
	z.object({
		type: z.literal("select_category"),
		category: z.enum([
			"show_of_hands",
			"finger_pointing",
			"finger_blast",
			"thumb_shot",
			"face_turn",
		]),
	}),
	z.object({ type: z.literal("submit_response"), response: ResponseSchema }),
	z.object({ type: z.literal("cast_vote"), targetId: z.string() }),
]);

function parseAction(raw: unknown): SussyParsedAction | null {
	const result = ActionSchema.safeParse(raw);
	return result.success ? (result.data as SussyParsedAction) : null;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export const sussyEngine: GameEngineWithSecrets = {
	gameId: "sussy-impostors",

	getInitialState(): SussyServerState {
		return {
			phase: "category_select",
			mode: "hangout",
			roundNumber: 0,
			taskNumber: 1,
			taskType: "show_of_hands",
			chooserPlayerId: null,
			impostorId: "",
			crewPrompt: "",
			impostorPrompt: null,
			responses: new Map(),
			votes: new Map(),
			correctVoteCount: new Map(),
			taskResults: [],
			roundResults: [],
			players: new Map(),
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const state = ctx.room.gamePayload as SussyServerState;

		state.players = new Map(
			Array.from(ctx.room.players.values()).map((p) => [
				p.playerId,
				{
					playerId: p.playerId,
					totalSleuthed: 0,
					totalSurvived: 0,
				} satisfies SussyServerPlayer,
			]),
		);

		advanceRound(state);
		enterCategorySelect(state);

		return {
			serverPayload: state,
			publicPayload: buildPublicState(state, ctx.room),
			timer: { startsAt: Date.now(), duration: CATEGORY_SELECT_MS },
		};
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SussyServerState;
		const action = parseAction(raw);

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: room.timer,
		});

		if (!action) return noOp();
		if (!state.players.has(playerId)) return noOp();

		if (action.type === "select_category") {
			if (state.phase !== "category_select") return noOp();
			if (playerId !== state.chooserPlayerId) return noOp();
			state.taskType = action.category;
			enterRoleReveal(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: ROLE_REVEAL_MS },
				privatePayloads: buildSecrets(state),
			};
		}

		if (action.type === "submit_response") {
			if (state.phase !== "task_perform") return noOp();
			if (isNoSubmit(state)) return noOp();
			if (state.responses.has(playerId)) return noOp();
			if (action.response.type !== state.taskType) return noOp();
			state.responses.set(playerId, action.response);
			if (allResponded(state)) {
				enterVoting(state);
				return {
					serverPayload: state,
					publicPayload: buildPublicState(state, room),
					timer: { startsAt: Date.now(), duration: VOTING_MS },
				};
			}
			return noOp();
		}

		if (action.type === "cast_vote") {
			if (state.phase !== "voting") return noOp();
			if (state.votes.has(playerId)) return noOp();
			if (!state.players.has(action.targetId)) return noOp();
			if (action.targetId === playerId) return noOp();
			state.votes.set(playerId, action.targetId);
			if (allVoted(state)) return resolveVoting(state, room);
			return noOp();
		}

		return noOp();
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SussyServerState;

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: null,
		});

		if (state.phase === "category_select") {
			state.taskType = pickRandom(SELECTABLE_TASKS);
			enterRoleReveal(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: ROLE_REVEAL_MS },
				privatePayloads: buildSecrets(state),
			};
		}

		if (state.phase === "role_reveal") {
			const duration = enterTaskPerform(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration },
			};
		}

		if (state.phase === "task_perform") {
			enterVoting(state);
			return {
				serverPayload: state,
				publicPayload: buildPublicState(state, room),
				timer: { startsAt: Date.now(), duration: VOTING_MS },
			};
		}

		if (state.phase === "voting") {
			for (const id of state.players.keys()) {
				if (!state.votes.has(id)) state.votes.set(id, null);
			}
			return resolveVoting(state, room);
		}

		if (state.phase === "round_result") {
			return handleRoundResultExpired(state, room);
		}

		return noOp();
	},

	getPlayerSecret(
		ctx: GameContext,
		playerId: string,
	): SussyPlayerSecret | null {
		const state = ctx.room.gamePayload as SussyServerState;
		if (!state.players.has(playerId)) return null;
		if (!state.impostorId) return null;

		const isImpostor = playerId === state.impostorId;
		const isGlitch = state.roundNumber === 4;

		if (isGlitch) {
			return {
				role: "crew",
				prompt: isImpostor ? state.impostorPrompt : state.crewPrompt,
				isGlitchRound: true,
				taskNumber: state.taskNumber,
			};
		}

		return {
			role: isImpostor ? "impostor" : "crew",
			prompt: isImpostor ? null : state.crewPrompt,
			isGlitchRound: false,
			taskNumber: state.taskNumber,
		};
	},
};
