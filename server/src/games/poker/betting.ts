import type {
	PokerServerState,
	PokerServerPlayer,
	PokerServerAction,
	SidePot,
} from "./types";
import type { PokerConstantsShape } from "./constants";
import { burnOne, dealN, dealOne } from "./deck";

// starting at dealerindex + startoffset, walks seatorder skipping out players until finding one with matching status, returns seatorder index or -1
function findNthActive(state: PokerServerState, n: number): number {
	const { seatOrder, players, dealerIndex } = state;
	const count = seatOrder.length;
	let found = 0;

	for (let i = 1; i <= count; i++) {
		const idx = (dealerIndex + i) % count;
		const player = players.get(seatOrder[idx]!);
		if (player && player.status === "active") {
			found++;
			if (found === n) return idx;
		}
	}

	return -1;
}

// standard (3+ players): one seat left of dealer. heads-up: dealer is sb
export function getSmallBlindIndex(state: PokerServerState): number {
	return countActivePlayers(state) === 2
		? state.dealerIndex
		: findNthActive(state, 1);
}

// standard: two seats left of dealer. heads-up: non-dealer posts bb
export function getBigBlindIndex(state: PokerServerState): number {
	return countActivePlayers(state) === 2
		? findNthActive(state, 1)
		: findNthActive(state, 2);
}

// first to act pre-flop after blinds. standard: utg (3 left of dealer). heads-up: dealer/sb acts first
// betting.ts — replace getpreflopstartindex

export function getPreFlopStartIndex(state: PokerServerState): number {
	const inHand = countInHandPlayers(state);

	// shouldn't happen at hand start, but guard so -1 routes to shouldautorunout
	if (inHand <= 1) return -1;

	if (inHand === 2) {
		// hu rule: dealer/sb acts first pre-flop.
		// if the dealer went all-in posting the sb, slide to the first active seat.
		// if both are all-in, return -1 so afteraction triggers shouldautorunout
		const dealer = state.players.get(state.seatOrder[state.dealerIndex]!);
		return dealer?.status === "active"
			? state.dealerIndex
			: findNthActive(state, 1); // -1 when both all-in → correct
	}

	// 3+ in-hand players: utg (3rd seat clockwise from dealer) acts first.
	// fall back to the first active seat when some blinds went all-in posting (e.g. stack < big_blind), reducing active count below 3
	const utg = findNthActive(state, 3);
	return utg !== -1 ? utg : findNthActive(state, 1);
}

// first to act on flop/turn/river. always first active left of dealer
export function getPostFlopStartIndex(state: PokerServerState): number {
	return findNthActive(state, 1);
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

// all non-folded player ids, used by showdown
export function getNonFoldedPlayerIds(state: PokerServerState): string[] {
	const ids: string[] = [];
	for (const p of state.players.values()) {
		if (p.status === "active" || p.status === "allin") ids.push(p.playerId);
	}
	return ids;
}

// finds next player who must act, searching forward from currentplayerindex.
// a player must act if: status === 'active' and (hasactedthisround === false or currentbet < bettocall). returns -1 when betting round is over
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

// rebuilds state.pots using contribution-level sweep. mutates in place.
// must be called after every all-in and before showdown.
//
// for each unique all-in contribution level l (sorted):
//   contribution = clamp(total, l) - clamp(total, prevl)
//   eligible = non-folded players with totalcontributed >= l
// remainder above highest all-in level works the same
export function computeSidePots(state: PokerServerState): void {
	const allPlayers: PokerServerPlayer[] = [];
	for (const id of state.seatOrder) {
		const p = state.players.get(id)!;
		if (p.totalContributed > 0 && p.status !== "out") allPlayers.push(p);
	}

	const allinLevelsSet = new Set<number>();
	for (const p of allPlayers) {
		if (p.status === "allin") allinLevelsSet.add(p.totalContributed);
	}
	const allinLevels = [...allinLevelsSet].toSorted((a, b) => a - b);

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

	// main pot (or sole pot if no all-ins): all contributions above prevlevel
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

// posts a forced blind for one player. caps at stack. does not set hasactedthisround
function postBlind(player: PokerServerPlayer, amount: number): void {
	const actual = Math.min(amount, player.stack);
	player.stack -= actual;
	player.currentBet = actual;
	player.totalContributed = actual;

	if (player.stack === 0) {
		player.status = "allin";
	}
}

// posts sb and bb at hand start. bettocall floor of big_blind ensures even if bb can't cover, others still pay full bb
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

// true if action is legal for playerid. called by index.ts before applyaction
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

			return amount >= minRaiseTo && amount < maxRaiseTo;
		}

		case "all_in":
			return player.stack > 0;
	}
}

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

	if (player.stack === 0) {
		player.status = "allin";
		computeSidePots(state);
		return;
	}

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

	// case 1: call all-in (can't raise). bettocall unchanged, no reopening
	if (totalAmount <= prevBetToCall) {
		computeSidePots(state);
		return;
	}

	// case 2: all-in raises bettocall
	const increment = totalAmount - prevBetToCall;
	state.betting.betToCall = totalAmount;

	const isFullRaise = increment >= state.betting.lastRaiseIncrement;

	if (isFullRaise) {
		// case 2a: full raise — reopens for everyone
		state.betting.lastRaiseIncrement = increment;
		state.betting.lastRaiserId = player.playerId;

		for (const [pid, p] of state.players) {
			if (pid === player.playerId) continue;
			if (p.status !== "active") continue;
			p.hasActedThisRound = false;
			p.canRaise = true;
		}
	} else {
		// case 2b: incomplete raise — bettocall up, not a full raise.
		// players who already acted: can call/fold only (canraise = false).
		// players who haven't acted: full options, no flag changes needed.
		// lastraiseincrement and lastraiserid not updated
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

// applies a validated action. precondition: validateaction returned true.
// caller (index.ts) updates lastaction, currentplayerindex, and detects if the betting round is over
export function applyAction(
	state: PokerServerState,
	playerId: string,
	action: PokerServerAction,
): void {
	const player = state.players.get(playerId)!;

	switch (action.type) {
		case "fold":
			{ applyFold(state, player); return; }
		case "check":
			{ applyCheck(state, player); return; }
		case "call":
			{ applyCall(state, player); return; }
		case "raise":
			{ applyRaise(state, player, action.amount); return; }
		case "all_in":
			{ applyAllIn(state, player); return; }
	}
}

// resets per-player and betting state for a new street. call after changing state.phase, before setting currentplayerindex
export function resetForNewStreet(
	state: PokerServerState,
	C: PokerConstantsShape,
): void {
	state.pfAggressorId = state.betting.lastRaiserId;

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

// deals community cards for the street we're transitioning to. call while state.phase is still the current street, before index.ts updates it
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

// resets per-hand state for all non-out players. called before postblinds.
// players with 0 stack are marked 'out' permanently
export function resetPlayersForNewHand(state: PokerServerState): void {
	for (const player of state.players.values()) {
		if (player.status === "out") continue;

		if (player.stack === 0) {
			player.status = "out";
			player.holeCards = null;
			player.currentBet = 0;
			player.totalContributed = 0;
			continue;
		}

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
	state.pfAggressorId = null;
}