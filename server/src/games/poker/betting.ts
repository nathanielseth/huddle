import type {
	PokerServerState,
	PokerServerPlayer,
	PokerServerAction,
	SidePot,
} from "./types.js";
import type { PokerConstantsShape } from "./constants.js";
import { burnOne, dealN, dealOne } from "./deck.js";

// seat navigation (private)

// finds next seat with matching status, starting from dealer + offset
function findSeatFrom(
	state: PokerServerState,
	startOffset: number,
	matchStatus: "active",
): number {
	const { seatOrder, players, dealerIndex } = state;
	const count = seatOrder.length;

	for (let i = 0; i < count; i++) {
		const idx = (dealerIndex + startOffset + i) % count;
		const player = players.get(seatOrder[idx]!)!;
		if (player.status === matchStatus) return idx;
	}

	return -1;
}

// seat position queries

// seatOrder index of small blind. heads-up (2 players): dealer IS sb
export function getSmallBlindIndex(state: PokerServerState): number {
	return countActivePlayers(state) === 2
		? state.dealerIndex
		: findSeatFrom(state, 1, "active");
}

// seatOrder index of big blind. heads-up: non-dealer posts bb
export function getBigBlindIndex(state: PokerServerState): number {
	return countActivePlayers(state) === 2
		? findSeatFrom(state, 1, "active")
		: findSeatFrom(state, 2, "active");
}

// first to act pre-flop after blinds. heads-up: dealer/sb acts first
export function getPreFlopStartIndex(state: PokerServerState): number {
	return countActivePlayers(state) === 2
		? findSeatFrom(state, 0, "active")
		: findSeatFrom(state, 3, "active");
}

// first to act on flop/turn/river. always first active left of dealer
export function getPostFlopStartIndex(state: PokerServerState): number {
	return findSeatFrom(state, 1, "active");
}

// players who can act this street (not folded, not allin, not out)
export function countActivePlayers(state: PokerServerState): number {
	let n = 0;
	for (const p of state.players.values()) if (p.status === "active") n++;
	return n;
}

// players still contesting the hand (active or allin — not folded, not out)
export function countInHandPlayers(state: PokerServerState): number {
	let n = 0;
	for (const p of state.players.values()) {
		if (p.status === "active" || p.status === "allin") n++;
	}
	return n;
}

export function getNonFoldedPlayerIds(state: PokerServerState): string[] {
	return [...state.players.values()]
		.filter((p) => p.status === "active" || p.status === "allin")
		.map((p) => p.playerId);
}

// finds next player who must act
export function getNextPlayerIndex(state: PokerServerState): number {
	const { seatOrder, players, currentPlayerIndex, betting } = state;
	const count = seatOrder.length;

	for (let i = 1; i <= count; i++) {
		const idx = (currentPlayerIndex + i) % count;
		const player = players.get(seatOrder[idx]!)!;

		if (player.status !== "active") continue;

		const needsToAct =
			!player.hasActedThisRound || player.currentBet < betting.betToCall;

		if (needsToAct) return idx;
	}

	return -1;
}

// true when no active player has a pending action this street
export function isBettingRoundOver(state: PokerServerState): boolean {
	return getNextPlayerIndex(state) === -1;
}

// side pot computation

// recalculates side pots after all-ins. call before showdown.
export function computeSidePots(state: PokerServerState): void {
	const allPlayers = state.seatOrder
		.map((id) => state.players.get(id)!)
		.filter((p) => p.totalContributed > 0);

	const allinLevels: number[] = [
		...new Set(
			allPlayers
				.filter((p) => p.status === "allin")
				.map((p) => p.totalContributed),
		),
	].sort((a, b) => a - b);

	const pots: SidePot[] = [];
	let prevLevel = 0;

	for (const level of allinLevels) {
		let sliceAmount = 0;
		const eligible: string[] = [];

		for (const p of allPlayers) {
			const lo = Math.min(p.totalContributed, prevLevel);
			const hi = Math.min(p.totalContributed, level);
			sliceAmount += hi - lo;

			if (p.status !== "folded" && p.totalContributed >= level) {
				eligible.push(p.playerId);
			}
		}

		if (sliceAmount > 0) {
			pots.push({ amount: sliceAmount, eligiblePlayerIds: eligible });
		}

		prevLevel = level;
	}

	// remainder / main pot
	{
		let amount = 0;
		const eligible: string[] = [];

		for (const p of allPlayers) {
			amount += p.totalContributed - Math.min(p.totalContributed, prevLevel);
			if (p.status !== "folded" && p.totalContributed > prevLevel) {
				eligible.push(p.playerId);
			}
		}

		if (amount > 0) {
			pots.push({ amount, eligiblePlayerIds: eligible });
		}
	}

	state.pots = pots;
}

