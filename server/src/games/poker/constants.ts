export const POKER_CONSTANTS = {
	// chips
	STARTING_STACK: 1_000,
	SMALL_BLIND: 10,
	BIG_BLIND: 20,

	// per-player action window
	TURN_DURATION_MS: 30_000,

	// between hands: show last result, rotate button, prep next deal
	WAITING_DURATION_MS: 8_000,

	// showdown display: reveal cards, hand names, pot distribution animation
	SHOWDOWN_DURATION_MS: 6_000,

	// hand-end splash before next waiting phase
	HAND_END_DURATION_MS: 4_000,

	// table constraints
	MIN_PLAYERS: 2,
	MAX_PLAYERS: 8,
} as const;

export type PokerConstantsShape = typeof POKER_CONSTANTS;
