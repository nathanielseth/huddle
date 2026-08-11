import type {
	FaceturnsState,
	FaceturnsPlayerView,
	CrewSlotView,
	BossView,
	ActiveMoveSlotView,
	TurnInfo,
	DraftPlayerView,
	RpsState,
	PendingAction,
	PendingInteractionView,
	FaceturnsSecret,
	MoveChainView,
} from "../../../../shared/games/face-turn/types";

import type {
	FaceturnServerState,
	FaceturnServerPlayer,
	PendingInteraction,
} from "./types";
import { getCrew, getMove, getBoss } from "./cards";

function buildCrewSlots(player: FaceturnServerPlayer): readonly CrewSlotView[] {
	return [0, 1].map((i): CrewSlotView => {
		const idx = i as 0 | 1;
		const crewId = player.crewIds[idx];

		if (!crewId) {
			return {
				slotIndex: idx,
				status: "empty",
				crewId: null,
				crewClass: null,
				isTurned: false,
				extraClasses: [],
			};
		}
		if (!player.crewTurned[idx]) {
			return {
				slotIndex: idx,
				status: "face_down",
				crewId: null,
				crewClass: null,
				isTurned: false,
				extraClasses: [],
			};
		}
		const crew = getCrew(crewId);
		const overrides = player.crewClassOverrides.get(idx);
		return {
			slotIndex: idx,
			status: "face_up",
			crewId: crew.id,
			crewClass: crew.class,
			isTurned: true,
			extraClasses: overrides ? [...overrides] : [],
		};
	});
}

function buildBossView(player: FaceturnServerPlayer): BossView {
	if (!player.bossId) {
		return {
			id: "",
			name: "",
			hp: 0,
			maxHp: 0,
			shield: 0,
			shieldTurnsRemaining: null,
			commandUsed: false,
			passiveEffects: [],
		};
	}
	const def = getBoss(player.bossId);
	return {
		id: def.id,
		name: def.name,
		hp: player.bossHp,
		maxHp: player.bossMaxHp,
		shield: player.bossShield,
		shieldTurnsRemaining:
			player.bossImmunityTurns > 0 ? player.bossImmunityTurns : null,
		commandUsed: player.bossCommandUsed,
		passiveEffects:
			def.passiveEffects.length > 0 ? [def.effectText.passive] : [],
	};
}

function buildActiveMoveSlots(
	player: FaceturnServerPlayer,
): readonly ActiveMoveSlotView[] {
	return player.activeMoves.map((moveId, i): ActiveMoveSlotView => {
		if (!moveId) return { slotIndex: i, moveId: null, moveName: null };
		const move = getMove(moveId);
		return { slotIndex: i, moveId: move.id, moveName: move.name };
	});
}

// construct a public view of a player, summing inbound poison from living sources only
function buildPlayerView(
	player: FaceturnServerPlayer,
	state: FaceturnServerState,
): FaceturnsPlayerView {
	let totalIncomingPoison = 0;
	for (const [sourceId, damage] of player.incomingPoison) {
		if (!state.eliminatedPlayers.has(sourceId)) {
			totalIncomingPoison += damage;
		}
	}

	return {
		playerId: player.playerId,
		handSize: player.hand.length,
		deckSize: player.deck.length,
		discardSize: player.discardPile.length,
		cash: player.cash,
		boss: buildBossView(player),
		crewSlots: buildCrewSlots(player),
		activeMoveSlots: buildActiveMoveSlots(player),
		hasBluffedSuccessfully: player.hasBluffedSuccessfully,
		hasCalledBluffSuccessfully: player.hasCalledBluffSuccessfully,
		totalCardsDiscarded: player.totalCardsDiscarded,
		totalMovesPlayed: player.totalMovesPlayed,
		hasShieldedBossThisGame: player.hasShieldedBossThisGame,
		poisonStacks: totalIncomingPoison,
		cashGainPerTurn: player.cashGainPerTurn,
		moveBaseCostReduction: player.moveBaseCostReduction,
		isEliminated: state.eliminatedPlayers.has(player.playerId),
		teamIndex: player.teamIndex,
		mulliganDecided: player.mulliganDecided,
	};
}

// exposes the current move chain for client-side display (who's responding, stack)
function buildMoveChainView(state: FaceturnServerState): MoveChainView | null {
	if (!state.moveChain) return null;
	const { participants, stack, responderId } = state.moveChain;
	return {
		participants,
		chain: stack.map((entry) => ({
			moveId: entry.moveId,
			actorId: entry.actorId,
			targetCrewSlot: entry.targetCrewSlot,
			targetAllySlot: entry.targetAllySlot,
			targetPlayerId: entry.targetPlayerId,
		})),
		responderId,
	};
}