function postBlind(player: PokerServerPlayer, amount: number): void {
	const actual = Math.min(amount, player.stack);
	player.stack -= actual;
	player.currentBet = actual;
	player.totalContributed = actual;

	if (player.stack === 0) {
		player.status = "allin";
	}
}

// posts sb and bb at hand start. mutates sb/bb players, sets betting.betToCall
// betToCall floor of BIG_BLIND means even if bb can't cover, others still pay full bb
export function postBlinds(
	state: PokerServerState,
	C: PokerConstantsShape,
): void {
	const sbIdx = getSmallBlindIndex(state);
	const bbIdx = getBigBlindIndex(state);

	const sbId = state.seatOrder[sbIdx]!;
	const bbId = state.seatOrder[bbIdx]!;

	const sb = state.players.get(sbId)!;
	const bb = state.players.get(bbId)!;

	postBlind(sb, C.SMALL_BLIND);
	postBlind(bb, C.BIG_BLIND);

	state.betting.betToCall = Math.max(sb.currentBet, bb.currentBet, C.BIG_BLIND);
	state.betting.lastRaiseIncrement = C.BIG_BLIND;
	state.betting.lastRaiserId = null;

	if (sb.status === "allin" || bb.status === "allin") {
		computeSidePots(state);
	}
}

// action validation

// true if action is legal for playerId. called by index.ts before applyAction
export function validateAction(
	state: PokerServerState,
	playerId: string,
	action: PokerServerAction,
): boolean {
	if (state.seatOrder[state.currentPlayerIndex] !== playerId) return false;

	const player = state.players.get(playerId);
	if (!player || player.status !== "active") return false;

	const { betting } = state;

	switch (action.type) {
		case "fold":
			return true;

		case "check":
			return player.currentBet >= betting.betToCall;

		case "call":
			return player.currentBet < betting.betToCall && player.stack > 0;

		case "raise": {
			if (!player.canRaise) return false;
			if (player.stack === 0) return false;

			const { amount } = action;
			const minRaiseTo = betting.betToCall + betting.lastRaiseIncrement;
			const maxRaiseTo = player.stack + player.currentBet;

			return amount >= minRaiseTo && amount <= maxRaiseTo;
		}

		case "all_in":
			return player.stack > 0;
	}
}

// action application (private helpers)

function applyFold(state: PokerServerState, player: PokerServerPlayer): void {
	player.status = "folded";
	player.hasActedThisRound = true;
}

function applyCheck(state: PokerServerState, player: PokerServerPlayer): void {
	player.hasActedThisRound = true;
}

function applyCall(state: PokerServerState, player: PokerServerPlayer): void {
	const callAmount = Math.min(
		state.betting.betToCall - player.currentBet,
		player.stack,
	);

	player.stack -= callAmount;
	player.currentBet += callAmount;
	player.totalContributed += callAmount;
	player.hasActedThisRound = true;

	if (player.stack === 0) {
		player.status = "allin";
		computeSidePots(state);
	}
}

function applyRaise(
	state: PokerServerState,
	player: PokerServerPlayer,
	totalAmount: number,
): void {
	const chips = totalAmount - player.currentBet;
	const increment = totalAmount - state.betting.betToCall;

	player.stack -= chips;
	player.currentBet = totalAmount;
	player.totalContributed += chips;
	player.hasActedThisRound = true;

	state.betting.betToCall = totalAmount;
	state.betting.lastRaiseIncrement = increment;
	state.betting.lastRaiserId = player.playerId;

	// full raise reopens action for all other active players
	for (const [pid, p] of state.players) {
		if (pid === player.playerId) continue;
		if (p.status !== "active") continue;
		p.hasActedThisRound = false;
		p.canRaise = true;
	}
}

