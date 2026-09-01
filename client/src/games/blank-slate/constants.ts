// Mirrors server/src/games/blank-slate/constants.ts — the server is the
// source of truth and re-validates regardless; these exist purely so
// inputs can cap length and show a live counter without a round trip.
export const MAX_CLUE_LENGTH = 50;
export const MAX_GUESS_LENGTH = 50;

export const MEDALS = ["🥇", "🥈", "🥉"] as const;

export const roundLabel = (round: number, total: number) =>
	`Round ${round} of ${total}`;
