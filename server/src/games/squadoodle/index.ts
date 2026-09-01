import type {
	GameEngine,
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type { GameTimer } from "../../../../shared/core/room";
import type {
	SquadoodleState,
	SquadoodleSecret,
	SquadoodleAction,
	ChainEntry,
	PlayerTask,
	ReactionTally,
	Accolade,
	AccoladeKind,
	ReactionType,
	Stroke,
} from "../../../../shared/games/squadoodle/index";
import type { SquadoodleServerState } from "./types";
import { C } from "./constants";
import { SquadoodleActionSchema } from "./schemas";
import { chainForPlayer, isDrawingStep } from "./routing";
import { shuffle } from "../lib/random";
import { makeTimer } from "./../lib/timer";
import { defined } from "../lib/assert";

// ─── exhaustiveness helper ───────────────────────────────────────────────────

function assertNever(x: never): never {
	throw new Error(`Unhandled case: ${String(x)}`);
}

// ─── reaction helpers ────────────────────────────────────────────────────────

function getTally(
	reactions: Map<number, Map<number, Map<string, ReactionType>>>,
	c: number,
	e: number,
): ReactionTally {
	let fire = 0,
		laugh = 0,
		heart = 0,
		trash = 0;
	const byEntry = reactions.get(c)?.get(e);
	if (byEntry) {
		for (const r of byEntry.values()) {
			if (r === "fire") fire++;
			else if (r === "laugh") laugh++;
			else if (r === "heart") heart++;
			else trash++; // only remaining ReactionType is "trash"
		}
	}
	return { fire, laugh, heart, trash };
}

function setReaction(
	reactions: Map<number, Map<number, Map<string, ReactionType>>>,
	chainIndex: number,
	entryIndex: number,
	playerId: string,
	reaction: ReactionType,
): void {
	let byChain = reactions.get(chainIndex);
	if (!byChain) {
		byChain = new Map();
		reactions.set(chainIndex, byChain);
	}
	let byEntry = byChain.get(entryIndex);
	if (!byEntry) {
		byEntry = new Map();
		byChain.set(entryIndex, byEntry);
	}
	byEntry.set(playerId, reaction);
}

function buildReactionMatrix(state: SquadoodleServerState): ReactionTally[][] {
	return state.chains.map((chain, c) =>
		chain.map((_, e) => getTally(state.reactions, c, e)),
	);
}

// ─── public state builder ────────────────────────────────────────────────────

function buildPublicState(state: SquadoodleServerState): SquadoodleState {
	const N = state.playerOrder.length;
	const isRevealPhase = state.phase === "reveal" || state.phase === "accolades";

	return {
		phase: state.phase,
		step: state.step,
		totalSteps: N,
		playerOrder: state.playerOrder,
		submittedCount: state.submissions.size,
		totalCount: N,
		revealChainIndex: state.revealChainIndex,
		revealEntryIndex: state.revealEntryIndex,
		chains: isRevealPhase ? state.chains : [],
		reactions: buildReactionMatrix(state),
		accolades: state.accolades,
	};
}

// ─── result factory ──────────────────────────────────────────────────────────

function makeResult(
	state: SquadoodleServerState,
	timer: GameTimer | null,
	privatePayloads?: Map<string, SquadoodleSecret>,
	roomPhase?: "ended",
): EngineResult {
	return {
		serverPayload: state,
		publicPayload: buildPublicState(state),
		timer,
		...(privatePayloads && { privatePayloads }),
		...(roomPhase && { roomPhase }),
	};
}

// ─── secret helpers ──────────────────────────────────────────────────────────

function broadcastTask(
	state: SquadoodleServerState,
	task: PlayerTask,
): Map<string, SquadoodleSecret> {
	const map = new Map<string, SquadoodleSecret>();
	for (const id of state.playerOrder) {
		map.set(id, { task });
	}
	return map;
}

// ─── accolades ───────────────────────────────────────────────────────────────

function computeAccolades(state: SquadoodleServerState): Accolade[] {
	const accolades: Accolade[] = [];
	const N = state.playerOrder.length;

	function bestEntry(
		kind: AccoladeKind,
		entryType: "drawing" | "guess",
		metric: keyof ReactionTally,
	): void {
		let max = 0;
		let bestC = -1;
		let bestE = -1;

		for (let c = 0; c < N; c++) {
			const chain = defined(
				state.chains[c],
				`chains[${String(c)}] missing in bestEntry`,
			);
			for (let e = 0; e < chain.length; e++) {
				const entry = defined(
					chain[e],
					`chains[${String(c)}][${String(e)}] missing in bestEntry`,
				);
				if (entry.type !== entryType) continue;
				const count = getTally(state.reactions, c, e)[metric];
				if (count > max) {
					max = count;
					bestC = c;
					bestE = e;
				}
			}
		}

		if (max > 0 && bestC >= 0 && bestE >= 0) {
			const chain = defined(
				state.chains[bestC],
				`chains[${String(bestC)}] missing when pushing accolade`,
			);
			const entry = defined(
				chain[bestE],
				`chains[${String(bestC)}][${String(bestE)}] missing when pushing accolade`,
			);
			accolades.push({
				kind,
				chainIndex: bestC,
				entryIndex: bestE,
				authorId: entry.authorId,
			});
		}
	}

	bestEntry("most_hearted_drawing", "drawing", "heart");
	bestEntry("funniest_guess", "guess", "laugh");
	bestEntry("most_trashed_drawing", "drawing", "trash");

	// Most chaotic chain: highest total fire count across all entries.
	{
		let max = 0;
		let bestC = -1;
		for (let c = 0; c < N; c++) {
			const chain = defined(
				state.chains[c],
				`chains[${String(c)}] missing in chaotic scan`,
			);
			const fire = chain.reduce(
				(sum, _, e) => sum + getTally(state.reactions, c, e).fire,
				0,
			);
			if (fire > max) {
				max = fire;
				bestC = c;
			}
		}
		if (max > 0 && bestC >= 0) {
			const chain = defined(
				state.chains[bestC],
				`chains[${String(bestC)}] missing when pushing chaotic accolade`,
			);
			const firstEntry = defined(
				chain[0],
				`chains[${String(bestC)}][0] missing — chain unexpectedly empty`,
			);
			accolades.push({
				kind: "most_chaotic_chain",
				chainIndex: bestC,
				entryIndex: null,
				authorId: firstEntry.authorId,
			});
		}
	}

	return accolades;
}

// ─── work secrets ────────────────────────────────────────────────────────────

function buildWorkSecrets(
	state: SquadoodleServerState,
): Map<string, SquadoodleSecret> {
	const N = state.playerOrder.length;
	const isDrawing = isDrawingStep(state.step);
	const map = new Map<string, SquadoodleSecret>();

	for (let i = 0; i < N; i++) {
		const pid = defined(
			state.playerOrder[i],
			`playerOrder[${String(i)}] missing in buildWorkSecrets`,
		);
		const chainIndex = chainForPlayer(i, state.step, N);
		const chain = defined(
			state.chains[chainIndex],
			`chains[${String(chainIndex)}] missing in buildWorkSecrets`,
		);
		const lastEntry = defined(
			chain[chain.length - 1],
			`chains[${String(chainIndex)}] is empty at step ${String(state.step)}`,
		);

		let task: PlayerTask;

		if (isDrawing) {
			const text =
				lastEntry.type === "prompt" || lastEntry.type === "guess"
					? lastEntry.text
					: "";
			task = { type: "draw", basedOn: text };
		} else {
			const strokes: readonly Stroke[] =
				lastEntry.type === "drawing" ? lastEntry.strokes : [];
			task = { type: "guess", strokes };
		}

		map.set(pid, { task });
	}

	return map;
}

// ─── step & reveal advancement ───────────────────────────────────────────────

function advanceStep(state: SquadoodleServerState): EngineResult {
	const N = state.playerOrder.length;
	const lastWorkStep = N - 1;

	if (state.step >= lastWorkStep) {
		return enterReveal(state);
	}

	state.step++;
	state.submissions = new Set();

	const isDrawing = isDrawingStep(state.step);
	state.phase = isDrawing ? "drawing" : "guessing";

	const secrets = buildWorkSecrets(state);
	const duration = isDrawing ? C.DRAWING_MS : C.GUESSING_MS;
	return makeResult(state, makeTimer(duration), secrets);
}

function enterReveal(state: SquadoodleServerState): EngineResult {
	state.phase = "reveal";
	state.revealChainIndex = 0;
	state.revealEntryIndex = 0;

	const secrets = broadcastTask(state, { type: "react" });
	return makeResult(state, makeTimer(C.REVEAL_ENTRY_MS), secrets);
}

function advanceReveal(state: SquadoodleServerState): EngineResult {
	const N = state.playerOrder.length;
	const currentChain = defined(
		state.chains[state.revealChainIndex],
		`chains[${String(state.revealChainIndex)}] missing in advanceReveal`,
	);

	state.revealEntryIndex++;

	if (state.revealEntryIndex >= currentChain.length) {
		state.revealChainIndex++;
		state.revealEntryIndex = 0;

		if (state.revealChainIndex >= N) {
			return enterAccolades(state);
		}

		return makeResult(state, makeTimer(C.REVEAL_CHAIN_PAUSE_MS));
	}

	return makeResult(state, makeTimer(C.REVEAL_ENTRY_MS));
}

function enterAccolades(state: SquadoodleServerState): EngineResult {
	state.phase = "accolades";
	state.accolades = computeAccolades(state);
	return makeResult(state, makeTimer(C.ACCOLADES_MS));
}

// ─── submission handling ─────────────────────────────────────────────────────

function handleSubmit(
	state: SquadoodleServerState,
	playerId: string,
	playerIndex: number,
	entry: ChainEntry,
	currentTimer: GameTimer | null,
): EngineResult | null {
	if (state.submissions.has(playerId)) return null;

	const N = state.playerOrder.length;
	const chainIndex = chainForPlayer(playerIndex, state.step, N);
	defined(
		state.chains[chainIndex],
		`chains[${String(chainIndex)}] missing in handleSubmit`,
	).push(entry);
	state.submissions.add(playerId);

	if (state.submissions.size === N) {
		return advanceStep(state);
	}

	return makeResult(state, currentTimer);
}

function autoFillMissing(state: SquadoodleServerState): void {
	const N = state.playerOrder.length;

	if (state.submissions.size === N) return;

	for (let i = 0; i < N; i++) {
		const pid = defined(
			state.playerOrder[i],
			`playerOrder[${String(i)}] missing in autoFillMissing`,
		);
		if (state.submissions.has(pid)) continue;

		const chainIndex = chainForPlayer(i, state.step, N);
		const chain = defined(
			state.chains[chainIndex],
			`chains[${String(chainIndex)}] missing in autoFillMissing`,
		);

		if (state.phase === "prompt_writing") {
			chain.push({ type: "prompt", authorId: pid, text: "…" });
		} else if (state.phase === "drawing") {
			chain.push({ type: "drawing", authorId: pid, strokes: [] });
		} else {
			// only remaining work phase is "guessing"
			chain.push({ type: "guess", authorId: pid, text: "…" });
		}

		state.submissions.add(pid);
	}
}

// ─── engine export ───────────────────────────────────────────────────────────

export const squadoodleEngine: GameEngine & GameEngineWithSecrets = {
	gameId: "squadoodle",

	actionSchema: SquadoodleActionSchema,

	getInitialState(): SquadoodleServerState {
		return {
			phase: "prompt_writing",
			step: 0,
			playerOrder: [],
			chains: [],
			submissions: new Set(),
			revealChainIndex: 0,
			revealEntryIndex: 0,
			reactions: new Map(),
			accolades: [],
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SquadoodleServerState;

		const playerIds = [...room.players.values()].map((p) => p.playerId);

		state.playerOrder = shuffle(playerIds);
		state.chains = Array.from({ length: playerIds.length }, () => []);
		state.submissions = new Set();
		state.step = 0;
		state.phase = "prompt_writing";
		state.revealChainIndex = 0;
		state.revealEntryIndex = 0;
		state.reactions = new Map();
		state.accolades = [];

		const secrets = broadcastTask(state, { type: "write_prompt" });
		return makeResult(state, makeTimer(C.PROMPT_WRITING_MS), secrets);
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SquadoodleServerState;
		const action = raw as SquadoodleAction;

		const noOp = (): EngineResult => makeResult(state, room.timer);

		const playerIndex = state.playerOrder.indexOf(playerId);
		if (playerIndex === -1) return noOp();

		switch (state.phase) {
			case "prompt_writing": {
				if (action.type !== "submit_prompt") return noOp();

				const result = handleSubmit(
					state,
					playerId,
					playerIndex,
					{ type: "prompt", authorId: playerId, text: action.text },
					room.timer,
				);
				return result ?? noOp();
			}

			case "drawing": {
				if (action.type !== "submit_drawing") return noOp();

				const result = handleSubmit(
					state,
					playerId,
					playerIndex,
					{ type: "drawing", authorId: playerId, strokes: action.strokes },
					room.timer,
				);
				return result ?? noOp();
			}

			case "guessing": {
				if (action.type !== "submit_guess") return noOp();

				const result = handleSubmit(
					state,
					playerId,
					playerIndex,
					{ type: "guess", authorId: playerId, text: action.text },
					room.timer,
				);
				return result ?? noOp();
			}

			case "reveal": {
				if (action.type === "react") {
					const { chainIndex, entryIndex, reaction } = action;
					const N = state.playerOrder.length;

					if (chainIndex < 0 || chainIndex >= N) return noOp();

					const chain = defined(
						state.chains[chainIndex],
						`chains[${String(chainIndex)}] missing during react`,
					);

					if (entryIndex < 0 || entryIndex >= chain.length) return noOp();

					if (chainIndex > state.revealChainIndex) return noOp();
					if (
						chainIndex === state.revealChainIndex &&
						entryIndex >= state.revealEntryIndex
					)
						return noOp();

					setReaction(
						state.reactions,
						chainIndex,
						entryIndex,
						playerId,
						reaction,
					);

					return makeResult(state, room.timer);
				}

				if (action.type === "next_reveal") {
					return advanceReveal(state);
				}

				return noOp();
			}

			case "accolades": {
				if (action.type === "play_again") {
					return makeResult(state, null, undefined, "ended");
				}
				return noOp();
			}

			default:
				return assertNever(state.phase);
		}
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as SquadoodleServerState;

		switch (state.phase) {
			case "prompt_writing":
			case "drawing":
			case "guessing": {
				autoFillMissing(state);
				return advanceStep(state);
			}

			case "reveal":
				return advanceReveal(state);

			case "accolades":
				return makeResult(state, null, undefined, "ended");

			default:
				return assertNever(state.phase);
		}
	},

	getPlayerSecret(ctx: GameContext, playerId: string): SquadoodleSecret | null {
		const state = ctx.room.gamePayload as SquadoodleServerState;

		if (state.phase === "reveal" || state.phase === "accolades") {
			return { task: { type: "react" } };
		}

		if (state.submissions.has(playerId)) {
			return { task: { type: "wait" } };
		}

		if (state.phase === "prompt_writing") {
			return { task: { type: "write_prompt" } };
		}

		const playerIndex = state.playerOrder.indexOf(playerId);
		if (playerIndex === -1) return null;

		const N = state.playerOrder.length;
		const chainIndex = chainForPlayer(playerIndex, state.step, N);
		const chain = state.chains[chainIndex];
		if (chain === undefined) return null;

		const lastEntry = chain[chain.length - 1];
		if (lastEntry === undefined) return null;

		if (state.phase === "drawing") {
			const text =
				lastEntry.type === "prompt" || lastEntry.type === "guess"
					? lastEntry.text
					: "";
			return { task: { type: "draw", basedOn: text } };
		}

		// only remaining work phase is "guessing"
		const strokes: readonly Stroke[] =
			lastEntry.type === "drawing" ? lastEntry.strokes : [];
		return { task: { type: "guess", strokes } };
	},
};