function buildPendingInteractionView(
	pi: PendingInteraction,
): PendingInteractionView {
	switch (pi.type) {
		case "peek_discard":
			return { type: "peek_discard", actorId: pi.actorId };

		case "crew_reactivate":
			return {
				type: "crew_reactivate",
				actorId: pi.actorId,
				eligibleSlots: pi.eligibleSlots,
			};

		case "poison_target_pick":
			return {
				type: "poison_target_pick",
				actorId: pi.actorId,
				eligibleTargetIds: pi.eligibleTargetIds,
				damagePerRound: pi.damagePerRound,
			};

		case "choose_crew_to_turn":
			return {
				type: "choose_crew_to_turn",
				actorId: pi.actorId,
				targetPlayerId: pi.targetPlayerId,
				chooserPlayerId: pi.chooserPlayerId,
				eligibleSlots: pi.eligibleSlots,
				isStrike: pi.isStrike,
			};

		case "choose_discard_count":
			return {
				type: "choose_discard_count",
				actorId: pi.actorId,
				maxCount: pi.maxCount,
				targetPlayerId: pi.targetPlayerId,
				damagePerCard: pi.damagePerCard,
			};

		case "choose_from_discard":
			return {
				type: "choose_from_discard",
				actorId: pi.actorId,
				discardPileSnapshot: pi.discardPileSnapshot,
			};

		case "dig_deep_pick":
			// revealedCards is deliberately omitted, private info, delivered only
			// via FaceturnsSecret to the owning player
			return {
				type: "dig_deep_pick",
				actorId: pi.actorId,
				...(pi.maxPicks !== undefined ? { maxPicks: pi.maxPicks } : {}),
			};

		case "switch_up_pick":
			return {
				type: "switch_up_pick",
				actorId: pi.actorId,
				faceUpSlots: pi.faceUpSlots,
				faceDownSlots: pi.faceDownSlots,
			};

		case "tactical_support_unturn_offer":
			return {
				type: "tactical_support_unturn_offer",
				actorId: pi.actorId,
				targetPlayerId: pi.targetPlayerId,
				eligibleSlots: pi.eligibleSlots,
			};

		case "bear_bones_bonus_strike":
			return {
				type: "bear_bones_bonus_strike",
				actorId: pi.actorId,
				eligibleTargetIds: pi.eligibleTargetIds,
				cashCost: pi.cashCost,
			};

		case "void_legs_choice":
			return {
				type: "void_legs_choice",
				actorId: pi.actorId,
				hasCardsToDiscard: pi.hasCardsToDiscard,
			};

		case "background_check_guess":
			return {
				type: "background_check_guess",
				actorId: pi.actorId,
				targetPlayerId: pi.targetPlayerId,
				eligibleSlots: pi.eligibleSlots,
			};

		case "watcher_unturn_offer":
			return {
				type: "watcher_unturn_offer",
				actorId: pi.actorId,
				eligibleTargets: pi.eligibleTargets,
			};

		case "tag_out_pick":
			return {
				type: "tag_out_pick",
				actorId: pi.actorId,
				teammateId: pi.teammateId,
				ownEligibleSlots: pi.ownEligibleSlots,
				teammateEligibleSlots: pi.teammateEligibleSlots,
			};

		case "truth_serum_reveal":
			return {
				type: "truth_serum_reveal",
				actorId: pi.actorId,
				targetPlayerId: pi.targetPlayerId,
				eligibleSlots: pi.eligibleSlots,
			};

		case "lighthouse_disable_pick":
			return {
				type: "lighthouse_disable_pick",
				actorId: pi.actorId,
				eligibleTargets: pi.eligibleTargets,
				...(pi.maxPicks !== undefined ? { maxPicks: pi.maxPicks } : {}),
			};

		default: {
			const _exhaustive: never = pi;
			throw new Error(
				`buildPendingInteractionView: unhandled interaction type ${
					(_exhaustive as PendingInteraction).type
				}`,
			);
		}
	}
}

