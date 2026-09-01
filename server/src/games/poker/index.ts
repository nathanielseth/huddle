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
} from "../../../../shared/games/poker/index";

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
import { defined } from "../lib/assert";

import {
	generateAIPlayer,
	makeAIAction,
	initializeRangeModels,
	updateOpponentRange,
	NameDispenser,
} from "./ai/index";

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
		holeCards:
			revealCards && player.holeCards !== null
				? [player.holeCards[0], player.holeCards[1]]
				: [null, null],
	};
}

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
		...(scoreDeltas !== undefined && { scoreDeltas }),
		...(privatePayloads !== undefined && { privatePayloads }),
		...(roomPhase !== undefined && { roomPhase }),
	};
}

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

function dealNewHand(state: PokerServerState): Map<string, PokerSecret> | null {
	state.handNumber++;

	resetPlayersForNewHand(state);

	const stillIn = [...state.players.values()].filter((p) => p.status !== "out");
	if (stillIn.length <= 1) return null;

	advanceDealerButton(state);

	const dealerId = defined(
		state.seatOrder[state.dealerIndex],
		`seatOrder[${String(state.dealerIndex)}] missing — no dealer seat`,
	);
	defined(
		state.players.get(dealerId),
		`player ${dealerId} missing when marking dealer`,
	).isDealer = true;

	state.deck = freshShuffledDeck();

	const secrets = new Map<string, PokerSecret>();
	for (const playerId of state.seatOrder) {
		const player = defined(
			state.players.get(playerId),
			`player ${playerId} missing during deal`,
		);
		if (player.status === "out") continue;

		const dealt = dealN(state.deck, 2);
		const holeCards: [Card, Card] = [
			defined(dealt[0], "dealN returned fewer than 2 cards"),
			defined(dealt[1], "dealN returned fewer than 2 cards"),
		];
		player.holeCards = holeCards;
		secrets.set(playerId, { holeCards });
	}

	initializeRangeModels(state);

	const sbId = defined(
		state.seatOrder[getSmallBlindIndex(state)],
		"no small blind seat",
	);
	const bbId = defined(
		state.seatOrder[getBigBlindIndex(state)],
		"no big blind seat",
	);

	postBlinds(state, C);

	state.logger.log("blinds_posted", state.handNumber, {
		sb: {
			playerId: sbId,
			posted: defined(state.players.get(sbId), `SB player ${sbId} missing`)
				.currentBet,
		},
		bb: {
			playerId: bbId,
			posted: defined(state.players.get(bbId), `BB player ${bbId} missing`)
				.currentBet,
		},
	});

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

function shouldAutoRunout(state: PokerServerState): boolean {
	return countInHandPlayers(state) >= 2 && countActivePlayers(state) === 0;
}

function dealNextRunoutStreet(state: PokerServerState): EngineResult {
	if (state.phase === "river") {
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	dealCommunityCards(state);
	state.phase = nextBettingPhase(state.phase as BettingPhase);
	state.currentPlayerIndex = -1;

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

function advanceStreet(state: PokerServerState): EngineResult {
	const upcoming = nextBettingPhase(state.phase as BettingPhase);

	if (upcoming === "showdown") {
		const { scoreDeltas } = enterShowdown(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.SHOWDOWN_DURATION_MS },
			scoreDeltas,
		);
	}

	dealCommunityCards(state);
	state.phase = upcoming;
	resetForNewStreet(state, C);

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

function captureLastAction(
	state: PokerServerState,
	playerId: string,
	action: PokerServerAction,
): LastAction {
	let amount: number | undefined;

	if (action.type === "call") {
		const player = defined(
			state.players.get(playerId),
			`player ${playerId} missing in captureLastAction`,
		);
		amount = Math.min(
			state.betting.betToCall - player.currentBet,
			player.stack,
		);
	} else if (action.type === "raise") {
		amount = action.amount;
	} else if (action.type === "all_in") {
		const player = defined(
			state.players.get(playerId),
			`player ${playerId} missing in captureLastAction`,
		);
		amount = player.stack + player.currentBet;
	}

	return amount !== undefined
		? { playerId, type: action.type, amount }
		: { playerId, type: action.type };
}

function afterAction(state: PokerServerState, _room: Room): EngineResult {
	if (getNonFoldedPlayerIds(state).length === 1) {
		const { scoreDeltas } = enterHandEnd(state);
		return makeResult(
			state,
			{ startsAt: Date.now(), duration: C.HAND_END_DURATION_MS },
			scoreDeltas,
		);
	}

	if (shouldAutoRunout(state)) {
		return dealNextRunoutStreet(state);
	}

	if (isBettingRoundOver(state)) {
		return advanceStreet(state);
	}

	state.currentPlayerIndex = getNextPlayerIndex(state);
	return makeResult(state, timerForNextPlayer(state));
}

export const pokerEngine: GameEngine & GameEngineWithSecrets = {
	gameId: "poker",

	actionSchema: PokerActionSchema,

	supportsCpuSeats: true,

	getMaxSeats(): number {
		return C.MAX_PLAYERS;
	},

	validateStart(_configPayload: unknown, playerIds: string[]): string | null {
		const count = playerIds.length;
		if (count < C.MIN_PLAYERS) {
			return `Poker needs at least ${String(C.MIN_PLAYERS)} players — add a CPU or invite a friend.`;
		}
		if (count > C.MAX_PLAYERS) {
			return `Poker tables seat at most ${String(C.MAX_PLAYERS)} players.`;
		}
		return null;
	},

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

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;

		state.logger = new PokerLogger(room.code);

		const roomPlayers = [...room.players.values()];
		state.seatOrder = roomPlayers.map((p) => p.playerId);

		let cpuCount = 0;
		for (let i = 0; i < roomPlayers.length; i++) {
			const rp = defined(
				roomPlayers[i],
				`roomPlayers[${String(i)}] missing in onStart`,
			);

			if (rp.isCpu) {
				cpuCount++;
				const { displayName, personality } = generateAIPlayer(
					rp.playerId,
					state.nameDispenser,
				);
				state.players.set(rp.playerId, {
					playerId: rp.playerId,
					seatIndex: i,
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
				continue;
			}

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

		state.logger.log("game_start", null, {
			playerCount: roomPlayers.length,
			cpuCount,
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

		if (state.players.get(playerId)?.isAI) return noOp();

		const action = raw as PokerServerAction;
		if (!validateAction(state, playerId, action)) return noOp();

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
			remainingStack: defined(
				state.players.get(playerId),
				`player ${playerId} missing after action`,
			).stack,
			phase: state.phase,
			prevBetToCall,
		});
		updateOpponentRange(state, playerId, action, prevBetToCall, state.phase);
		return afterAction(state, room);
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as PokerServerState;

		if (BETTING_PHASES.has(state.phase)) {
			if (shouldAutoRunout(state)) {
				return dealNextRunoutStreet(state);
			}

			const playerId = state.seatOrder[state.currentPlayerIndex];
			if (!playerId) return makeResult(state, null);

			const player = defined(
				state.players.get(playerId),
				`player ${playerId} missing in onTimerExpired`,
			);

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

		if (state.phase === "showdown") {
			state.phase = "hand_end";
			return makeResult(state, {
				startsAt: Date.now(),
				duration: C.HAND_END_DURATION_MS,
			});
		}

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

		if (state.phase === "waiting") {
			const secrets = dealNewHand(state);

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

		return makeResult(state, null);
	},

	getPlayerSecret(ctx: GameContext, playerId: string): PokerSecret | null {
		const state = ctx.room.gamePayload as PokerServerState;
		const player = state.players.get(playerId);

		if (!player?.holeCards) return null;

		if (state.phase === "showdown" || state.phase === "hand_end") return null;

		return { holeCards: player.holeCards };
	},
};