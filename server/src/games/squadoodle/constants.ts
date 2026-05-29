export const C = {
	// phase timers (ms)
	PROMPT_WRITING_MS: 60_000,
	DRAWING_MS: 90_000,
	GUESSING_MS: 45_000,

	// time each entry is shown before auto-advancing
	REVEAL_ENTRY_MS: 6_000,
	// extra pause between chains
	REVEAL_CHAIN_PAUSE_MS: 4_000,

	// accolades screen stays up until host calls play_again or timer elapses
	ACCOLADES_MS: 120_000,

	MIN_PLAYERS: 4,
	MAX_PLAYERS: 12,

	// payload size limits. worst-case: MAX_STROKES × MAX_POINTS_PER_STROKE × 3
	// values (x, y, pressure) × ~7 chars each ≈ 1.26 MB uncompressed. socket.io
	// permessage-deflate compresses repetitive float data well, wire size typically
	// under 200 KB. integer coordinates (enforced by schema) compress further
	MAX_STROKES: 100,
	MAX_POINTS_PER_STROKE: 600,

	MAX_PROMPT_LENGTH: 120,
	MAX_GUESS_LENGTH: 120,
	MAX_STROKE_SIZE: 64,
} as const;

// kept separate — regex literals cannot appear inside `as const` objects
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;