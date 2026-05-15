// server/games/poker/index.ts
//
// GameEngine implementation. Pure orchestration — no poker logic lives here.
// All rules in betting.ts, all evaluation in evaluator.ts.
//
// Private helpers:
//   buildPublicPlayer      → strips hole cards, shapes PokerPlayerView
//   getPublicPokerState    → full PokerState from server state
//   dealNewHand            → reset + shuffle + deal + blinds, returns secrets
//   isAllRunout            → all remaining players are all-in, no actor
//   runOutBoardToShowdown  → deal remaining streets without betting
//   enterShowdown          → resolve pots, set handResult, return scoreDeltas
//   enterHandEnd           → one player wins by folds, skip showdown phase
//   afterAction            → shared post-action logic (next actor/street/end)
//
// Engine methods:
//   getInitialState  → blank slate
//   onStart          → seat players, deal first hand
//   onAction         → validate → apply → afterAction
//   onTimerExpired   → auto-act or phase transition
//   getPlayerSecret  → resend hole cards on reconnect

import type {
	GameEngine,
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine.js";
import type { Room } from "../../room/registry.js";
import type { GameTimer } from "../../../../shared/types.js";

import { POKER_CONSTANTS as C } from "./constants.js";
import type {
	PokerServerState,
	PokerServerPlayer,
	PokerServerAction,
} from "./types.js";
import type {
	PokerState,
	PokerPlayerView,
	PotView,
	PokerSecret,
	LastAction,
	Card,
	BettingPhase,
} from "../../../../shared/poker.js";

import { freshShuffledDeck, dealN } from "./deck.js";
import {
	postBlinds,
	validateAction,
	applyAction,
	getNextPlayerIndex,
	isBettingRoundOver,
	computeSidePots,
	resetForNewStreet,
	dealCommunityCards,
	advanceDealerButton,
	resetPlayersForNewHand,
	countActivePlayers,
	countInHandPlayers,
	getNonFoldedPlayerIds,
	getPreFlopStartIndex,
	getPostFlopStartIndex,
} from "./betting.js";
import {
	resolveShowdown,
	toHandResult,
	computeScoreDeltas,
} from "./evaluator.js";
import { PokerLogger } from "./logger.js";
import { PokerActionSchema } from "./schemas.js";

const BETTING_PHASES = new Set<string>(["pre_flop", "flop", "turn", "river"]);

function nextBettingPhase(
	current: BettingPhase,
): "flop" | "turn" | "river" | "showdown" {
	switch (current) {
		case "pre_flop":
			return "flop";
		case "flop":
			return "turn";
		case "turn":
			return "river";
		case "river":
			return "showdown";
	}
}

// strips hole cards for non-reveal phases, shapes PokerPlayerView
function buildPublicPlayer(
	player: PokerServerPlayer,
	revealCards: boolean,
): PokerPlayerView {
	return {
		playerId: player.playerId,
		seatIndex: player.seatIndex,
		stack: player.stack,
		status: player.status,
		currentBet: player.currentBet,
		totalContributed: player.totalContributed,
		isDealer: player.isDealer,
		canRaise: player.canRaise,
		// holeCards only revealed during showdown/hand_end for non-folded players
		holeCards:
			revealCards && player.holeCards !== null
				? [player.holeCards[0], player.holeCards[1]]
				: [null, null],
	};
}

// full PokerState from server state. cards revealed in showdown/hand_end
function getPublicPokerState(state: PokerServerState): PokerState {
	const revealCards = state.phase === "showdown" || state.phase === "hand_end";

	const players: Record<string, PokerPlayerView> = {};
	for (const [id, player] of state.players) {
		const shouldReveal =
			revealCards && (player.status === "active" || player.status === "allin");
		players[id] = buildPublicPlayer(player, shouldReveal);
	}

	const pots: PotView[] = state.pots.map((p) => ({
		amount: p.amount,
		eligiblePlayerIds: [...p.eligiblePlayerIds],
	}));

	const currentPlayerId =
		state.currentPlayerIndex >= 0
			? (state.seatOrder[state.currentPlayerIndex] ?? null)
			: null;

	return {
		phase: state.phase,
		communityCards: [...state.communityCards],
		pots,
		players,
		seatOrder: [...state.seatOrder],
		currentPlayerId,
		dealerSeatIndex: state.dealerIndex,
		bigBlind: C.BIG_BLIND,
		smallBlind: C.SMALL_BLIND,
		betToCall: state.betting.betToCall,
		minRaise: state.betting.betToCall + state.betting.lastRaiseIncrement,
		handNumber: state.handNumber,
		lastAction: state.lastAction,
		handResult: state.handResult,
	};
}

function makeResult(
	state: PokerServerState,
	timer: GameTimer | null,
	scoreDeltas?: Record<string, number>,
	privatePayloads?: Map<string, unknown>,
	roomPhase?: "ended",
): EngineResult {
	return {
		serverPayload: state,
		publicPayload: getPublicPokerState(state),
		timer,
		// only spread keys whose values are defined (exactOptionalPropertyTypes)
		...(scoreDeltas !== undefined && { scoreDeltas }),
		...(privatePayloads !== undefined && { privatePayloads }),
		...(roomPhase !== undefined && { roomPhase }),
	};
}

function turnTimer(): GameTimer {
	return { startsAt: Date.now(), duration: C.TURN_DURATION_MS };
}

// resets state, advances button, shuffles, deals hole cards, posts blinds,
// finds first actor. returns secrets or null if game is over (≤ 1 player)
function dealNewHand(state: PokerServerState): Map<string, PokerSecret> | null {
	state.handNumber++;

	resetPlayersForNewHand(state);

	const stillIn = [...state.players.values()].filter((p) => p.status !== "out");
	if (stillIn.length <= 1) return null;

	advanceDealerButton(state);

	const dealerId = state.seatOrder[state.dealerIndex]!;
	state.players.get(dealerId)!.isDealer = true;

	state.deck = freshShuffledDeck();

	const secrets = new Map<string, PokerSecret>();
	for (const playerId of state.seatOrder) {
		const player = state.players.get(playerId)!;
		if (player.status === "out") continue;

		const dealt = dealN(state.deck, 2);
		const holeCards: [Card, Card] = [dealt[0]!, dealt[1]!];
		player.holeCards = holeCards;
		secrets.set(playerId, { holeCards });
	}

	postBlinds(state, C);

	state.phase = "pre_flop";
	state.lastAction = null;
	state.currentPlayerIndex = getPreFlopStartIndex(state);
	state.handResult = null;

	state.logger.log("hand_start", state.handNumber, {
		handNumber: state.handNumber,
		dealerSeat: state.dealerIndex,
		dealerId,
		firstActor: state.seatOrder[state.currentPlayerIndex],
		betToCall: state.betting.betToCall,
		players: [...state.players.values()].map((p) => ({
			id: p.playerId,
			seat: p.seatIndex,
			stack: p.stack,
			status: p.status,
		})),
	});

	return secrets;
}

// true when every player still in the hand is all-in — no voluntary action possible
function isAllRunout(state: PokerServerState): boolean {
	return countInHandPlayers(state) >= 2 && countActivePlayers(state) === 0;
}

// deals all remaining community cards without betting, advances to showdown
function runOutBoardToShowdown(state: PokerServerState): void {
	while (BETTING_PHASES.has(state.phase)) {
		dealCommunityCards(state);
		state.phase = nextBettingPhase(state.phase as BettingPhase);
	}
}

// finalises side pots, evaluates hands, distributes chips, sets handResult
function enterShowdown(state: PokerServerState): {
	scoreDeltas: Record<string, number>;
} {
	state.phase = "showdown";
	state.currentPlayerIndex = -1;

	computeSidePots(state);

	const { resolutions, awards } = resolveShowdown(state);
	state.handResult = toHandResult(resolutions);

	return { scoreDeltas: computeScoreDeltas(awards, state.players) };
}

// awards pot to last remaining non-folded player, skips showdown (cards stay hidden)
function enterHandEnd(state: PokerServerState): {
	scoreDeltas: Record<string, number>;
} {
	computeSidePots(state);

	const { resolutions, awards } = resolveShowdown(state);
	state.handResult = toHandResult(resolutions);

	state.phase = "hand_end";
	state.currentPlayerIndex = -1;

	return { scoreDeltas: computeScoreDeltas(awards, state.players) };
}

// deals next street or routes to showdown when current betting round ends
function advanceStreet(state: PokerServerState, room: Room): EngineResult {
	const upcoming = nextBettingPhase(state.phase as BettingPhase);

	if (upcoming === "showdown") {
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	// deal before updating phase — dealCommunityCards reads state.phase
	dealCommunityCards(state);
	state.phase = upcoming;
	resetForNewStreet(state, C);

	state.logger.log("street_advance", state.handNumber, {
		newPhase: state.phase,
		communityCards: state.communityCards,
		potTotal: state.pots.reduce((s, p) => s + p.amount, 0),
		activePlayers: countActivePlayers(state),
	});

	if (isAllRunout(state)) {
		runOutBoardToShowdown(state);
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	const firstIdx = getPostFlopStartIndex(state);

	// safety net: no active player found (should not happen)
	if (firstIdx === -1) {
		runOutBoardToShowdown(state);
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	state.currentPlayerIndex = firstIdx;
	return makeResult(state, turnTimer());
}

// builds LastAction for display. call BEFORE applyAction — amounts are pre-mutation
function captureLastAction(
	state: PokerServerState,
	playerId: string,
	action: PokerServerAction,
): LastAction {
	let amount: number | undefined;

	if (action.type === "call") {
		const player = state.players.get(playerId)!;
		amount = Math.min(
			state.betting.betToCall - player.currentBet,
			player.stack,
		);
	} else if (action.type === "raise") {
		amount = action.amount;
	} else if (action.type === "all_in") {
		const player = state.players.get(playerId)!;
		amount = player.stack + player.currentBet;
	}

	return amount !== undefined
		? { playerId, type: action.type, amount }
		: { playerId, type: action.type };
}

// shared post-action logic. checks terminal conditions in priority order:
// 1. one non-folded → hand ends (bluff rule)
// 2. all all-in → run out board, showdown
// 3. betting round over → advance street
// 4. normal → next actor, restart timer
function afterAction(state: PokerServerState, room: Room): EngineResult {
	if (getNonFoldedPlayerIds(state).length === 1) {
		const { scoreDeltas } = enterHandEnd(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.HAND_END_DURATION_MS },
			scoreDeltas,
		);
	}

	if (isAllRunout(state)) {
		runOutBoardToShowdown(state);
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	if (isBettingRoundOver(state)) {
		return advanceStreet(state, room);
	}

	state.currentPlayerIndex = getNextPlayerIndex(state);
	return makeResult(state, turnTimer());
}

export const pokerEngine: GameEngine & GameEngineWithSecrets = {
	gameId: "poker-night",

	actionSchema: PokerActionSchema,

	// returns blank slate, onStart populates from room context
	getInitialState(): PokerServerState {
		return {
			phase: "waiting",
			deck: [],
			communityCards: [],
			pots: [],
			players: new Map(),
			seatOrder: [],
			dealerIndex: 0,
			currentPlayerIndex: -1,
			betting: {
				betToCall: 0,
				lastRaiseIncrement: C.BIG_BLIND,
				lastRaiserId: null,
			},
			handNumber: 0,
			lastAction: null,
			logger: new PokerLogger("pending"),
			handResult: null,
		};
	},

	// assigns seats from room roster, deals first hand, distributes secrets
	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;

		state.logger = new PokerLogger(room.code);

		const roomPlayers = [...room.players.values()];
		state.seatOrder = roomPlayers.map((p) => p.playerId);

		for (let i = 0; i < roomPlayers.length; i++) {
			const rp = roomPlayers[i]!;
			state.players.set(rp.playerId, {
				playerId: rp.playerId,
				seatIndex: i,
				stack: C.STARTING_STACK,
				holeCards: null,
				status: "active",
				currentBet: 0,
				totalContributed: 0,
				hasActedThisRound: false,
				canRaise: true,
				isDealer: false,
			});
		}

		state.logger.log("game_start", null, {
			playerCount: roomPlayers.length,
			startingStack: C.STARTING_STACK,
			blinds: { sb: C.SMALL_BLIND, bb: C.BIG_BLIND },
			seats: state.seatOrder,
		});

		const secrets = dealNewHand(state);

		const privatePayloads = new Map<string, unknown>();
		if (secrets) {
			for (const [id, secret] of secrets) privatePayloads.set(id, secret);
		}

		return makeResult(state, turnTimer(), undefined, privatePayloads);
	},

	// validate → capture → apply → post-action
	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;

		const noOp = (): EngineResult => makeResult(state, room.timer);

		if (!BETTING_PHASES.has(state.phase)) return noOp();

		const action = raw as PokerServerAction;

		if (!validateAction(state, playerId, action)) return noOp();

		// capture before apply — amounts change after mutation
		state.lastAction = captureLastAction(state, playerId, action);

		applyAction(state, playerId, action);

		return afterAction(state, room);
	},

	// each phase has one clear responsibility when timer fires
	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;

		// betting phase: auto-act. fold if there's a bet to call, check if free
		if (BETTING_PHASES.has(state.phase)) {
			const playerId = state.seatOrder[state.currentPlayerIndex];

			if (!playerId) return makeResult(state, null);

			const player = state.players.get(playerId)!;
			const autoAction: PokerServerAction =
				player.currentBet < state.betting.betToCall
					? { type: "fold" }
					: { type: "check" };

			state.lastAction = { playerId, type: autoAction.type };
			applyAction(state, playerId, autoAction);

			state.logger.log("player_action_timeout", state.handNumber, {
				playerId,
				autoAction: autoAction.type,
				phase: state.phase,
			});

			return afterAction(state, room);
		}

		// showdown: display window elapsed → hand_end
		if (state.phase === "showdown") {
			state.phase = "hand_end";
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.HAND_END_DURATION_MS,
			});
		}

		// hand end: check game over, else inter-hand gap
		if (state.phase === "hand_end") {
			const playersWithChips = [...state.players.values()].filter(
				(p) => p.stack > 0,
			);

			if (playersWithChips.length <= 1) {
				state.phase = "finished";

				state.logger.log("game_over", state.handNumber, {
					winner: playersWithChips[0]?.playerId ?? null,
					finalStacks: Object.fromEntries(
						[...state.players.values()].map((p) => [p.playerId, p.stack]),
					),
				});

				return makeResult(state, null, undefined, undefined, "ended");
			}

			state.phase = "waiting";
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.WAITING_DURATION_MS,
			});
		}

		// waiting: deal next hand
		if (state.phase === "waiting") {
			const secrets = dealNewHand(state);

			if (!secrets) {
				state.phase = "finished";
				return makeResult(state, null, undefined, undefined, "ended");
			}

			const privatePayloads = new Map<string, unknown>();
			for (const [id, secret] of secrets) privatePayloads.set(id, secret);

			return makeResult(state, turnTimer(), undefined, privatePayloads);
		}

		return makeResult(state, null);
	},

	// resends hole cards on reconnect. null after showdown (cards in publicPayload)
	getPlayerSecret(ctx: GameContext, playerId: string): PokerSecret | null {
		const state = ctx.room.gamePayload as PokerServerState;
		const player = state.players.get(playerId);

		if (!player?.holeCards) return null;

		if (state.phase === "showdown" || state.phase === "hand_end") return null;

		return { holeCards: player.holeCards };
	},
};
