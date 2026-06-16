import type {
	GameEngine,
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine";
import type { Room } from "../../room/registry";
import type { GameTimer } from "../../../../shared/core/room";

import { POKER_CONSTANTS as C } from "./constants";
import type {
	PokerServerState,
	PokerServerPlayer,
	PokerServerAction,
} from "./types";
import type {
	PokerState,
	PokerPlayerView,
	PotView,
	PokerSecret,
	LastAction,
	Card,
	BettingPhase,
} from "../../../../shared/games/poker";

import { freshShuffledDeck, dealN } from "./deck";
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
	getBigBlindIndex,
	getSmallBlindIndex,
} from "./betting";
import { resolveShowdown, toHandResult, computeScoreDeltas } from "./evaluator";
import { PokerLogger } from "./logger";
import { PokerActionSchema } from "./schemas";

import {
	generateAIPlayer,
	makeAIAction,
	initializeRangeModels,
	updateOpponentRange,
	NameDispenser,
} from "./ai/index";

// constants

const BETTING_PHASES = new Set<string>(["pre_flop", "flop", "turn", "river"]);

const AI_SEAT_ID_PREFIX = "ai::";

function seedAIPlayers(state: PokerServerState, humanCount: number): void {
	const aiCount = Math.min(C.AI_SEAT_COUNT, C.MAX_PLAYERS - humanCount);

	for (let i = 0; i < aiCount; i++) {
		const playerId = `${AI_SEAT_ID_PREFIX}${i}`;

		// generateaiplayer picks personality first then resolves a name from that archetype's themed pool via the session-scoped dispenser
		const { displayName, personality } = generateAIPlayer(
			playerId,
			state.nameDispenser,
		);

		state.players.set(playerId, {
			playerId,
			seatIndex: humanCount + i,
			displayName,
			stack: C.STARTING_STACK,
			holeCards: null,
			status: "active",
			currentBet: 0,
			totalContributed: 0,
			hasActedThisRound: false,
			canRaise: true,
			isDealer: false,
			isAI: true,
			aiPersonality: personality,
		});

		state.seatOrder.push(playerId);
	}

	if (aiCount > 0) {
		state.logger.log("ai_seats_filled", null, {
			count: aiCount,
			seats: state.seatOrder.slice(humanCount),
		});
	}
}

// phase map

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

// public state builder

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
		displayName: player.displayName,
		// privacy invariant: holecards only revealed during showdown/hand_end for non-folded players, otherwise [null, null]
		holeCards:
			revealCards && player.holeCards !== null
				? [player.holeCards[0], player.holeCards[1]]
				: [null, null],
	};
}

function getPublicPokerState(state: PokerServerState): PokerState {
	// cards are revealed when the result is being displayed
	// hand_end keeps them visible so players can review who won and with what
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

// result factory

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
		// exactoptionalpropertytypes: only spread keys whose values are defined
		...(scoreDeltas !== undefined && { scoreDeltas }),
		...(privatePayloads !== undefined && { privatePayloads }),
		...(roomPhase !== undefined && { roomPhase }),
	};
}

function turnTimer(): GameTimer {
	return { startsAt: Date.now(), duration: C.TURN_DURATION_MS };
}

// returns the correct timer for whoever is now set as currentplayerindex
// TODO: fix ai timer
function timerForNextPlayer(state: PokerServerState): GameTimer {
	const playerId = state.seatOrder[state.currentPlayerIndex];
	const player = playerId ? state.players.get(playerId) : undefined;
	if (player?.isAI && player.aiPersonality) {
		const [min, max] = player.aiPersonality.thinkTimeMs;
		return {
			startsAt: Date.now(),
			duration: Math.round(min + Math.random() * (max - min)),
		};
	}
	return { startsAt: Date.now(), duration: C.TURN_DURATION_MS };
}

// deal setup

