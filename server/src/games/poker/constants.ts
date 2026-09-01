export const POKER_CONSTANTS = {
	// chips
	STARTING_STACK: 1_000,
	SMALL_BLIND: 10,
	BIG_BLIND: 20,

	// timers
	// these drive engineresult timer, calls ontimerexpired at zero
	// per-player action window, fires auto-fold or auto-check
	TURN_DURATION_MS: 30_000,

	// time between revealing flop/turn/river for cinematic all-in runout
	RUNOUT_STREET_DURATION_MS: 2_500,

	// between hands, show result, rotate button, prep next deal
	WAITING_DURATION_MS: 5_000,

	// showdown display, reveal cards, show hand names, animate pot - long enough for client animations
	SHOWDOWN_DURATION_MS: 5_000,

	// hand-end splash before waiting phase, brief because showdown already seen
	HAND_END_DURATION_MS: 1_000,

	// table constraints
	MIN_PLAYERS: 2,
	MAX_PLAYERS: 8,
} as const;

export type PokerConstantsShape = typeof POKER_CONSTANTS;