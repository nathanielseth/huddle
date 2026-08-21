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
import type { FaceturnServerState, GameConfig } from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import { FaceturnsActionSchema, FaceturnsConfigActionSchema } from "./schemas";
import { getFaceturnSeatBounds } from "../../../../shared/games/face-turn/constants";
import {
	makeServerPlayer,
	buildTeamsAndTurnOrder,
	autoFillAndFinalizeDraft,
	dealOpeningHand,
	resolveRps,
	startTurn,
	swapTurn,
	recordBluffIfUnchallenged,
	executePendingAction,
	getMoveCost,
	getClassActionCost,
	computeActorWasBluffing,
	resolveMoveChainFull,
} from "./game";
import { performStrike } from "./effects";
import { getInteractionSpec } from "./interactions/registry";
import { dispatchAction } from "./actions/index";
import { buildPrivatePayloads, buildSecretForPlayer } from "./state-builders";
import {
	applyConfigAction,
	buildGameConfig,
	getMaxSeats,
	validateStart,
	onPlayerRemoved,
} from "./config";

import {
	buildStrikeResolution,
	makeResult,
	afterAction,
	applyRpsWinner,
} from "./action-results";

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
			// seeded rng for reproducible sims
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

		// interactions must resolve before phase switch or the wrong branch runs
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
						state.rpsChoices.set(pId, choices[Math.floor(state.rng() * 3)]!);
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