// fully sets up a new hand: resets state, advances button, shuffles, deals hole cards to every active player, posts blinds, finds first actor
function dealNewHand(state: PokerServerState): Map<string, PokerSecret> | null {
	state.handNumber++;

	// marks zero-stack players 'out', resets hand-scoped fields for the rest
	resetPlayersForNewHand(state);

	// game ends when only one (or zero) players can still play
	const stillIn = [...state.players.values()].filter((p) => p.status !== "out");
	if (stillIn.length <= 1) return null;

	// rotate dealer button (skips 'out' seats permanently)
	advanceDealerButton(state);

	// mark the new dealer
	const dealerId = state.seatOrder[state.dealerIndex]!;
	state.players.get(dealerId)!.isDealer = true;

	// fresh deck for this hand
	state.deck = freshShuffledDeck();

	// deal 2 hole cards to every active seat; build secret payloads
	const secrets = new Map<string, PokerSecret>();
	for (const playerId of state.seatOrder) {
		const player = state.players.get(playerId)!;
		if (player.status === "out") continue;

		const dealt = dealN(state.deck, 2);
		const holeCards: [Card, Card] = [dealt[0]!, dealt[1]!];
		player.holeCards = holeCards;
		secrets.set(playerId, { holeCards });
	}

	// initialize range models for every active player at hand start
	initializeRangeModels(state);

	const sbId = state.seatOrder[getSmallBlindIndex(state)]!;
	const bbId = state.seatOrder[getBigBlindIndex(state)]!;

	// post forced blinds — may push short-stacked players all-in
	postBlinds(state, C);

	// emit after posting so .currentbet reflects the actual amount posted
	state.logger.log("blinds_posted", state.handNumber, {
		sb: { playerId: sbId, posted: state.players.get(sbId)!.currentBet },
		bb: { playerId: bbId, posted: state.players.get(bbId)!.currentBet },
	});

	// reset hand-level display fields
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
			holeCards: p.holeCards ?? [],
			displayName: p.displayName ?? null,
			isAI: p.isAI,
			personalityId: p.aiPersonality?.id ?? null,
		})),
	});

	return secrets;
}

// runout & showdown helpers

function shouldAutoRunout(state: PokerServerState): boolean {
	return countInHandPlayers(state) >= 2 && countActivePlayers(state) === 0;
}

function dealNextRunoutStreet(state: PokerServerState): EngineResult {
	// all 5 community cards are on the board, evaluate and show results
	if (state.phase === "river") {
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	// deal the next street (flop/turn/river) and pause for display
	dealCommunityCards(state); // reads current phase
	state.phase = nextBettingPhase(state.phase as BettingPhase); // advance phase
	state.currentPlayerIndex = -1; // no one acts

	state.logger.log("runout_street", state.handNumber, {
		newPhase: state.phase,
		communityCards: state.communityCards,
	});

	return makeResult(state, {
		startsAt: Date.now(),
		duration: C.RUNOUT_STREET_DURATION_MS,
	});
}

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

// awards the pot directly to the last remaining non-folded player without going through the showdown phase
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

// street advance

// called when the current betting round is definitively over
// deals the next street or routes to showdown, handling all sub-cases
function advanceStreet(state: PokerServerState, room: Room): EngineResult {
	const upcoming = nextBettingPhase(state.phase as BettingPhase);

	// river just ended → showdown
	if (upcoming === "showdown") {
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	// deal the next street's community cards before updating phase — dealcommunitycards reads state.phase to know what to deal
	dealCommunityCards(state);
	state.phase = upcoming;
	resetForNewStreet(state, C);

	// totalcontributed accumulates all chips across all streets and is never reset between streets — correct pot total at any point in the hand
	const potTotal = [...state.players.values()].reduce(
		(s, p) => s + p.totalContributed,
		0,
	);

	state.logger.log("street_advance", state.handNumber, {
		newPhase: state.phase,
		communityCards: state.communityCards,
		potTotal,
		activePlayers: countActivePlayers(state),
	});

	if (shouldAutoRunout(state)) {
		return dealNextRunoutStreet(state);
	}

	const firstIdx = getPostFlopStartIndex(state);
	if (firstIdx === -1) {
		return dealNextRunoutStreet(state);
	}

	state.currentPlayerIndex = firstIdx;
	return makeResult(state, timerForNextPlayer(state));
}

// lastaction capture

// builds the lastaction for display
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
		amount = player.stack + player.currentBet; // their total commitment
	}

	return amount !== undefined
		? { playerId, type: action.type, amount }
		: { playerId, type: action.type };
}

