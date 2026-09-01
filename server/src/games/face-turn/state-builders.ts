import type {
	FaceturnsState,
	FaceturnsPlayerView,
	CrewSlotView,
	BossView,
	ActiveMoveSlotView,
	TurnInfo,
	DraftPlayerView,
	RpsState,
	RpsOrderChoiceState,
	PendingAction,
	PendingInteractionView,
	FaceturnsSecret,
	MoveChainView,
} from "../../../../shared/games/face-turn/types";

import type { FaceturnServerState, FaceturnServerPlayer } from "./types";
import type { PendingInteraction } from "./interactions/types";
import { getInteractionSpec } from "./interactions/registry";
import { getCrew, getMove, getBoss } from "./cards";
import { moveHasLegalTarget } from "./effects";
import { effectiveCost } from "./game";

let simulationModeActive = false;

const EMPTY_PUBLIC_STATE = Object.freeze({}) as unknown as FaceturnsState;
const EMPTY_PRIVATE_PAYLOADS: Map<string, FaceturnsSecret> = new Map();

export function runInSimulationMode<T>(fn: () => T): T {
	const previous = simulationModeActive;
	simulationModeActive = true;
	try {
		return fn();
	} finally {
		simulationModeActive = previous;
	}
}

// hand cards the player could legally play right now: affordable, has a
// free active-move slot if the move is "active", and has a legal target.
function computePlayableMoveIds(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): readonly string[] {
	const playable: string[] = [];
	const hasOpenActiveSlot = player.activeMoves.some((s) => s === null);
	for (const moveId of player.hand) {
		const move = getMove(moveId);
		const cost = effectiveCost(state, player, moveId);
		if (player.cash < cost) continue;
		if (move.moveType === "active" && !hasOpenActiveSlot) {
			continue;
		}
		if (!moveHasLegalTarget(state, player.playerId, move)) continue;
		playable.push(moveId);
	}
	return playable;
}

// server is the sole authority on move-chain legality — this is the exact
// same gating actions/challenge-and-chain.ts enforces for chain_play_burst
// and chain_play_slow, kept in lockstep so the client can just render
// whatever's in chainPlayableMoveIds instead of re-deriving priority rules
// itself: only whoever currently holds priority (chain.responderId) may
// play anything, burst or slow — the other participant is locked out
// until priority comes back to them.
export function computeChainPlayableMoveIds(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): readonly string[] {
	const chain = state.moveChain;
	if (!chain || !chain.participants.includes(player.playerId)) return [];
	if (player.playerId !== chain.responderId) return [];

	const playable: string[] = [];
	for (const moveId of player.hand) {
		const move = getMove(moveId);
		if (move.moveType !== "burst" && move.moveType !== "slow") continue;
		const cost = effectiveCost(state, player, moveId);
		if (player.cash < cost) continue;
		if (!moveHasLegalTarget(state, player.playerId, move)) continue;
		playable.push(moveId);
	}
	return playable;
}

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
				isPassiveDisabled: false,
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
				isPassiveDisabled: false,
			};
		}
		const crew = getCrew(crewId);
		const overrides = player.derived.crewClassOverrides.get(idx);
		return {
			slotIndex: idx,
			status: "face_up",
			crewId: crew.id,
			crewClass: crew.class,
			isTurned: true,
			extraClasses: overrides ? [...overrides] : [],
			isPassiveDisabled:
				player.disabledPassiveSlots.has(idx) ||
				player.derived.crewSkillsDisabled ||
				player.derived.crewPassivesSilencedByEnemy,
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
			armor: 0,
			armorTurnsRemaining: null,
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
		armor: player.bossArmor,
		armorTurnsRemaining:
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
		hasArmoredBossThisGame: player.hasArmoredBossThisGame,
		poisonStacks: totalIncomingPoison,
		cashGainPerTurn: player.derived.cashGainPerTurn,
		moveBaseCostReduction: player.derived.moveBaseCostReduction,
		classActionCostReduction: player.derived.classActionCostReduction,
		isEliminated: state.eliminatedPlayers.has(player.playerId),
		teamIndex: player.teamIndex,
		mulliganDecided: player.mulliganDecided,
		hasSellCards: player.derived.hasSellCards,
		sellCardCashAmount: player.derived.sellCardCashAmount,
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
			cashCost: entry.cashCost,
		})),
		responderId,
	};
}

function buildPendingInteractionView(
	pi: PendingInteraction,
): PendingInteractionView {
	return getInteractionSpec(pi).toView(pi);
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
				originalActionType: state.pendingAction.originalActionType,
			}
		: null;

	const rps: RpsState | null =
		state.mode !== "ffa" &&
		(state.phase === "rps" || state.phase === "rps_reveal")
			? {
					player1Choice: state.rpsChoices.get(state.playerOrder[0]) ?? null,
					player2Choice: state.rpsChoices.get(state.playerOrder[1]) ?? null,
					result: state.rpsResult,
				}
			: null;

	const rpsOrderChoice: RpsOrderChoiceState | null =
		state.phase === "rps_order_choice" && state.rpsOrderChoiceWinnerId
			? { winnerId: state.rpsOrderChoiceWinnerId }
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
		lastChainResolution: state.lastChainResolution,
		log: state.log,
		rps,
		rpsOrderChoice,
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
	if (simulationModeActive) return EMPTY_PUBLIC_STATE;
	if (state._publicStateCacheValid && state._cachedPublicState) {
		return state._cachedPublicState as FaceturnsState;
	}
	state._cachedPublicState = buildPublicState(state);
	state._publicStateCacheValid = true;
	return state._cachedPublicState as FaceturnsState;
}

// builds the secret payload for a single player: hand, crew assignments,
// draft picks, and any reveal tied to a pending interaction they own
export function buildSecretForPlayer(
	state: FaceturnServerState,
	player: FaceturnServerPlayer,
): FaceturnsSecret {
	const playerId = player.playerId;

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

	const watcherStealRevealedCards: [string, string] | null =
		state.pendingInteraction?.type === "watcher_steal_pick" &&
		state.pendingInteraction.actorId === playerId
			? state.pendingInteraction.revealedCards
			: null;

	return {
		hand: [...player.hand],
		playableMoveIds:
			state.phase === "active_turn" && state.activePlayerId === playerId
				? computePlayableMoveIds(state, player)
				: [],
		chainPlayableMoveIds: computeChainPlayableMoveIds(state, player),
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
		watcherStealRevealedCards,
	};
}

// builds per-player secret payloads for everyone in the game
export function buildPrivatePayloads(
	state: FaceturnServerState,
): Map<string, FaceturnsSecret> {
	if (simulationModeActive) return EMPTY_PRIVATE_PAYLOADS;
	const payloads = new Map<string, FaceturnsSecret>();

	for (const player of state.players.values()) {
		payloads.set(player.playerId, buildSecretForPlayer(state, player));
	}

	return payloads;
}