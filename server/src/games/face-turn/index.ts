import type {
	GameEngine,
	GameEngineWithSecrets,
	GameEngineWithCpuSeats,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import { getLegalActions, type EngineHelpers } from "./cpu/legal-actions";
import { getCpuSearchPool } from "../../engine/CpuSearchPool";
import type { FaceturnsSecret } from "../../../../shared/games/face-turn/types";
import type {
	FaceturnServerState,
	GameConfig,
} from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import { FaceturnsActionSchema, FaceturnsConfigActionSchema } from "./schemas";
import { getFaceturnSeatBounds } from "../../../../shared/games/face-turn/constants";
import {
	makeServerPlayer,
	buildTeamsAndTurnOrder,
	setTurnOrderAfterRps,
	autoFillAndFinalizeDraft,
	dealOpeningHand,
	resolveRps,
	startTurn,
	swapTurn,
	checkWinConditions,
	applyWin,
	recordBluffIfUnchallenged,
	executePendingAction,
	getMoveCost,
	getClassActionCost,
	computeActorWasBluffing,
	markDirty,
	resolveMoveChainFull,
} from "./game";
import {
	performStrike,
	type StrikeOrExecuteOutcome,
} from "./effects";
import type { ResolutionResult } from "../../../../shared/games/face-turn/types";
import { getInteractionSpec } from "./interactions/registry";
import { dispatchAction } from "./actions/index";
import {
	getCachedPublicState,
	buildPrivatePayloads,
	buildSecretForPlayer,
} from "./state-builders";
import {
	applyConfigAction,
	buildGameConfig,
	getMaxSeats,
	validateStart,
	onPlayerRemoved,
} from "./config";

export function buildStrikeResolution(
	outcome: StrikeOrExecuteOutcome,
	attackerId: string,
	targetPlayerId: string,
	via: "strike" | "face_turn" | "challenge_loss",
): ResolutionResult {
	if (outcome.outcome === "pending") {
		throw new Error(
			'buildStrikeResolution called with a pending outcome — check outcome.outcome !== "pending" before calling',
		);
	}

	if (outcome.outcome === "crew_turned") {
		return {
			type: "strike_or_execute_resolved",
			attackerId,
			targetPlayerId,
			via,
			outcome: "crew_turned",
			crewTurnedSlot: outcome.slot,
			crewKilledSlot: null,
			crewRefilledFromReserve: false,
			negatedBy: null,
			survivedViaLifeInsurance: false,
		};
	}

	if (outcome.outcome === "crew_killed") {
		return {
			type: "strike_or_execute_resolved",
			attackerId,
			targetPlayerId,
			via,
			outcome: "crew_killed",
			crewTurnedSlot: null,
			crewKilledSlot: outcome.slot,
			crewRefilledFromReserve: outcome.refilledFromReserve,
			negatedBy: null,
			survivedViaLifeInsurance: false,
		};
	}

	if (outcome.outcome === "executed") {
		return {
			type: "strike_or_execute_resolved",
			attackerId,
			targetPlayerId,
			via,
			outcome: "executed",
			crewTurnedSlot: null,
			crewKilledSlot: null,
			crewRefilledFromReserve: false,
			negatedBy: null,
			survivedViaLifeInsurance: outcome.survivedViaLifeInsurance,
		};
	}

	// negated
	return {
		type: "strike_or_execute_resolved",
		attackerId,
		targetPlayerId,
		via,
		outcome: "negated",
		crewTurnedSlot: null,
		crewKilledSlot: null,
		crewRefilledFromReserve: false,
		negatedBy: outcome.negatedBy,
		survivedViaLifeInsurance: false,
	};
}

// executes the original class action after a deferred penalty interaction
// does not overwrite lastResolution; the caller already set the correct
// resolution for the interaction that triggered this deferred action
export function runDeferredPendingAction(state: FaceturnServerState): void {
	const outcome = executePendingAction(state);
	if (outcome && outcome.outcome === "pending") {
		return;
	}
	state.pendingAction = null;
	state.phase = "active_turn";
}

export function makeResult(
	state: FaceturnServerState,
	timerDurationMs: number | null,
	extras: Partial<EngineResult> = {},
): EngineResult {
	markDirty(state);
	return {
		serverPayload: state,
		publicPayload: getCachedPublicState(state),
		timer:
			timerDurationMs !== null
				? { startsAt: Date.now(), duration: timerDurationMs }
				: null,
		...extras,
	};
}

export function afterAction(
	state: FaceturnServerState,
	fallback: { duration?: number; includePrivatePayloads?: boolean } = {},
): EngineResult {
	if (state.phase === "finished") {
		return makeResult(state, null, { roomPhase: "ended" });
	}

	const win = checkWinConditions(state);
	if (win) {
		applyWin(state, win.winnerId, win.winCondition);
		return makeResult(state, null, { roomPhase: "ended" });
	}

	if (tryOpenQueuedDefendableStrike(state)) {
		return makeResult(state, C.DEFEND_WINDOW_MS);
	}

	return makeResult(
		state,
		fallback.duration ?? C.ACTIVE_TURN_DURATION_MS,
		fallback.includePrivatePayloads
			? { privatePayloads: buildPrivatePayloads(state) }
			: {},
	);
}

// opens a defend window for the next queued turned‑effect strike (e.g. Shrike)
function tryOpenQueuedDefendableStrike(state: FaceturnServerState): boolean {
	if (state.pendingAction !== null) return false;
	if (state.pendingInteraction !== null) return false;

	let next = state.pendingDefendableStrikes.shift();
	while (next) {
		const actor = state.players.get(next.actorId);
		const target = state.players.get(next.targetPlayerId);
		const actorValid = actor && !state.eliminatedPlayers.has(next.actorId);
		const targetValid =
			target && !state.eliminatedPlayers.has(next.targetPlayerId);

		if (actorValid && targetValid) {
			state.pendingAction = {
				type: "card_strike",
				actorId: next.actorId,
				targetCrewSlot: next.targetCrewSlot,
				targetAllySlot: null,
				moveId: null,
				cashCost: 0,
				declaredClass: null,
				actorWasBluffing: false,
				targetPlayerId: next.targetPlayerId,
				originalActionType: null,
			};
			state.phase = "defend_window";
			return true;
		}

		// actor or target no longer valid (e.g. eliminated meanwhile); drop and try the next queued strike
		next = state.pendingDefendableStrikes.shift();
	}

	return false;
}

// finalizes a challenge after optional bonus offers (too big, bear bones)
// have resolved. the original resolveChallenge already set lastResolution,
// this helper clears pendingAction and returns to active_turn
export function finalizeResolvedChallenge(
	state: FaceturnServerState,
	actorId: string | null,
): EngineResult {
	// fallback in case the original resolveChallenge call didn't set one
	state.lastResolution = state.lastResolution ?? {
		type: "challenge_success",
		challengerId: null,
		actorId: actorId ?? "",
		crewTurnedPlayerId: actorId,
		crewTurnedSlot: null,
		executedPlayerId: null,
	};
	state.pendingAction = null;
	state.phase = "active_turn";
	return afterAction(state);
}

export function applyRpsWinner(state: FaceturnServerState): EngineResult {
	const winnerId =
		state.rpsResult === "player1" ? state.playerOrder[0] : state.playerOrder[1];

	if (state.mode === "teams") {
		// winner always goes first per standard rules
		setTurnOrderAfterRps(state, winnerId, true);
	} else {
		const loserId = state.playerOrder.find((id) => id !== winnerId)!;
		state.turnOrder = [winnerId, loserId];
	}

	for (const p of state.players.values()) dealOpeningHand(p);
	state.phase = "mulligan";
	return makeResult(state, C.MULLIGAN_DURATION_MS, {
		privatePayloads: buildPrivatePayloads(state),
	});
}

export const faceturnsEngine: GameEngine &
	GameEngineWithSecrets &
	GameEngineWithCpuSeats = {
	gameId: "face-turn",
	actionSchema: FaceturnsActionSchema,
	configActionSchema: FaceturnsConfigActionSchema,
	applyConfigAction,
	buildGameConfig,
	supportsCpuSeats: true,
	getMaxSeats,
	validateStart,
	onPlayerRemoved,

	getInitialState(rng: () => number = Math.random): FaceturnServerState {
		return {
			phase: "drafting",
			players: new Map(),
			mode: "duel",
			// defaults to Math.random for the real server (GameEngine's
			// interface calls this with zero args), but accepts an explicit
			// seeded rng for reproducible simulation runs — see
			// scripts/faceturn-sim/engine-harness.ts's startGame, which is the
			// intended caller for the seeded path. Resolves the
			// TODO(cpu-integration) this plan originally left open: sim tooling
			// already threads a seeded rng into CPU decision-making
			// (decideAction's rng param) but had no way to also seed the
			// engine's own internal randomness (shuffles, RPS ties) until this
			// parameter existed.
			rng,
			teams: [],
			turnOrder: [],
			playerOrder: ["", ""],
			eliminatedPlayers: new Set(),
			turnNumber: 0,
			roundNumber: 0,
			activePlayerId: null,
			pendingAction: null,
			challengeEligiblePlayerIds: [],
			moveChain: null,
			pendingInteraction: null,
			pendingDefendableStrikes: [],
			lastResolution: null,
			watcherReveal: null,
			rpsChoices: new Map(),
			rpsResult: null,
			winnerId: null,
			winCondition: null,
			executionAttempts: 0,
			executionsSurvivedViaLifeInsurance: 0,
			_publicStateCacheValid: false,
			_cachedPublicState: null,
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const state = ctx.room.gamePayload as FaceturnServerState;
		const roomPlayers = [...ctx.room.players.values()];

		const config: GameConfig = (ctx.room.gameConfig as GameConfig | null) ?? {
			mode: "duel",
		};
		state.mode = config.mode;

		const { min, max } = getFaceturnSeatBounds(config.mode);
		if (roomPlayers.length < min || roomPlayers.length > max) {
			throw new Error(
				`[face-turn] ${config.mode} requires ${String(min)}–${String(max)} players.`,
			);
		}

		const playerIds = roomPlayers.map((p) => p.playerId);
		const { teams, turnOrder, playerOrder, teamIndexByPlayerId } =
			buildTeamsAndTurnOrder(config, playerIds, state.rng);

		state.teams = teams;
		state.turnOrder = turnOrder;
		state.playerOrder = playerOrder;

		for (const rp of roomPlayers) {
			const teamIndex = teamIndexByPlayerId.get(rp.playerId) ?? 0;
			state.players.set(rp.playerId, makeServerPlayer(rp.playerId, teamIndex));
		}

		state.phase = "drafting";
		return makeResult(state, C.DRAFTING_DURATION_MS, {
			privatePayloads: buildPrivatePayloads(state),
		});
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		return dispatchAction(ctx, playerId, raw);
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const state = ctx.room.gamePayload as FaceturnServerState;

		// pending interaction must be handled regardless of current phase,
		// otherwise a timeout during e.g. challenge_window while a
		// choose_crew_to_turn interaction is open would run the wrong branch
		// and re-execute the original action.
		if (state.pendingInteraction !== null) {
			const interaction = state.pendingInteraction;
			const spec = getInteractionSpec(interaction);
			state.pendingInteraction = null;

			const outcome = spec.applyTimeoutDefault?.(state, interaction);

			if (outcome?.kind === "custom") return outcome.result;
			return afterAction(state);
		}

		switch (state.phase) {
			case "drafting": {
				for (const player of state.players.values()) {
					if (!player.isDraftLocked)
						autoFillAndFinalizeDraft(player, state.rng);
				}
				if (state.mode === "ffa") {
					for (const p of state.players.values()) dealOpeningHand(p);
					state.phase = "mulligan";
					return makeResult(state, C.MULLIGAN_DURATION_MS, {
						privatePayloads: buildPrivatePayloads(state),
					});
				} else {
					state.phase = "rps";
					state.rpsChoices = new Map();
					state.rpsResult = null;
					return makeResult(state, C.RPS_DURATION_MS, {
						privatePayloads: buildPrivatePayloads(state),
					});
				}
			}

			case "rps": {
				if (state.mode === "ffa") {
					for (const p of state.players.values()) dealOpeningHand(p);
					state.phase = "mulligan";
					return makeResult(state, C.MULLIGAN_DURATION_MS, {
						privatePayloads: buildPrivatePayloads(state),
					});
				}

				const choices = ["rock", "paper", "scissors"] as const;
				for (const pId of state.playerOrder) {
					if (!state.rpsChoices.has(pId)) {
						state.rpsChoices.set(
							pId,
							choices[Math.floor(state.rng() * 3)]!,
						);
					}
				}
				const [p1Id, p2Id] = state.playerOrder;
				state.rpsResult = resolveRps(p1Id, p2Id, state.rpsChoices, state.rng);
				return applyRpsWinner(state);
			}

			case "mulligan": {
				state.phase = "active_turn";
				startTurn(state, state.turnOrder[0]!);
				return makeResult(state, C.ACTIVE_TURN_DURATION_MS);
			}

			case "active_turn": {
				swapTurn(state);
				return afterAction(state);
			}

			case "move_chain_window": {
				if (state.moveChain) {
					resolveMoveChainFull(state);
					state.moveChain = null;
				}
				state.phase = "active_turn";
				return afterAction(state);
			}

			case "challenge_window": {
				state.challengeEligiblePlayerIds = [];
				recordBluffIfUnchallenged(state);
				const timedOutPending = state.pendingAction!;
				const outcome = executePendingAction(state);
				if (outcome && outcome.outcome !== "pending") {
					state.lastResolution = buildStrikeResolution(
						outcome,
						timedOutPending.actorId,
						timedOutPending.targetPlayerId ?? "",
						"strike",
					);
				} else {
					state.lastResolution = {
						type: "action_resolved",
						challengerId: null,
						actorId: timedOutPending.actorId,
						crewTurnedPlayerId: null,
						crewTurnedSlot: null,
						executedPlayerId: null,
					};
				}
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			case "defend_window": {
				const pending = state.pendingAction!;
				if (pending.type === "card_strike") {
					const outcome = performStrike({
						state,
						actor: state.players.get(pending.actorId)!,
						targetPlayerId: pending.targetPlayerId ?? undefined,
						targetCrewSlot: pending.targetCrewSlot ?? undefined,
					});
					if (outcome && outcome.outcome !== "pending") {
						state.lastResolution = buildStrikeResolution(
							outcome,
							pending.actorId,
							pending.targetPlayerId ?? "",
							"strike",
						);
					}
				}
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			case "defend_declared": {
				state.lastResolution = {
					type: "action_resolved",
					challengerId: state.pendingAction!.actorId,
					actorId: state.pendingAction!.targetPlayerId ?? "",
					crewTurnedPlayerId: null,
					crewTurnedSlot: null,
					executedPlayerId: null,
				};
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			default:
				return makeResult(state, null);
		}
	},

	isCpuSeat(ctx: GameContext, playerId: string): boolean {
		return ctx.room.players.get(playerId)?.isCpu ?? false;
	},

	getCpuSeatToAct(ctx: GameContext): string | null {
		const state = ctx.room.gamePayload as FaceturnServerState;
		const helpers: EngineHelpers = {
			getMoveCost,
			getClassActionCost,
			computeActorWasBluffing,
		};

		for (const [playerId, player] of ctx.room.players) {
			if (!player.isCpu) continue;
			if (!state.players.has(playerId)) continue;
			if (state.eliminatedPlayers.has(playerId)) continue;
			if (getLegalActions(state, playerId, helpers).length > 0) {
				return playerId;
			}
		}
		return null;
	},

	async actForCpuSeat(
		ctx: GameContext,
		playerId: string,
	): Promise<EngineResult> {
		const state = ctx.room.gamePayload as FaceturnServerState;
		const action = await getCpuSearchPool().decide(state, playerId);
		if (!action) {
			return makeResult(state, ctx.room.timer?.duration ?? null);
		}

		return faceturnsEngine.onAction(ctx, playerId, action);
	},

	getPlayerSecret(ctx: GameContext, playerId: string): FaceturnsSecret | null {
		const state = ctx.room.gamePayload as FaceturnServerState;
		const player = state.players.get(playerId);
		if (!player) return null;
		return buildSecretForPlayer(state, player);
	},
};