function applyAllIn(state: PokerServerState, player: PokerServerPlayer): void {
	const totalAmount = player.stack + player.currentBet;
	const chips = player.stack;
	const prevBetToCall = state.betting.betToCall;

	player.totalContributed += chips;
	player.currentBet = totalAmount;
	player.stack = 0;
	player.status = "allin";
	player.hasActedThisRound = true;

	// case 1: call all-in (can't raise). betToCall unchanged, no reopening.
	if (totalAmount <= prevBetToCall) {
		computeSidePots(state);
		return;
	}

	// case 2: all-in raises betToCall
	const increment = totalAmount - prevBetToCall;
	state.betting.betToCall = totalAmount;

	const isFullRaise = increment >= state.betting.lastRaiseIncrement;

	if (isFullRaise) {
		// case 2a: full raise - reopens for everyone
		state.betting.lastRaiseIncrement = increment;
		state.betting.lastRaiserId = player.playerId;

		for (const [pid, p] of state.players) {
			if (pid === player.playerId) continue;
			if (p.status !== "active") continue;
			p.hasActedThisRound = false;
			p.canRaise = true;
		}
	} else {
		// case 2b: incomplete raise - betToCall up, but not a full raise
		// players who already acted: can call/fold only (canRaise = false)
		// players who haven't acted: full options, no flag changes needed
		// lastRaiseIncrement and lastRaiserId NOT updated
		for (const [pid, p] of state.players) {
			if (pid === player.playerId) continue;
			if (p.status !== "active") continue;

			if (p.hasActedThisRound) {
				p.canRaise = false;
			}
		}
	}

	computeSidePots(state);
}

// applies a validated action
export function applyAction(
	state: PokerServerState,
	playerId: string,
	action: PokerServerAction,
): void {
	const player = state.players.get(playerId)!;

	switch (action.type) {
		case "fold":
			return applyFold(state, player);
		case "check":
			return applyCheck(state, player);
		case "call":
			return applyCall(state, player);
		case "raise":
			return applyRaise(state, player, action.amount);
		case "all_in":
			return applyAllIn(state, player);
	}
}

// resets per-player and betting state for a new street
export function resetForNewStreet(
	state: PokerServerState,
	C: PokerConstantsShape,
): void {
	for (const player of state.players.values()) {
		if (player.status === "folded" || player.status === "out") continue;
		player.currentBet = 0;
		player.hasActedThisRound = false;
		player.canRaise = true;
	}

	state.betting = {
		betToCall: 0,
		lastRaiseIncrement: C.BIG_BLIND,
		lastRaiserId: null,
	};
}

// deals community cards for the street we're transitioning to call while state.phase is still the CURRENT street
export function dealCommunityCards(state: PokerServerState): void {
	switch (state.phase) {
		case "pre_flop":
			burnOne(state.deck);
			state.communityCards.push(...dealN(state.deck, 3));
			break;

		case "flop":
		case "turn":
			burnOne(state.deck);
			state.communityCards.push(dealOne(state.deck));
			break;

		case "river":
			break;

		default:
			throw new Error(
				`[poker/betting] dealCommunityCards called in unexpected phase: ${state.phase}`,
			);
	}
}

// advances dealer button to next non-out player
export function advanceDealerButton(state: PokerServerState): void {
	const { seatOrder, players, dealerIndex } = state;
	const count = seatOrder.length;

	for (let i = 1; i <= count; i++) {
		const idx = (dealerIndex + i) % count;
		const player = players.get(seatOrder[idx]!)!;
		if (player.status !== "out") {
			state.dealerIndex = idx;
			return;
		}
	}
}

// resets per-hand state for all non-out players
export function resetPlayersForNewHand(state: PokerServerState): void {
	for (const player of state.players.values()) {
		if (player.status === "out") continue;
		player.status = "active";
		player.holeCards = null;
		player.currentBet = 0;
		player.totalContributed = 0;
		player.hasActedThisRound = false;
		player.canRaise = true;
		player.isDealer = false;
	}

	state.communityCards = [];
	state.pots = [];
	state.lastAction = null;
	state.currentPlayerIndex = -1;
}
