import type {
	FaceturnServerPlayer,
	FaceturnServerState,
	PendingInteraction,
} from "../types";
import { CREW, isDraftable } from "../cards";
import { shuffle } from "../../lib/random";
import { markDeterminized, type DeterminizedState } from "./types";

function cloneMap<K, V>(source: ReadonlyMap<K, V>): Map<K, V> {
	return source.size === 0 ? new Map<K, V>() : new Map(source);
}

function cloneSet<T>(source: ReadonlySet<T>): Set<T> {
	return source.size === 0 ? new Set<T>() : new Set(source);
}

function cloneCrewClassOverrides<K, V>(
	source: ReadonlyMap<K, ReadonlySet<V>>,
): Map<K, Set<V>> {
	if (source.size === 0) return new Map<K, Set<V>>();
	const result = new Map<K, Set<V>>();
	for (const [slot, set] of source) {
		result.set(slot, cloneSet(set));
	}
	return result;
}

export function cloneServerState(
	state: FaceturnServerState,
): FaceturnServerState {
	const players = new Map<string, FaceturnServerPlayer>();
	for (const [id, p] of state.players) {
		players.set(id, clonePlayer(p));
	}

	return {
		...state,
		players,
		teams: state.teams.map((t) => [...t]),
		turnOrder: [...state.turnOrder],
		eliminatedPlayers: cloneSet(state.eliminatedPlayers),
		pendingAction: state.pendingAction ? { ...state.pendingAction } : null,
		challengeEligiblePlayerIds: [...state.challengeEligiblePlayerIds],
		moveChain: state.moveChain
			? {
					participants: [...state.moveChain.participants] as [string, string],
					stack: state.moveChain.stack.map((e) => ({ ...e })),
					responderId: state.moveChain.responderId,
				}
			: null,
		pendingInteraction: state.pendingInteraction
			? structuredCloneInteraction(state.pendingInteraction)
			: null,
		pendingDefendableStrikes: state.pendingDefendableStrikes.map((s) => ({
			...s,
		})),
		watcherReveal: state.watcherReveal
			? {
					forPlayerId: state.watcherReveal.forPlayerId,
					hand: [...state.watcherReveal.hand],
				}
			: null,
		rpsChoices: cloneMap(state.rpsChoices),
		// invalidate public state cache so the clone recomputes its own view
		_publicStateCacheValid: false,
		_cachedPublicState: null,
	};
}

function clonePlayer(p: FaceturnServerPlayer): FaceturnServerPlayer {
	return {
		...p,
		crewIds: [...p.crewIds] as [string | null, string | null],
		crewTurned: [...p.crewTurned] as [boolean, boolean],
		hand: [...p.hand],
		deck: [...p.deck],
		discardPile: [...p.discardPile],
		activeMoves: [...p.activeMoves],
		incomingPoison: cloneMap(p.incomingPoison),
		lifeInsuranceTargets: cloneMap(p.lifeInsuranceTargets),
		trickleDownTargets: cloneMap(p.trickleDownTargets),
		disabledPassiveSlots: cloneSet(p.disabledPassiveSlots),
		costOverrides: cloneMap(p.costOverrides),
		draftSelections: p.draftSelections
			? {
					bossId: p.draftSelections.bossId,
					crewIds: [...p.draftSelections.crewIds],
					moveIds: [...p.draftSelections.moveIds],
				}
			: null,
		derived: {
			...p.derived,
			crewClassOverrides: cloneCrewClassOverrides(p.derived.crewClassOverrides),
		},
	};
}

// shallow copy with shallow array copies; generic return type preserves input type without a cast
function structuredCloneInteraction<T extends PendingInteraction>(
	interaction: T,
): T {
	const typedClone: T = { ...interaction };
	const mutableView: Record<string, unknown> = typedClone;

	for (const key of Object.keys(mutableView)) {
		const value = mutableView[key];
		if (Array.isArray(value)) {
			mutableView[key] = value.map((entry: unknown) =>
				entry && typeof entry === "object" ? { ...entry } : entry,
			);
		}
	}

	return typedClone;
}

// pool for face-down crew determinization
const ALL_DRAFTABLE_CREW_IDS: readonly string[] = CREW.flatMap((c) =>
	isDraftable(c) ? [c.id] : [],
);

