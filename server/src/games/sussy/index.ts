import type {
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type { SussyServerState, SussyServerPlayer } from "./types";
import type {
	SussyState,
	SussyPlayerView,
	SussyPlayerSecret,
	SussyRoundResult,
	SussyTaskVoteResult,
	TaskType,
} from "../../../../shared/games/sussy";
import {
	SELECTABLE_TASKS,
	TASK_DURATIONS_MS,
	HANGOUT_NO_SUBMIT_TASKS,
} from "./constants";
import type { Room } from "../../room/registry";
import { getMajorityTarget, scoreTaskVote, scoreThumbVote } from "./scoring";
import type { VoteOutcome } from "./scoring";
import { PROMPT_BANK } from "./prompts";
import { parseSussyAction } from "./schemas";
import { pickRandom } from "../lib/random";
import { invariant } from "../lib/assert";

const CATEGORY_SELECT_MS = 20_000;
const ROLE_REVEAL_MS = 5_000;
const HANGOUT_DISPLAY_MS = 8_000;
const VOTING_MS = 20_000;
const ROUND_RESULT_MS = 8_000;

interface TaskConfig {
	readonly durationMs: number;
	readonly requiresSubmission: boolean;
}

// single source of truth for "does this task need phone input?"
// remote mode always requires submission. hangout mode: selectable tasks are
// display-only, only glitch_in_the_chat requires written answers
function getTaskConfig(
	taskType: TaskType,
	mode: SussyServerState["mode"],
): TaskConfig {
	if (mode === "remote") {
		return {
			durationMs: TASK_DURATIONS_MS[taskType],
			requiresSubmission: true,
		};
	}

	const requiresSubmission = !HANGOUT_NO_SUBMIT_TASKS.has(taskType);
	return {
		durationMs: requiresSubmission
			? TASK_DURATIONS_MS[taskType]
			: HANGOUT_DISPLAY_MS,
		requiresSubmission,
	};
}

function pickRandomPlayerId(players: Map<string, SussyServerPlayer>): string {
	const ids = [...players.keys()];
	return ids[Math.floor(Math.random() * ids.length)] as string;
}

function allResponded(state: SussyServerState): boolean {
	if (!getTaskConfig(state.taskType, state.mode).requiresSubmission)
		return true;
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

// exactly the fields that reset at the start of every round. adding a new
// per-round field? add it here — not in advanceRound
type RoundSlice = Pick<
	SussyServerState,
	| "taskNumber"
	| "taskResults"
	| "correctVoteCount"
	| "responses"
	| "votes"
	| "chooserPlayerId"
	| "impostorId"
	| "crewPrompt"
	| "impostorPrompt"
>;

function freshRoundSlice(): RoundSlice {
	return {
		taskNumber: 1,
		taskResults: [],
		correctVoteCount: new Map(),
		responses: new Map(),
		votes: new Map(),
		chooserPlayerId: null,
		impostorId: null,
		crewPrompt: "",
		impostorPrompt: null,
	};
}

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

// single implementation shared by buildSecrets (bulk) and getPlayerSecret (reconnect)
function computePlayerSecret(
	state: SussyServerState,
	playerId: string,
): SussyPlayerSecret | null {
	if (!state.players.has(playerId)) return null;
	if (!state.impostorId) return null;

	const isImpostor = playerId === state.impostorId;
	const isGlitch = state.roundNumber === 4;

	if (isGlitch) {
		// glitch round: everyone appears crew, impostor just gets different prompts
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
}

function buildSecrets(state: SussyServerState): Map<string, unknown> {
	const map = new Map<string, unknown>();
	for (const playerId of state.players.keys()) {
		const secret = computePlayerSecret(state, playerId);
		if (secret) map.set(playerId, secret);
	}
	return map;
}

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

	const majorityTargetId =
		state.phase === "voting" && state.votes.size > 0
			? getMajorityTarget(state.votes, state.players.size)
			: null;

	const { requiresSubmission } = getTaskConfig(state.taskType, state.mode);

	const players: Record<string, SussyPlayerView> = {};
	for (const [id, p] of state.players) {
		players[id] = {
			playerId: id,
			score: room.players.get(id)?.score ?? 0,
			sleuthedCount: p.totalSleuthed,
			survivedCount: p.totalSurvived,
			hasResponded: requiresSubmission ? state.responses.has(id) : true,
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

function enterCategorySelect(state: SussyServerState): void {
	invariant(
		state.players.size >= 2,
		`enterCategorySelect requires ≥ 2 players, got ${state.players.size}`,
	);
	state.phase = "category_select";
	state.chooserPlayerId = pickRandomPlayerId(state.players);
}

function enterRoleReveal(state: SussyServerState): void {
	state.impostorId = pickRandomPlayerId(state.players);
	const { crewPrompt, impostorPrompt } = pickPrompts(state.taskType);
	state.crewPrompt = crewPrompt;
	state.impostorPrompt = impostorPrompt;
	state.phase = "role_reveal";
}

function enterTaskPerform(state: SussyServerState): number {
	state.responses = new Map();
	state.phase = "task_perform";
	return getTaskConfig(state.taskType, state.mode).durationMs;
}

function enterVoting(state: SussyServerState): void {
	state.votes = new Map();
	state.phase = "voting";
}

function advanceRound(state: SussyServerState): void {
	state.roundNumber++;
	// freshRoundSlice is the single authoritative list of fields that reset
	Object.assign(state, freshRoundSlice());
}

interface VoteComputation {
	readonly wasCaught: boolean;
	readonly scoreDeltas: Record<string, number>;
	readonly newCorrectVoters: ReadonlySet<string>;
}

// pure query — scores current vote state, no mutations
function computeVoteResult(state: SussyServerState): VoteComputation {
	invariant(
		state.impostorId !== null,
		"computeVoteResult called without a set impostor",
	);

	const outcome: VoteOutcome = {
		impostorId: state.impostorId,
		votes: state.votes,
		playerCount: state.players.size,
	};

	// glitch round always runs all three tasks regardless of vote outcome.
	// catching becomes "official" on task 3. tasks 1 & 2 still award SLEUTH
	// points for correct votes — only CAUGHT bonus and early termination are held
	const allowCaught =
		state.taskType !== "glitch_in_the_chat" || state.taskNumber === 3;

	const result =
		state.taskType === "thumb_shot"
			? scoreThumbVote(outcome)
			: scoreTaskVote(
					outcome,
					state.taskNumber,
					state.correctVoteCount,
					allowCaught,
				);

	return {
		wasCaught: result.wasCaught,
		scoreDeltas: result.deltas,
		newCorrectVoters: result.newCorrectVoters,
	};
}

// command — applies computed vote result to mutable state. call computeVoteResult first
function commitVoteResult(
	state: SussyServerState,
	computed: VoteComputation,
): void {
	const { wasCaught, scoreDeltas, newCorrectVoters } = computed;

	for (const voterId of newCorrectVoters) {
		state.correctVoteCount.set(
			voterId,
			(state.correctVoteCount.get(voterId) ?? 0) + 1,
		);
		state.players.get(voterId)!.totalSleuthed++;
	}

	if (!wasCaught) {
		const survivor = state.players.get(state.impostorId!);
		if (survivor) survivor.totalSurvived++;
	}

	const voteBreakdown: Record<string, string | null> = {};
	for (const [voterId, targetId] of state.votes) {
		voteBreakdown[voterId] = targetId;
	}

	state.taskResults.push({
		taskNumber: state.taskNumber,
		wasCaught,
		voteBreakdown,
		scoreDeltas,
	} satisfies SussyTaskVoteResult);
}

function finalizeRound(state: SussyServerState): void {
	const { impostorId } = state;
	invariant(impostorId !== null, "finalizeRound called without a set impostor");
	state.roundResults.push({
		roundNumber: state.roundNumber,
		taskType: state.taskType,
		impostorId,
		taskResults: [...state.taskResults],
		crewPrompt: state.crewPrompt,
		impostorPrompt: state.impostorPrompt,
	} satisfies SussyRoundResult);
}

function resolveVoting(state: SussyServerState, room: Room): EngineResult {
	const computed = computeVoteResult(state);
	commitVoteResult(state, computed);

	const { wasCaught, scoreDeltas } = computed;
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

	invariant(state.taskNumber !== 3, "Attempted to advance past task 3");
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

export const sussyEngine: GameEngineWithSecrets = {
	gameId: "sussy-impostors",

	getInitialState(): SussyServerState {
		return {
			phase: "category_select",
			// TODO: surface mode selection in lobby when remote is ready. for now, always hangout
			mode: "hangout",
			roundNumber: 0,
			taskNumber: 1,
			taskType: "show_of_hands",
			chooserPlayerId: null,
			impostorId: null,
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

		invariant(
			state.players.size >= 2,
			`Cannot start a game with fewer than 2 players (got ${state.players.size})`,
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

		const noOp = (): EngineResult => ({
			serverPayload: state,
			publicPayload: buildPublicState(state, room),
			timer: room.timer,
		});

		const action = parseSussyAction(raw);
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
			if (!getTaskConfig(state.taskType, state.mode).requiresSubmission)
				return noOp();
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
			// fill absent votes with null so scorer sees complete picture
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
		return computePlayerSecret(
			ctx.room.gamePayload as SussyServerState,
			playerId,
		);
	},
};