// post-action sequence

function afterAction(state: PokerServerState, room: Room): EngineResult {
	// 1. only one player didn't fold
	if (getNonFoldedPlayerIds(state).length === 1) {
		const { scoreDeltas } = enterHandEnd(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.HAND_END_DURATION_MS },
			scoreDeltas,
		);
	}

	// 2. all remaining players are all-in, begin cinematic street-by-street runout
	if (shouldAutoRunout(state)) {
		return dealNextRunoutStreet(state);
	}

	// 3. betting round is over (everyone acted and matched bettocall)
	if (isBettingRoundOver(state)) {
		return advanceStreet(state, room);
	}

	// 4. next player's turn — use timerfornextplayer so ai seats get their think-time window instead of the full 30s human timer
	state.currentPlayerIndex = getNextPlayerIndex(state);
	return makeResult(state, timerForNextPlayer(state));
}

// engine export

export const pokerEngine: GameEngine & GameEngineWithSecrets = {
	gameId: "poker",

	actionSchema: PokerActionSchema,

	// returns a blank slate. onstart populates everything from room context
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
			pfAggressorId: null,
			logger: new PokerLogger("pending"),
			handResult: null,
			opponentRangeModels: new Map(),
			nameDispenser: new NameDispenser(),
			activeLines: new Map(),
		};
	},

	// assign seats from room roster, deal the first hand, distribute secrets
	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;

		state.logger = new PokerLogger(room.code);

		// seats are fixed at game start — join order determines position
		const roomPlayers = [...room.players.values()];
		state.seatOrder = roomPlayers.map((p) => p.playerId);

		for (let i = 0; i < roomPlayers.length; i++) {
			const rp = roomPlayers[i]!;
			state.players.set(rp.playerId, {
				playerId: rp.playerId,
				seatIndex: i,
				displayName: null,
				stack: C.STARTING_STACK,
				holeCards: null,
				status: "active",
				currentBet: 0,
				totalContributed: 0,
				hasActedThisRound: false,
				canRaise: true,
				isDealer: false,
				isAI: false,
				aiPersonality: null,
			});
		}

		seedAIPlayers(state, roomPlayers.length);

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

		return makeResult(
			state,
			timerForNextPlayer(state),
			undefined,
			privatePayloads,
		);
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;
		const noOp = (): EngineResult => makeResult(state, room.timer);

		if (!BETTING_PHASES.has(state.phase)) return noOp();

		// ai players act via ontimerexpired, never via external messages
		// reject any action claiming to come from an ai seat id
		if (playerId.startsWith(AI_SEAT_ID_PREFIX)) return noOp();

		const action = raw as PokerServerAction;
		if (!validateAction(state, playerId, action)) return noOp();

		// capture bettocall before applyaction mutates it
		const prevBetToCall = state.betting.betToCall;
		state.lastAction = captureLastAction(state, playerId, action);
		applyAction(state, playerId, action);

		const la = state.lastAction;
		state.logger.log("player_action", state.handNumber, {
			playerId,
			type: la.type,
			...(la.type === "call" && { callAmount: la.amount }),
			...(la.type === "raise" && { raiseTo: la.amount }),
			...(la.type === "all_in" && { totalAmount: la.amount }),
			remainingStack: state.players.get(playerId)!.stack,
			phase: state.phase,
			prevBetToCall,
		});
		updateOpponentRange(state, playerId, action, prevBetToCall, state.phase);
		return afterAction(state, room);
	},

	// ontimerexpired
	// each phase has one clear responsibility when its timer fires
	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;

		// betting phase
		if (BETTING_PHASES.has(state.phase)) {
			// if all remaining players are all-in, this timer is a runout delay
			if (shouldAutoRunout(state)) {
				return dealNextRunoutStreet(state);
			}

			// normal: auto-act the player who timed out
			// fold if there's a bet to call; check if free
			const playerId = state.seatOrder[state.currentPlayerIndex];
			if (!playerId) return makeResult(state, null);

			const player = state.players.get(playerId)!;

			// ai seat: compute decision from equity math, not auto-fold/check
			if (player.isAI && player.aiPersonality) {
				const action = makeAIAction(state, playerId);
				const prevBetToCall = state.betting.betToCall;
				state.lastAction = captureLastAction(state, playerId, action);
				applyAction(state, playerId, action);

				const la = state.lastAction;
				state.logger.log("player_action", state.handNumber, {
					playerId,
					type: la.type,
					...(la.type === "call" && { callAmount: la.amount }),
					...(la.type === "raise" && { raiseTo: la.amount }),
					...(la.type === "all_in" && { totalAmount: la.amount }),
					remainingStack: player.stack,
					phase: state.phase,
				});
				updateOpponentRange(
					state,
					playerId,
					action,
					prevBetToCall,
					state.phase,
				);
				return afterAction(state, room);
			}

			// human timeout: auto-act passively
			const autoAction: PokerServerAction =
				player.currentBet < state.betting.betToCall
					? { type: "fold" }
					: { type: "check" };

			const prevBetToCall = state.betting.betToCall;
			state.lastAction = { playerId, type: autoAction.type };
			applyAction(state, playerId, autoAction);
			state.logger.log("player_action", state.handNumber, {
				playerId,
				type: autoAction.type,
				remainingStack: player.stack,
				phase: state.phase,
			});
			updateOpponentRange(
				state,
				playerId,
				autoAction,
				prevBetToCall,
				state.phase,
			);
			return afterAction(state, room);
		}

		// showdown: display window elapsed -> hand_end
		// the result was already resolved when entering showdown (stacks updated, handresult set)
		// this timer just controls how long cards stay revealed
		if (state.phase === "showdown") {
			state.phase = "hand_end";
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.HAND_END_DURATION_MS,
			});
		}

		// hand end: check game over, else inter-hand gap
		// check stacks directly — busted players still have status 'allin' here
		// resetplayersfornewhand (called in dealnewhand) will mark them 'out'
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

			// at least 2 players remain — brief waiting gap before next deal
			state.phase = "waiting";
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.WAITING_DURATION_MS,
			});
		}

		// waiting: deal next hand
		// board and handresult from last hand are still in state for display
		// dealnewhand clears them when it resets for the new hand
		if (state.phase === "waiting") {
			const secrets = dealNewHand(state);

			// shouldn't happen (caught in hand_end), but guard defensively
			if (!secrets) {
				state.phase = "finished";
				return makeResult(state, null, undefined, undefined, "ended");
			}

			const privatePayloads = new Map<string, unknown>();
			for (const [id, secret] of secrets) privatePayloads.set(id, secret);

			return makeResult(
				state,
				timerForNextPlayer(state),
				undefined,
				privatePayloads,
			);
		}

		// finished / unknown
		return makeResult(state, null);
	},

	getPlayerSecret(ctx: GameContext, playerId: string): PokerSecret | null {
		const state = ctx.room.gamePayload as PokerServerState;
		const player = state.players.get(playerId);

		if (!player?.holeCards) return null;

		// during showdown/hand_end, cards are in publicpayload, no secret needed
		if (state.phase === "showdown" || state.phase === "hand_end") return null;

		return { holeCards: player.holeCards };
	},
};