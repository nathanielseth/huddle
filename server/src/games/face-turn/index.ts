import type {
	GameEngine,
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type { FaceturnsSecret } from "../../../../shared/games/face-turn";
import type {
	FaceturnServerState,
	FaceturnServerPlayer,
	ServerPendingAction,
	GameConfig,
} from "./types";
import { FACETURN_CONSTANTS as C } from "./types";
import { FaceturnsActionSchema } from "./schemas";
import type { FaceturnsAction } from "./schemas";
import {
	makeServerPlayer,
	buildTeamsAndTurnOrder,
	setTurnOrderAfterRps,
	isDraftValid,
	finalizeDraft,
	autoFillAndFinalizeDraft,
	dealOpeningHand,
	mulliganPlayer,
	resolveRps,
	startTurn,
	swapTurn,
	checkWinConditions,
	applyWin,
	resolveChallenge,
	recordBluffIfUnchallenged,
	executePendingAction,
	executeMove,
	getMoveCost,
	getClassActionCost,
	computeActorWasBluffing,
	computeChallengeEligible,
	markDirty,
	openMoveChain,
	pushToMoveChain,
	recordChainPass,
	resolveMoveChainFull,
	BOSS_MAP,
	CREW_MAP,
	MOVE_MAP,
	getBoss,
} from "./game";
import {
	resolveEffects,
	triggerCrewTurnedEffects,
	recomputePassives,
	getEnemies,
	getTeammates,
	firstTurnedSlot,
	turnCrewAtSlot,
	applyBloodMoneyOnStrike,
	resolveTruthSerumReveal,
	resolveVoidLegsChoice,
	resolveChooseDiscardCount,
	resolveChooseFromDiscard,
	resolveDigDeepPick,
	resolveSwitchUpPick,
	resolveTacticalSupportUnturn,
	resolveHandlesUnturnOffer,
	resolveTagOutPick,
	resolveTooBigUnturnOffer,
	resolveBearBonesBonusStrike,
	resolveBackgroundCheckGuess,
	resolveLighthouseDisablePick,
	applyPoisonToVictim,
	performStrike,
} from "./effects";
import { getCachedPublicState, buildPrivatePayloads } from "./state-builders";

import {
	getCrew,
	getMove,
	CARD_IDS,
	getMoveTargetScope,
	unwrapEffect,
} from "./cards";

function makeResult(
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

function afterAction(
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

	return makeResult(
		state,
		fallback.duration ?? C.ACTIVE_TURN_DURATION_MS,
		fallback.includePrivatePayloads
			? { privatePayloads: buildPrivatePayloads(state) }
			: {},
	);
}

/**
 * Helper that finalises a challenge after optional bonus offers (Too Big,
 * Bear Bones) have resolved. Used by the live-action branches for
 * too_big_unturn_offer and bear_bones_bonus_strike, which run after a
 * challenge has already succeeded. The original challenge resolution
 * already set lastResolution; this helper just clears pendingAction and
 * returns to active_turn.
 */
function finalizeResolvedChallenge(
	state: FaceturnServerState,
	actorId: string | null,
): EngineResult {
	// lastResolution is already set by the original resolveChallenge call
	state.lastResolution = state.lastResolution ?? {
		type: "challenge_success",
		challengerId: null,
		actorId: actorId ?? "",
		crewTurnedPlayerId: actorId,
		crewTurnedSlot: null,
	};
	state.pendingAction = null;
	state.phase = "active_turn";
	return afterAction(state);
}

// claim-the-bounty becomes free after a successful bluff call, matching the
// bounty design intent. card-id special-case rather than an effect scan,
// since this is the only move with this behavior.
function effectiveCost(player: FaceturnServerPlayer, moveId: string): number {
	const base = getMoveCost(player, moveId);
	if (
		moveId === CARD_IDS.MOVE.CLAIM_THE_BOUNTY &&
		player.hasCalledBluffSuccessfully
	) {
		return 0;
	}
	return base;
}

function applyRpsWinner(state: FaceturnServerState): EngineResult {
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

export const faceturnsEngine: GameEngine & GameEngineWithSecrets = {
	gameId: "face-turn",

	actionSchema: FaceturnsActionSchema,

	getInitialState(): FaceturnServerState {
		return {
			phase: "drafting",
			players: new Map(),
			mode: "duel",
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
			lastResolution: null,
			watcherReveal: null,
			rpsChoices: new Map(),
			rpsResult: null,
			winnerId: null,
			winCondition: null,
			_publicStateCacheValid: false,
			_cachedPublicState: null,
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const state = ctx.room.gamePayload as FaceturnServerState;
		const roomPlayers = [...ctx.room.players.values()];

		if (
			roomPlayers.length < C.MIN_PLAYERS ||
			roomPlayers.length > C.MAX_PLAYERS
		) {
			throw new Error(
				`[face-turn] requires ${C.MIN_PLAYERS}–${C.MAX_PLAYERS} players.`,
			);
		}

		const config: GameConfig = (ctx.room as { config?: GameConfig }).config ?? {
			mode: "duel",
		};
		state.mode = config.mode;

		const playerIds = roomPlayers.map((p) => p.playerId);
		const { teams, turnOrder, playerOrder, teamIndexByPlayerId } =
			buildTeamsAndTurnOrder(config, playerIds);

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
		const state = ctx.room.gamePayload as FaceturnServerState;
		const action = raw as FaceturnsAction;

		const player = state.players.get(playerId);
		if (!player) return makeResult(state, ctx.room.timer?.duration ?? null);

		if (
			state.eliminatedPlayers.has(playerId) &&
			state.phase !== "drafting" &&
			state.phase !== "mulligan" &&
			state.phase !== "rps"
		) {
			return makeResult(state, ctx.room.timer?.duration ?? null);
		}

		const noOp = () => makeResult(state, ctx.room.timer?.duration ?? null);

		// drafting

		if (state.phase === "drafting") {
			const draft = player.draftSelections;
			if (!draft || player.isDraftLocked) return noOp();

			switch (action.type) {
				case "select_boss": {
					if (!BOSS_MAP.has(action.bossId)) return noOp();
					draft.bossId = action.bossId;
					break;
				}
				case "select_crew": {
					if (
						!CREW_MAP.has(action.crewId) ||
						draft.crewIds.includes(action.crewId)
					)
						return noOp();
					if (draft.crewIds.length >= C.CREW_SLOTS) return noOp();
					draft.crewIds.push(action.crewId);
					break;
				}
				case "deselect_crew": {
					draft.crewIds = draft.crewIds.filter((id) => id !== action.crewId);
					break;
				}
				case "select_move": {
					if (
						!MOVE_MAP.has(action.moveId) ||
						draft.moveIds.includes(action.moveId)
					)
						return noOp();
					if (draft.moveIds.length >= C.MOVES_PER_DECK) return noOp();
					draft.moveIds.push(action.moveId);
					break;
				}
				case "deselect_move": {
					draft.moveIds = draft.moveIds.filter((id) => id !== action.moveId);
					break;
				}
				case "lock_draft": {
					if (!isDraftValid(player)) return noOp();
					finalizeDraft(player);
					player.isDraftLocked = true;

					if ([...state.players.values()].every((p) => p.isDraftLocked)) {
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
					break;
				}
				default:
					return noOp();
			}

			return makeResult(state, ctx.room.timer?.duration ?? null, {
				privatePayloads: buildPrivatePayloads(state),
			});
		}

		// rps

		if (state.phase === "rps") {
			if (state.mode === "ffa") return noOp();
			const [rep1, rep2] = state.playerOrder;
			if (playerId !== rep1 && playerId !== rep2) return noOp();

			if (action.type === "rps_choice") {
				state.rpsChoices.set(playerId, action.choice);

				if (state.rpsChoices.size === 2) {
					const [p1Id, p2Id] = state.playerOrder;
					state.rpsResult = resolveRps(p1Id, p2Id, state.rpsChoices);
					return applyRpsWinner(state);
				}

				return makeResult(state, C.RPS_DURATION_MS);
			}

			return noOp();
		}

		// mulligan

		if (state.phase === "mulligan") {
			if (action.type !== "mulligan") return noOp();
			mulliganPlayer(player, action.redraw);
			(
				player as FaceturnServerPlayer & { mulliganDecided?: boolean }
			).mulliganDecided = true;

			const allDecided = [...state.players.values()].every(
				(p) =>
					(p as FaceturnServerPlayer & { mulliganDecided?: boolean })
						.mulliganDecided,
			);

			if (allDecided) {
				state.phase = "active_turn";
				startTurn(state, state.turnOrder[0]!);
				return makeResult(state, C.ACTIVE_TURN_DURATION_MS, {
					privatePayloads: buildPrivatePayloads(state),
				});
			}

			return makeResult(state, ctx.room.timer?.duration ?? null, {
				privatePayloads: buildPrivatePayloads(state),
			});
		}

		// pending interaction (interrupts normal flow for targeted choices)

		if (state.pendingInteraction !== null) {
			const interaction = state.pendingInteraction;
			const interactionResponder =
				interaction.type === "choose_crew_to_turn"
					? interaction.chooserPlayerId
					: interaction.type === "truth_serum_reveal"
						? interaction.targetPlayerId
						: interaction.actorId;
			if (playerId !== interactionResponder) return noOp();

			if (interaction.type === "peek_discard") {
				if (action.type !== "resolve_peek_discard") return noOp();
				const chosen = action.discardMoveId;
				if (
					chosen !== interaction.revealedCards[0] &&
					chosen !== interaction.revealedCards[1]
				)
					return noOp();

				const enemies = getEnemies(state, playerId);
				for (const enemy of enemies) {
					const idx = enemy.hand.indexOf(chosen);
					if (idx !== -1) {
						enemy.hand.splice(idx, 1);
						enemy.discardPile.push(chosen);
						enemy.totalCardsDiscarded++;
						break;
					}
				}

				state.pendingInteraction = null;
				return makeResult(state, ctx.room.timer?.duration ?? null, {
					privatePayloads: buildPrivatePayloads(state),
				});
			}

			if (interaction.type === "crew_reactivate") {
				if (action.type !== "resolve_crew_reactivate") return noOp();
				const slot = action.crewSlot as 0 | 1;
				if (!interaction.eligibleSlots.includes(slot)) return noOp();
				if (!player.crewIds[slot] || !player.crewTurned[slot]) return noOp();
				triggerCrewTurnedEffects(state, player, slot);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "poison_target_pick") {
				if (action.type !== "resolve_poison_target") return noOp();
				const isValidTarget = interaction.eligibleTargetIds.includes(
					action.targetPlayerId,
				);
				if (!isValidTarget) return noOp();
				applyPoisonToVictim(
					state,
					player,
					action.targetPlayerId,
					interaction.damagePerRound,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "choose_crew_to_turn") {
				if (action.type !== "resolve_choose_crew_to_turn") return noOp();
				const target = state.players.get(interaction.targetPlayerId);
				if (!target) return noOp();
				const slot = action.crewSlot as 0 | 1;
				if (!interaction.eligibleSlots.includes(slot)) return noOp();
				if (!target.crewIds[slot] || target.crewTurned[slot]) return noOp();

				turnCrewAtSlot(target, slot);
				recomputePassives(target, state);
				triggerCrewTurnedEffects(state, target, slot);

				if (interaction.isStrike) {
					const striker = state.players.get(interaction.actorId);
					if (striker) applyBloodMoneyOnStrike(state, striker);
				}

				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "truth_serum_reveal") {
				if (action.type !== "resolve_truth_serum_reveal") return noOp();
				const target = state.players.get(interaction.targetPlayerId);
				if (!target) return noOp();

				const result = resolveTruthSerumReveal(
					state,
					target,
					action.crewSlot,
					interaction.eligibleSlots,
				);
				if (result) {
					state.lastResolution = {
						type: "crew_class_revealed",
						actorId: interaction.actorId,
						targetPlayerId: interaction.targetPlayerId,
						revealedSlot: result.revealedSlot,
						revealedClass: result.revealedClass,
					};
				}

				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "lighthouse_disable_pick") {
				if (action.type !== "resolve_lighthouse_disable_pick") return noOp();

				const isEligible = interaction.eligibleTargets.some(
					(t) =>
						t.playerId === action.targetPlayerId && t.slot === action.crewSlot,
				);
				if (!isEligible) return noOp();

				resolveLighthouseDisablePick(
					state,
					action.targetPlayerId,
					action.crewSlot,
					interaction.eligibleTargets,
				);

				state.pendingInteraction = null;
				return afterAction(state);
			}

			// --- new live-resolution branches ---

			if (interaction.type === "background_check_guess") {
				if (action.type !== "resolve_background_check_guess") return noOp();
				const target = state.players.get(interaction.targetPlayerId);
				if (!target) return noOp();

				resolveBackgroundCheckGuess(
					state,
					player, // the challenger (responder == actorId == player here)
					target,
					action.targetCrewSlot,
					action.guessClass,
					interaction.eligibleSlots,
				);

				state.pendingInteraction = null;

				// Now actually resolve the challenge that was waiting on this guess.
				const { actionProceeds, resolution } = resolveChallenge(
					state,
					interaction.actorId,
				);
				state.lastResolution = resolution;
				if (actionProceeds) executePendingAction(state);
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			if (interaction.type === "too_big_unturn_offer") {
				if (action.type !== "resolve_too_big_unturn_offer") return noOp();
				const defeatedPlayerId = state.pendingAction?.actorId ?? null;
				state.pendingInteraction = null;
				if (defeatedPlayerId) {
					resolveTooBigUnturnOffer(
						state,
						player,
						action.confirmed,
						defeatedPlayerId,
					);
				}
				// If resolveTooBigUnturnOffer opened bear_bones_bonus_strike,
				// state.pendingInteraction is non-null again here,
				// do NOT finalize the challenge yet in that case;
				// wait for that interaction's own resolution branch
				if (state.pendingInteraction !== null) {
					return makeResult(state, ctx.room.timer?.duration ?? null, {
						privatePayloads: buildPrivatePayloads(state),
					});
				}
				return finalizeResolvedChallenge(state, defeatedPlayerId);
			}

			if (interaction.type === "bear_bones_bonus_strike") {
				if (action.type !== "resolve_bear_bones_bonus_strike") return noOp();
				const defeatedPlayerId = state.pendingAction?.actorId ?? null;
				state.pendingInteraction = null;
				resolveBearBonesBonusStrike(
					state,
					player,
					action.confirmed,
					action.targetPlayerId ?? interaction.eligibleTargetIds[0] ?? null,
					action.targetCrewSlot ?? null,
				);
				return finalizeResolvedChallenge(state, defeatedPlayerId);
			}

			if (interaction.type === "void_legs_choice") {
				if (action.type !== "resolve_void_legs_choice") return noOp();
				resolveVoidLegsChoice(
					state,
					player,
					action.confirmed,
					player.voidLegsDamage,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "choose_discard_count") {
				if (action.type !== "resolve_choose_discard_count") return noOp();
				resolveChooseDiscardCount(
					state,
					player,
					action.count,
					interaction.maxCount,
					interaction.targetPlayerId,
					interaction.damagePerCard,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "choose_from_discard") {
				if (action.type !== "resolve_choose_from_discard") return noOp();
				resolveChooseFromDiscard(
					player,
					action.cardId,
					interaction.discardPileSnapshot,
				);
				state.pendingInteraction = null;
				return makeResult(state, ctx.room.timer?.duration ?? null, {
					privatePayloads: buildPrivatePayloads(state),
				});
			}

			if (interaction.type === "dig_deep_pick") {
				if (action.type !== "resolve_dig_deep_pick") return noOp();
				const lookCount = interaction.revealedCards.length;
				resolveDigDeepPick(player, action.cardId, lookCount);
				state.pendingInteraction = null;
				return makeResult(state, ctx.room.timer?.duration ?? null, {
					privatePayloads: buildPrivatePayloads(state),
				});
			}

			if (interaction.type === "switch_up_pick") {
				if (action.type !== "resolve_switch_up_pick") return noOp();
				resolveSwitchUpPick(
					state,
					player,
					action.unturnSlot,
					action.turnSlot,
					interaction.faceUpSlots,
					interaction.faceDownSlots,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "tactical_support_unturn_offer") {
				if (action.type !== "resolve_tactical_support_unturn_offer")
					return noOp();
				const target = state.players.get(interaction.targetPlayerId);
				if (!target) return noOp();
				resolveTacticalSupportUnturn(
					state,
					target,
					action.slot ?? null,
					interaction.eligibleSlots,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			if (interaction.type === "tag_out_pick") {
				if (action.type !== "resolve_tag_out_pick") return noOp();
				const teammate = state.players.get(interaction.teammateId);
				if (!teammate) return noOp();
				resolveTagOutPick(
					state,
					player,
					teammate,
					action.ownSlot,
					action.teammateSlot,
					interaction.ownEligibleSlots,
					interaction.teammateEligibleSlots,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			// watcher_unturn_offer live-resolution branch
			if (interaction.type === "watcher_unturn_offer") {
				if (action.type !== "resolve_watcher_unturn_offer") return noOp();
				resolveTacticalSupportUnturn(
					state,
					player,
					action.slot ?? null,
					interaction.eligibleSlots,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			// handles_unturn_offer live-resolution branch
			if (interaction.type === "handles_unturn_offer") {
				if (action.type !== "resolve_handles_unturn_offer") return noOp();
				resolveHandlesUnturnOffer(
					state,
					player,
					action.slot ?? null,
					interaction.eligibleSlots,
				);
				state.pendingInteraction = null;
				return afterAction(state);
			}

			return noOp();
		}

		// active turn

		if (state.phase === "active_turn") {
			if (playerId !== state.activePlayerId) return noOp();

			switch (action.type) {
				case "play_move": {
					const { moveId } = action;
					if (!player.hand.includes(moveId)) return noOp();

					const move = getMove(moveId);
					const cost = effectiveCost(player, moveId);
					if (player.cash < cost) return noOp();

					// active moves require a free slot on the board
					if (
						move.moveType === "active" &&
						player.activeMoves.findIndex((s) => s === null) === -1
					) {
						return noOp();
					}

					if (action.targetPlayerId) {
						const scope = getMoveTargetScope(move);
						if (scope === "enemy") {
							const targetIsEnemy = getEnemies(state, playerId).some(
								(e) => e.playerId === action.targetPlayerId,
							);
							if (!targetIsEnemy) return noOp();
						} else if (scope === "ally") {
							const isValidAlly =
								action.targetPlayerId === playerId ||
								getTeammates(state, playerId).some(
									(t) => t.playerId === action.targetPlayerId,
								);
							if (!isValidAlly) return noOp();
						} else {
							// scope === "none" — this move has no legitimate use for a
							// targetPlayerId at all; reject rather than silently ignore.
							return noOp();
						}
					}

					// NEW: detect a blockable-strike burst move (Ambush) before the
					// normal burst/active/slow branching below. Ambush pays cost and
					// discards immediately like any burst, but instead of resolving
					// now it opens block_window so the target gets a chance to block.
					const isBlockableStrike = move.effects.some((e) => {
						const eff = unwrapEffect(e);
						return eff.type === "strike_enemy_crew_blockable";
					});

					if (isBlockableStrike) {
						if (!action.targetPlayerId) return noOp(); // Ambush requires a declared target
						const targetIsEnemy = getEnemies(state, playerId).some(
							(e) => e.playerId === action.targetPlayerId,
						);
						if (!targetIsEnemy) return noOp();

						// Pre-validate targetCrewSlot (if supplied) before paying cost
						// and discarding — previously an invalid slot would still
						// consume cost/card and open a full block window for a strike
						// that was always going to fizzle in performStrike. Cheap to
						// reject up front instead.
						if (action.targetCrewSlot !== undefined) {
							const ambushTarget = state.players.get(action.targetPlayerId)!;
							const slot = action.targetCrewSlot as 0 | 1;
							if (
								!ambushTarget.crewIds[slot] ||
								ambushTarget.crewTurned[slot]
							) {
								return noOp();
							}
						}

						player.hand.splice(player.hand.indexOf(moveId), 1);
						player.cash -= cost;
						player.discardPile.push(moveId);
						player.totalCardsDiscarded++;
						player.totalMovesPlayed++;
						player.playedMoveThisTurn = true;

						state.pendingAction = {
							type: "card_strike",
							actorId: playerId,
							targetCrewSlot: action.targetCrewSlot ?? null,
							targetAllySlot: null,
							moveId,
							cashCost: cost,
							declaredClass: null,
							actorWasBluffing: false,
							targetPlayerId: action.targetPlayerId,
							originalActionType: null,
						};

						state.phase = "block_window";
						return makeResult(state, C.BLOCK_WINDOW_MS);
					}

					player.hand.splice(player.hand.indexOf(moveId), 1);
					player.cash -= cost;

					if (move.moveType === "slow") {
						// slow moves open a chain; responder is the explicit target or,
						// as a defensive fallback, the first living enemy (should not
						// trigger in practice because all slow moves have a target)
						const responderId =
							action.targetPlayerId ?? getEnemies(state, playerId)[0]?.playerId;
						if (!responderId) {
							executeMove(state, player, moveId, {
								targetCrewSlot: action.targetCrewSlot,
								targetAllySlot: action.targetAllySlot,
								targetPlayerId: action.targetPlayerId,
							});
							return afterAction(state);
						}
						openMoveChain(state, playerId, responderId, {
							moveId,
							actorId: playerId,
							targetCrewSlot: action.targetCrewSlot ?? null,
							targetAllySlot: action.targetAllySlot ?? null,
							targetPlayerId: action.targetPlayerId ?? null,
						});
						return makeResult(state, C.MOVE_CHAIN_WINDOW_MS);
					}

					// burst or active resolve immediately
					executeMove(state, player, moveId, {
						targetCrewSlot: action.targetCrewSlot,
						targetAllySlot: action.targetAllySlot,
						targetPlayerId: action.targetPlayerId,
					});
					return afterAction(state);
				}

				case "declare_class_action": {
					if ((action.action as string) === "block") return noOp();
					if (player.classActionUsedThisTurn) return noOp();

					if (action.action === "strike") {
						if (!action.targetPlayerId) return noOp();
						const targetIsEnemy = getEnemies(state, playerId).some(
							(e) => e.playerId === action.targetPlayerId,
						);
						if (!targetIsEnemy) return noOp();
					}

					if (action.action === "unturn") {
						if (action.targetAllySlot !== undefined) {
							const slot = action.targetAllySlot as 0 | 1;
							if (!player.crewIds[slot] || !player.crewTurned[slot])
								return noOp();
						} else {
							if (firstTurnedSlot(player) === null) return noOp();
						}
					}

					const cost = getClassActionCost(player, action.action);
					if (player.cash < cost) return noOp();

					player.cash -= cost;
					player.classActionUsedThisTurn = true;

					const targetPlayerId =
						action.action === "strike" ? (action.targetPlayerId ?? null) : null;

					const actorWasBluffing = computeActorWasBluffing(
						player,
						action.action,
					);

					// Prank Call: first successful bluff each round grants cash.
					if (
						actorWasBluffing &&
						player.hasPrankCall &&
						!player.prankCallBonusUsedThisRound
					) {
						player.cash += player.prankCallBonusAmount;
						player.prankCallBonusUsedThisRound = true;
					}

					state.pendingAction = {
						type: `class_action_${action.action}` as ServerPendingAction["type"],
						actorId: playerId,
						targetCrewSlot: action.targetCrewSlot ?? null,
						targetAllySlot: action.targetAllySlot ?? null,
						moveId: null,
						cashCost: cost,
						declaredClass: action.action,
						actorWasBluffing,
						targetPlayerId,
						originalActionType: null,
					};

					state.challengeEligiblePlayerIds = computeChallengeEligible(
						state,
						playerId,
						targetPlayerId,
					);

					state.phase = "challenge_window";
					return makeResult(state, C.CHALLENGE_WINDOW_MS);
				}

				case "use_boss_command": {
					if (player.bossCommandUsed) return noOp();

					const boss = getBoss(player.bossId);

					if (boss.id === "the-razor") {
						if (!action.guessClass || action.targetCrewSlot === undefined)
							return noOp();
						const targetPlayer = action.targetPlayerId
							? state.players.get(action.targetPlayerId)
							: getEnemies(state, playerId)[0];
						if (!targetPlayer) return noOp();

						const slot = action.targetCrewSlot as 0 | 1;
						const targetId = targetPlayer.crewIds[slot];
						if (!targetId || targetPlayer.crewTurned[slot]) return noOp();

						player.bossCommandUsed = true;

						const crew = getCrew(targetId);
						const overrides = targetPlayer.crewClassOverrides.get(slot);
						const matches =
							overrides?.has(action.guessClass) ||
							crew.class === action.guessClass;
						if (matches) {
							turnCrewAtSlot(targetPlayer, slot);
							recomputePassives(targetPlayer, state);
							triggerCrewTurnedEffects(state, targetPlayer, slot);
						}

						return afterAction(state);
					}

					if (boss.id === "the-dealer") {
						const reserveCrewId = action.reserveCrewId;
						if (!reserveCrewId || !CREW_MAP.has(reserveCrewId)) return noOp();
						const handIdx = player.hand.indexOf(reserveCrewId);
						if (handIdx === -1) return noOp();

						const foundSlot =
							action.targetAllySlot !== undefined
								? (action.targetAllySlot as 0 | 1)
								: (([0, 1] as const).find(
										(i) => player.crewIds[i] !== null && player.crewTurned[i],
									) ?? null);

						if (foundSlot === null) return noOp();
						const targetSlot = foundSlot;
						if (!player.crewIds[targetSlot] || !player.crewTurned[targetSlot])
							return noOp();

						player.bossCommandUsed = true;

						const oldCrewId = player.crewIds[targetSlot];
						if (oldCrewId) {
							player.discardPile.push(oldCrewId);
							player.totalCardsDiscarded++;
						}
						player.hand.splice(handIdx, 1);
						player.crewIds[targetSlot] = reserveCrewId;
						player.crewTurned[targetSlot] = false;
						player.crewClassOverrides.delete(targetSlot);
						player.disabledPassiveSlots.delete(targetSlot);
						recomputePassives(player, state);

						return afterAction(state);
					}

					// the-watcher and any other generic-effect boss commands
					if (action.targetPlayerId) {
						const targetIsEnemy = getEnemies(state, playerId).some(
							(e) => e.playerId === action.targetPlayerId,
						);
						if (!targetIsEnemy) return noOp();
					}

					player.bossCommandUsed = true;

					resolveEffects(boss.commandEffects, {
						state,
						actor: player,
						targetCrewSlot: action.targetCrewSlot,
						targetPlayerId: action.targetPlayerId,
					});

					return afterAction(state);
				}

				case "use_boss_skill": {
					const slot = action.targetCrewSlot as 0 | 1;
					if (!player.crewIds[slot]) return noOp();
					if (player.crewTurned[slot]) return noOp();

					const cost = C.BOSS_FACE_TURN_COST;
					if (player.cash < cost) return noOp();

					player.cash -= cost;
					turnCrewAtSlot(player, slot);
					recomputePassives(player, state);
					triggerCrewTurnedEffects(state, player, slot);

					return afterAction(state);
				}

				case "end_turn": {
					swapTurn(state);
					return afterAction(state, { includePrivatePayloads: true });
				}

				case "discard_active_move": {
					const slot = action.slotIndex as 0 | 1 | 2;
					const moveId = player.activeMoves[slot];
					if (!moveId) return noOp();
					player.activeMoves[slot] = null;
					player.discardPile.push(moveId);
					player.totalCardsDiscarded++;
					recomputePassives(player, state);
					return makeResult(state, ctx.room.timer?.duration ?? null);
				}

				default:
					return noOp();
			}
		}

		// move chain window
		// only the two participants may act. burst moves resolve instantly,
		// slow moves stack. the chain resolves lifo once both pass consecutively.

		if (state.phase === "move_chain_window") {
			const chain = state.moveChain;
			if (!chain) return noOp();

			const [p1, p2] = chain.participants;
			if (playerId !== p1 && playerId !== p2) return noOp();

			if (action.type === "chain_play_burst") {
				const { moveId } = action;
				if (!player.hand.includes(moveId)) return noOp();

				const move = getMove(moveId);
				if (move.moveType !== "burst") return noOp();

				const cost = effectiveCost(player, moveId);
				if (player.cash < cost) return noOp();

				if (action.targetPlayerId) {
					const scope = getMoveTargetScope(move);
					if (scope === "enemy") {
						const targetIsEnemy = getEnemies(state, playerId).some(
							(e) => e.playerId === action.targetPlayerId,
						);
						if (!targetIsEnemy) return noOp();
					} else if (scope === "ally") {
						const isValidAlly =
							action.targetPlayerId === playerId ||
							getTeammates(state, playerId).some(
								(t) => t.playerId === action.targetPlayerId,
							);
						if (!isValidAlly) return noOp();
					} else {
						// scope === "none"
						return noOp();
					}
				}

				player.hand.splice(player.hand.indexOf(moveId), 1);
				player.cash -= cost;

				executeMove(state, player, moveId, {
					targetCrewSlot: action.targetCrewSlot,
					targetAllySlot: action.targetAllySlot,
					targetPlayerId: action.targetPlayerId,
				});

				return afterAction(state, {
					duration: C.MOVE_CHAIN_WINDOW_MS,
					includePrivatePayloads: true,
				});
			}

			if (action.type === "chain_play_slow") {
				const { moveId } = action;
				if (!player.hand.includes(moveId)) return noOp();

				const move = getMove(moveId);
				if (move.moveType !== "slow") return noOp();

				const cost = effectiveCost(player, moveId);
				if (player.cash < cost) return noOp();

				if (action.targetPlayerId) {
					const scope = getMoveTargetScope(move);
					if (scope === "enemy") {
						const targetIsEnemy = getEnemies(state, playerId).some(
							(e) => e.playerId === action.targetPlayerId,
						);
						if (!targetIsEnemy) return noOp();
					} else if (scope === "ally") {
						const isValidAlly =
							action.targetPlayerId === playerId ||
							getTeammates(state, playerId).some(
								(t) => t.playerId === action.targetPlayerId,
							);
						if (!isValidAlly) return noOp();
					} else {
						// scope === "none"
						return noOp();
					}
				}

				player.hand.splice(player.hand.indexOf(moveId), 1);
				player.cash -= cost;

				pushToMoveChain(state, {
					moveId,
					actorId: playerId,
					targetCrewSlot: action.targetCrewSlot ?? null,
					targetAllySlot: action.targetAllySlot ?? null,
					targetPlayerId: action.targetPlayerId ?? null,
				});

				return makeResult(state, C.MOVE_CHAIN_WINDOW_MS, {
					privatePayloads: buildPrivatePayloads(state),
				});
			}

			if (action.type === "chain_pass") {
				if (playerId !== chain.responderId) return noOp();

				const shouldResolve = recordChainPass(state, playerId);
				if (shouldResolve) {
					resolveMoveChainFull(state);
					state.moveChain = null;
					state.phase = "active_turn";
					return afterAction(state);
				}
				return makeResult(state, C.MOVE_CHAIN_WINDOW_MS);
			}

			return noOp();
		}

		// challenge window

		if (state.phase === "challenge_window") {
			const pending = state.pendingAction!;

			if (!state.challengeEligiblePlayerIds.includes(playerId)) return noOp();

			if (action.type === "challenge") {
				const actor = state.players.get(pending.actorId)!;

				if (actor.hasBackgroundCheck) {
					const eligibleSlots = ([0, 1] as const).filter(
						(i) => actor.crewIds[i] !== null && !actor.crewTurned[i],
					);
					if (eligibleSlots.length > 0) {
						state.challengeEligiblePlayerIds = [];
						state.pendingInteraction = {
							type: "background_check_guess",
							actorId: playerId,
							targetPlayerId: pending.actorId,
							eligibleSlots,
						};
						return makeResult(state, ctx.room.timer?.duration ?? null, {
							privatePayloads: buildPrivatePayloads(state),
						});
					}
				}

				state.challengeEligiblePlayerIds = [];
				const { actionProceeds, resolution } = resolveChallenge(
					state,
					playerId,
				);
				state.lastResolution = resolution;
				if (actionProceeds) executePendingAction(state);
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			if (action.type === "block" && pending.type === "class_action_strike") {
				if (playerId !== pending.targetPlayerId) return noOp();
				const blocker = state.players.get(playerId)!;
				const blockCost = getClassActionCost(blocker, "block");
				if (blocker.cash < blockCost) return noOp();

				blocker.cash -= blockCost;
				state.challengeEligiblePlayerIds = [];
				state.pendingAction = {
					type: "class_action_block",
					actorId: blocker.playerId,
					targetCrewSlot: pending.targetCrewSlot,
					targetAllySlot: pending.targetAllySlot,
					moveId: null,
					cashCost: blockCost,
					declaredClass: "block",
					actorWasBluffing: computeActorWasBluffing(blocker, "block"),
					targetPlayerId: pending.actorId,
					originalActionType: pending.type,
				};
				state.phase = "block_declared";
				return makeResult(state, C.BLOCK_DECLARED_MS);
			}

			if (action.type === "pass_challenge") {
				state.challengeEligiblePlayerIds =
					state.challengeEligiblePlayerIds.filter((id) => id !== playerId);

				if (state.challengeEligiblePlayerIds.length === 0) {
					recordBluffIfUnchallenged(state);
					executePendingAction(state);
					state.lastResolution = {
						type: "action_resolved",
						challengerId: null,
						actorId: pending.actorId,
						crewTurnedPlayerId: null,
						crewTurnedSlot: null,
					};
					state.pendingAction = null;
					state.phase = "active_turn";
					return afterAction(state);
				}

				return makeResult(state, ctx.room.timer?.duration ?? null);
			}

			return noOp();
		}

		// block window (Ambush and future blockable-burst cards)
		// only the strike's original target may act. block = pay cost, open
		// block_declared for the attacker's accept-only response. no action =
		// timeout = strike resolves unblocked (handled in onTimerExpired).
		// There is intentionally no "decline to block" action here.

		if (state.phase === "block_window") {
			const pending = state.pendingAction!;
			if (playerId !== pending.targetPlayerId) return noOp();

			if (action.type === "block") {
				const blocker = state.players.get(playerId)!;
				const blockCost = getClassActionCost(blocker, "block");
				if (blocker.cash < blockCost) return noOp();

				blocker.cash -= blockCost;
				state.pendingAction = {
					...pending,
					type: "class_action_block",
					actorId: blocker.playerId,
					cashCost: blockCost,
					declaredClass: "block",
					actorWasBluffing: false,
					targetPlayerId: pending.actorId, // flips: attacker becomes the "target" of the block's own response
					originalActionType: pending.type, // "card_strike" — captured before reassignment
				};
				state.phase = "block_declared";
				return makeResult(state, C.BLOCK_DECLARED_MS);
			}

			return noOp();
		}

		// block declared

		if (state.phase === "block_declared") {
			const pending = state.pendingAction!;
			const strikeerId = pending.targetPlayerId!;
			if (playerId !== strikeerId) return noOp();

			if (action.type === "accept_block") {
				state.lastResolution = {
					type: "action_resolved",
					challengerId: pending.actorId,
					actorId: strikeerId,
					crewTurnedPlayerId: null,
					crewTurnedSlot: null,
				};
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			if (action.type === "challenge_block") {
				// A card_strike-originated block (Ambush) has no declared class and
				// nothing to bluff about — there is nothing to challenge. Gate this
				// using originalActionType, NOT pending.declaredClass: by this point
				// pendingAction has already been overwritten to the block's own
				// action object (declaredClass: "block" regardless of origin), so
				// declaredClass can no longer distinguish the two cases.
				if (pending.originalActionType === "card_strike") return noOp();

				const { actionProceeds: blockWasReal, resolution } = resolveChallenge(
					state,
					strikeerId,
				);
				state.lastResolution = resolution;

				if (!blockWasReal) {
					const originalTarget = state.players.get(pending.actorId);
					if (originalTarget) {
						const blocker = state.players.get(strikeerId);
						if (blocker) {
							const unturnedSlots = ([0, 1] as const).filter(
								(i) => blocker.crewIds[i] !== null && !blocker.crewTurned[i],
							);
							if (unturnedSlots.length === 0) {
								const slot = firstTurnedSlot(blocker);
								if (slot !== null) {
									turnCrewAtSlot(blocker, slot);
									recomputePassives(blocker, state);
									triggerCrewTurnedEffects(state, blocker, slot);
								}
							} else if (unturnedSlots.length === 1) {
								const slot = unturnedSlots[0]!;
								turnCrewAtSlot(blocker, slot);
								recomputePassives(blocker, state);
								triggerCrewTurnedEffects(state, blocker, slot);
							} else {
								const chooserPlayerId = blocker.hasVoidArms
									? blocker.playerId
									: strikeerId;
								state.pendingInteraction = {
									type: "choose_crew_to_turn",
									targetPlayerId: blocker.playerId,
									actorId: strikeerId,
									chooserPlayerId,
									eligibleSlots: unturnedSlots,
									isStrike: false,
								};
							}
						}
					}
				}

				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			return noOp();
		}

		return noOp();
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const state = ctx.room.gamePayload as FaceturnServerState;

		switch (state.phase) {
			case "drafting": {
				for (const player of state.players.values()) {
					if (!player.isDraftLocked) autoFillAndFinalizeDraft(player);
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
						state.rpsChoices.set(pId, choices[Math.floor(Math.random() * 3)]!);
					}
				}
				const [p1Id, p2Id] = state.playerOrder;
				state.rpsResult = resolveRps(p1Id, p2Id, state.rpsChoices);
				return applyRpsWinner(state);
			}

			case "mulligan": {
				state.phase = "active_turn";
				startTurn(state, state.turnOrder[0]!);
				return makeResult(state, C.ACTIVE_TURN_DURATION_MS);
			}

			case "active_turn": {
				if (state.pendingInteraction !== null) {
					const interaction = state.pendingInteraction;
					state.pendingInteraction = null;

					if (interaction.type === "peek_discard") {
						const chosen = interaction.revealedCards[0];
						const peekEnemies = getEnemies(state, interaction.actorId);
						for (const enemy of peekEnemies) {
							const idx = enemy.hand.indexOf(chosen);
							if (idx !== -1) {
								enemy.hand.splice(idx, 1);
								enemy.discardPile.push(chosen);
								enemy.totalCardsDiscarded++;
								break;
							}
						}
					} else if (interaction.type === "crew_reactivate") {
						const actor = state.players.get(interaction.actorId)!;
						const slot = interaction.eligibleSlots[0];
						if (slot !== undefined)
							triggerCrewTurnedEffects(state, actor, slot as 0 | 1);
					} else if (interaction.type === "poison_target_pick") {
						const poisonActor = state.players.get(interaction.actorId);
						if (poisonActor) {
							const firstEnemy = getEnemies(state, interaction.actorId)[0];
							if (firstEnemy) {
								applyPoisonToVictim(
									state,
									poisonActor,
									firstEnemy.playerId,
									interaction.damagePerRound,
								);
							}
						}
					} else if (interaction.type === "choose_crew_to_turn") {
						const ccTarget = state.players.get(interaction.targetPlayerId);
						if (ccTarget && interaction.eligibleSlots[0] !== undefined) {
							const ccSlot = interaction.eligibleSlots[0] as 0 | 1;
							turnCrewAtSlot(ccTarget, ccSlot);
							recomputePassives(ccTarget, state);
							triggerCrewTurnedEffects(state, ccTarget, ccSlot);

							if (interaction.isStrike) {
								const striker = state.players.get(interaction.actorId);
								if (striker) applyBloodMoneyOnStrike(state, striker);
							}
						}
					} else if (interaction.type === "truth_serum_reveal") {
						const tsTarget = state.players.get(interaction.targetPlayerId);
						const tsSlot = interaction.eligibleSlots[0];
						if (tsTarget && tsSlot !== undefined) {
							const result = resolveTruthSerumReveal(
								state,
								tsTarget,
								tsSlot,
								interaction.eligibleSlots,
							);
							if (result) {
								state.lastResolution = {
									type: "crew_class_revealed",
									actorId: interaction.actorId,
									targetPlayerId: interaction.targetPlayerId,
									revealedSlot: result.revealedSlot,
									revealedClass: result.revealedClass,
								};
							}
						}
					} else if (interaction.type === "choose_discard_count") {
						const dcActor = state.players.get(interaction.actorId)!;
						resolveChooseDiscardCount(
							state,
							dcActor,
							0,
							interaction.maxCount,
							interaction.targetPlayerId,
							interaction.damagePerCard,
						);
					} else if (interaction.type === "choose_from_discard") {
						// no default action — declining entirely is the safe default
					} else if (interaction.type === "dig_deep_pick") {
						// no default action — same reasoning as choose_from_discard
					} else if (interaction.type === "switch_up_pick") {
						const suActor = state.players.get(interaction.actorId)!;
						const unturnSlot = interaction.faceUpSlots[0];
						const turnSlot = interaction.faceDownSlots[0];
						if (unturnSlot !== undefined && turnSlot !== undefined) {
							resolveSwitchUpPick(
								state,
								suActor,
								unturnSlot,
								turnSlot,
								interaction.faceUpSlots,
								interaction.faceDownSlots,
							);
						}
					} else if (interaction.type === "tactical_support_unturn_offer") {
						const tsActor = state.players.get(interaction.actorId);
						const tsTarget = state.players.get(interaction.targetPlayerId);
						if (tsActor && tsTarget) {
							resolveTacticalSupportUnturn(
								state,
								tsTarget,
								null,
								interaction.eligibleSlots,
							);
						}
					} else if (interaction.type === "tag_out_pick") {
						const toActor = state.players.get(interaction.actorId)!;
						const toTeammate = state.players.get(interaction.teammateId);
						const ownSlot = interaction.ownEligibleSlots[0];
						const teammateSlot = interaction.teammateEligibleSlots[0];
						if (
							toTeammate &&
							ownSlot !== undefined &&
							teammateSlot !== undefined
						) {
							resolveTagOutPick(
								state,
								toActor,
								toTeammate,
								ownSlot,
								teammateSlot,
								interaction.ownEligibleSlots,
								interaction.teammateEligibleSlots,
							);
						}
					} else if (interaction.type === "void_legs_choice") {
						const vlActor = state.players.get(interaction.actorId)!;
						resolveVoidLegsChoice(
							state,
							vlActor,
							false,
							vlActor.voidLegsDamage,
						);
					} else if (interaction.type === "background_check_guess") {
						const bgChallenger = state.players.get(interaction.actorId)!;
						const bgTarget = state.players.get(interaction.targetPlayerId);
						if (bgTarget && interaction.eligibleSlots[0] !== undefined) {
							const CLASSES = [
								"striker",
								"blocker",
								"collector",
								"turner",
							] as const;
							const randomGuess =
								CLASSES[Math.floor(Math.random() * CLASSES.length)]!;
							resolveBackgroundCheckGuess(
								state,
								bgChallenger,
								bgTarget,
								interaction.eligibleSlots[0],
								randomGuess,
								interaction.eligibleSlots,
							);
						}
						const { actionProceeds, resolution } = resolveChallenge(
							state,
							interaction.actorId,
						);
						state.lastResolution = resolution;
						if (actionProceeds) executePendingAction(state);
						state.pendingAction = null;
					} else if (interaction.type === "too_big_unturn_offer") {
						const tbDefeated = state.pendingAction?.actorId ?? null;
						const tbActor = state.players.get(interaction.actorId)!;
						if (tbDefeated) {
							resolveTooBigUnturnOffer(state, tbActor, false, tbDefeated);
						}
						if (state.pendingInteraction === null) {
							state.pendingAction = null;
						}
					} else if (interaction.type === "bear_bones_bonus_strike") {
						const bbActor = state.players.get(interaction.actorId)!;
						resolveBearBonesBonusStrike(state, bbActor, false, null, null);
						state.pendingAction = null;
					} else if (interaction.type === "watcher_unturn_offer") {
						// decline by default — do nothing
					} else if (interaction.type === "handles_unturn_offer") {
						// decline by default — do nothing. Matches Handles' "may"
						// wording: timing out should not force a turn-down.
					} else if (interaction.type === "lighthouse_disable_pick") {
						const first = interaction.eligibleTargets[0];
						if (first) {
							resolveLighthouseDisablePick(
								state,
								first.playerId,
								first.slot,
								interaction.eligibleTargets,
							);
						}
					}

					return afterAction(state);
				}

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
				executePendingAction(state);
				state.lastResolution = {
					type: "action_resolved",
					challengerId: null,
					actorId: state.pendingAction!.actorId,
					crewTurnedPlayerId: null,
					crewTurnedSlot: null,
				};
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			case "block_window": {
				// timed out with no block declared — the strike resolves unblocked
				// against the original target.
				const pending = state.pendingAction!;
				if (pending.type === "card_strike") {
					performStrike({
						state,
						actor: state.players.get(pending.actorId)!,
						targetPlayerId: pending.targetPlayerId ?? undefined,
						targetCrewSlot: pending.targetCrewSlot ?? undefined,
					});
				}
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			case "block_declared": {
				state.lastResolution = {
					type: "action_resolved",
					challengerId: state.pendingAction!.actorId,
					actorId: state.pendingAction!.targetPlayerId ?? "",
					crewTurnedPlayerId: null,
					crewTurnedSlot: null,
				};
				state.pendingAction = null;
				state.phase = "active_turn";
				return afterAction(state);
			}

			default:
				return makeResult(state, null);
		}
	},

	getPlayerSecret(ctx: GameContext, playerId: string): FaceturnsSecret | null {
		const state = ctx.room.gamePayload as FaceturnServerState;
		const player = state.players.get(playerId);
		if (!player) return null;

		const peekRevealedCards: [string, string] | null =
			state.pendingInteraction?.type === "peek_discard" &&
			state.pendingInteraction.actorId === playerId
				? state.pendingInteraction.revealedCards
				: null;

		return {
			hand: [...player.hand],
			crewAssignments: Object.fromEntries(
				player.crewIds
					.map((id, i): [number, string | null] => [i, id])
					.filter((entry): entry is [number, string] => entry[1] !== null),
			),
			costOverrides: Object.fromEntries(player.costOverrides),
			draftSelections: player.draftSelections
				? {
						bossId: player.draftSelections.bossId,
						crewIds: [...player.draftSelections.crewIds],
						moveIds: [...player.draftSelections.moveIds],
					}
				: null,
			peekRevealedCards,
		};
	},
};