function buildPublicState(state: FaceturnServerState): FaceturnsState {
	const players: Record<string, FaceturnsPlayerView> = {};
	for (const [id, p] of state.players) {
		players[id] = buildPlayerView(p, state);
	}

	const turn: TurnInfo | null = state.activePlayerId
		? {
				turnNumber: state.turnNumber,
				activePlayerId: state.activePlayerId,
				classActionUsedThisTurn:
					state.players.get(state.activePlayerId)?.classActionUsedThisTurn ??
					false,
			}
		: null;

	const draft: Record<string, DraftPlayerView> | null =
		state.phase === "drafting"
			? Object.fromEntries(
					[...state.players.entries()].map(([id, p]) => [
						id,
						{
							playerId: id,
							selectedCount: p.draftSelections
								? (p.draftSelections.bossId ? 1 : 0) +
									p.draftSelections.crewIds.length +
									p.draftSelections.moveIds.length
								: 0,
							isDraftLocked: p.isDraftLocked,
						} satisfies DraftPlayerView,
					]),
				)
			: null;

	const pendingAction: PendingAction | null = state.pendingAction
		? {
				type: state.pendingAction.type,
				actorId: state.pendingAction.actorId,
				targetCrewSlot: state.pendingAction.targetCrewSlot,
				targetAllySlot: state.pendingAction.targetAllySlot,
				moveId: state.pendingAction.moveId,
				cashCost: state.pendingAction.cashCost,
				targetPlayerId: state.pendingAction.targetPlayerId,
			}
		: null;

	const rps: RpsState | null =
		state.mode !== "ffa" && state.phase === "rps"
			? {
					player1Choice: state.rpsChoices.get(state.playerOrder[0]) ?? null,
					player2Choice: state.rpsChoices.get(state.playerOrder[1]) ?? null,
					result: state.rpsResult,
				}
			: null;

	const pendingInteraction: PendingInteractionView | null =
		state.pendingInteraction
			? buildPendingInteractionView(state.pendingInteraction)
			: null;

	const activeTurnOrder = state.turnOrder.filter(
		(id) => !state.eliminatedPlayers.has(id),
	);

	return {
		phase: state.phase,
		players,
		playerOrder: state.playerOrder,
		mode: state.mode,
		teams: state.teams.map((team) => [...team]),
		turnOrder: activeTurnOrder,
		eliminatedPlayers: [...state.eliminatedPlayers],
		challengeEligiblePlayerIds: [...state.challengeEligiblePlayerIds],
		turn,
		pendingAction,
		pendingInteraction,
		lastResolution: state.lastResolution,
		rps,
		draft,
		moveChain: buildMoveChainView(state),
		roundNumber: state.roundNumber,
		winnerId: state.winnerId,
		winCondition: state.winCondition,
	};
}

// returns cached public state, recomputing if it was invalidated by a state change
export function getCachedPublicState(
	state: FaceturnServerState,
): FaceturnsState {
	if (state._publicStateCacheValid && state._cachedPublicState) {
		return state._cachedPublicState as FaceturnsState;
	}
	state._cachedPublicState = buildPublicState(state);
	state._publicStateCacheValid = true;
	return state._cachedPublicState as FaceturnsState;
}

// builds per-player secret payloads (hand, crew assignments, draft picks)
export function buildPrivatePayloads(
	state: FaceturnServerState,
): Map<string, FaceturnsSecret> {
	const payloads = new Map<string, FaceturnsSecret>();

	for (const [playerId, player] of state.players) {
		const peekRevealedCards: [string, string] | null =
			state.pendingInteraction?.type === "peek_discard" &&
			state.pendingInteraction.actorId === playerId
				? state.pendingInteraction.revealedCards
				: null;

		const digDeepRevealedCards: readonly string[] | null =
			state.pendingInteraction?.type === "dig_deep_pick" &&
			state.pendingInteraction.actorId === playerId
				? state.pendingInteraction.revealedCards
				: null;

		payloads.set(playerId, {
			hand: [...player.hand],
			crewAssignments: Object.fromEntries(
				player.crewIds
					.map((id, i): [number, string | null] => [i, id])
					.filter((entry): entry is [number, string] => entry[1] !== null),
			),
			reserveCrewId: player.reserveCrewId,
			costOverrides: Object.fromEntries(player.costOverrides),
			draftSelections: player.draftSelections
				? {
						bossId: player.draftSelections.bossId,
						crewIds: [...player.draftSelections.crewIds],
						moveIds: [...player.draftSelections.moveIds],
					}
				: null,
			peekRevealedCards,
			digDeepRevealedCards,
		});
	}

	return payloads;
}