// must call fresh every tree descent; reusing a determinization across iterations would overfit the search to one guessed hand
export function determinize(
	state: FaceturnServerState,
	observerSeat: string,
	rng: () => number = Math.random,
): DeterminizedState {
	const next = cloneServerState(state);

	const pinnedTopOfDeck = pinDigDeepReveal(next);
	redealHiddenCardZones(next, observerSeat, pinnedTopOfDeck, rng);
	redealFaceDownCrew(next, observerSeat, rng);

	return markDeterminized(next);
}

// if a dig_deep_pick is live, pin its revealed top-of-deck cards so they survive the reshuffle
function pinDigDeepReveal(
	state: FaceturnServerState,
): Map<string, readonly string[]> {
	const pinned = new Map<string, readonly string[]>();
	const interaction = state.pendingInteraction;
	if (interaction?.type === "dig_deep_pick") {
		pinned.set(interaction.actorId, interaction.revealedCards);
	}
	return pinned;
}

// reshuffle opponents' hidden hand, deck, discard randomly while preserving zone sizes; pinned cards from live dig_deep_pick stay on top
function redealHiddenCardZones(
	state: FaceturnServerState,
	observerSeat: string,
	pinnedTopOfDeck: Map<string, readonly string[]>,
	rng: () => number = Math.random,
): void {
	for (const [seatId, player] of state.players) {
		if (seatId === observerSeat) continue;

		const handSize = player.hand.length;
		const deckSize = player.deck.length;
		const discardSize = player.discardPile.length;

		const pin = pinnedTopOfDeck.get(seatId) ?? [];
		const pinCounts = toCountMap(pin);

		// shuffle all unpinned cards, then place pinned cards at front of deck
		const rest = [
			...player.hand,
			...player.deck.filter((id) => consumeOne(pinCounts, id)),
			...player.discardPile,
		];
		const shuffledRest = shuffle(rest, rng);

		const newDeck = [...pin, ...shuffledRest.slice(0, deckSize - pin.length)];
		const remainder = shuffledRest.slice(deckSize - pin.length);

		player.hand = remainder.slice(0, handSize);
		player.discardPile = remainder.slice(handSize, handSize + discardSize);
		player.deck = newDeck;
	}
}

function toCountMap(ids: readonly string[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
	return counts;
}

// consume a pinned copy if any remain; returns true if the card should stay in the shuffle pool
function consumeOne(pinCounts: Map<string, number>, id: string): boolean {
	const remaining = pinCounts.get(id) ?? 0;
	if (remaining > 0) {
		pinCounts.set(id, remaining - 1);
		return false;
	}
	return true;
}

// assign hidden face-down crew identities from a pool of unobserved draftable crew
// intentionally overcounts the pool to avoid leaking information the observer didn't have
function redealFaceDownCrew(
	state: FaceturnServerState,
	observerSeat: string,
	rng: () => number = Math.random,
): void {
	const visible = new Set<string>();
	for (const player of state.players.values()) {
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (player.crewIds[slot] && player.crewTurned[slot]) {
				visible.add(player.crewIds[slot]);
			}
		}
		for (const id of player.reserveCrewIds) {
			if (id) visible.add(id);
		}
	}

	const observer = state.players.get(observerSeat);
	if (observer) {
		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (observer.crewIds[slot]) visible.add(observer.crewIds[slot]);
		}
		for (const id of observer.reserveCrewIds) {
			if (id) visible.add(id);
		}
	}

	const pool = shuffle(
		ALL_DRAFTABLE_CREW_IDS.filter((id) => !visible.has(id)),
		rng,
	);

	for (const [seatId, player] of state.players) {
		if (seatId === observerSeat) continue;

		for (let i = 0; i < 2; i++) {
			const slot = i as 0 | 1;
			if (!player.crewIds[slot] || player.crewTurned[slot]) continue;

			const drawn = pool.pop();
			if (drawn) {
				player.crewIds[slot] = drawn;
			}
			// fallback: if pool is exhausted, keep the original hidden id
		}

		for (let i = 0; i < player.reserveCrewIds.length; i++) {
			const id = player.reserveCrewIds[i];
			if (id && !visible.has(id)) {
				const drawn = pool.pop();
				if (drawn) player.reserveCrewIds[i] = drawn;
			}
		}
	}
}