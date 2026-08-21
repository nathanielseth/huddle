import { BOSS_DISPLAY, CREW_DISPLAY, MOVE_DISPLAY } from "./card-display";
import { FACETURN_CONSTANTS } from "./constants";

// deck codes: fixed width indices into display tables, crc8 checksum, base32; append only, bump version on reorder
const NONE_INDEX = 0xff;
const CREW_SLOT_COUNT = 3; // max crew slots across all bosses
const MOVE_SLOT_COUNT = FACETURN_CONSTANTS.MOVES_PER_DECK;

interface CodeTable {
	readonly boss: readonly string[];
	readonly crew: readonly string[];
	readonly move: readonly string[];
}

const CODE_TABLES_BY_VERSION: Readonly<Record<number, CodeTable>> = {
	1: {
		boss: BOSS_DISPLAY.map((b) => b.id),
		crew: CREW_DISPLAY.map((c) => c.id),
		move: MOVE_DISPLAY.map((m) => m.id),
	},
};

export const CURRENT_DECK_CODE_VERSION = 1;

// cheap typo detection, not cryptographic
function crc8(bytes: readonly number[]): number {
	let crc = 0x00;
	for (const byte of bytes) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) {
			crc = (crc & 0x80) !== 0 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
		}
	}
	return crc;
}

const B32_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const B32_LOOKUP: Readonly<Record<string, number>> = Object.fromEntries(
	B32_ALPHABET.split("").map((char, i) => [char, i]),
);

function bytesToBase32(bytes: readonly number[]): string {
	let bits = 0;
	let value = 0;
	let out = "";
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += B32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
			bits -= 5;
		}
	}
	if (bits > 0) {
		out += B32_ALPHABET[(value << (5 - bits)) & 0x1f];
	}
	return out;
}

function base32ToBytes(input: string): number[] | null {
	let bits = 0;
	let value = 0;
	const out: number[] = [];
	// normalize common confusable characters before lookup
	const normalized = input
		.toUpperCase()
		.replace(/O/g, "0")
		.replace(/[IL]/g, "1");
	for (const char of normalized) {
		const digit = B32_LOOKUP[char];
		if (digit === undefined) return null;
		value = (value << 5) | digit;
		bits += 5;
		if (bits >= 8) {
			out.push((value >>> (bits - 8)) & 0xff);
			bits -= 8;
		}
	}
	return out;
}

export interface DraftSelection {
	bossId: string | null;
	crewIds: string[];
	moveIds: string[];
}

export type DeckDecodeError =
	| "empty"
	| "malformed"
	| "checksum_mismatch"
	| "unsupported_version";

export type DeckDecodeResult =
	| { ok: true; deck: DraftSelection }
	| { ok: false; error: DeckDecodeError };

const CODE_PREFIX = `FT${CURRENT_DECK_CODE_VERSION}`;

export function encodeDeckCode(selection: DraftSelection): string {
	const table = CODE_TABLES_BY_VERSION[CURRENT_DECK_CODE_VERSION];
	if (!table) {
		throw new Error(
			`No deck code table registered for current version ${CURRENT_DECK_CODE_VERSION}`,
		);
	}
	const bytes: number[] = [CURRENT_DECK_CODE_VERSION];

	const bossIndex = selection.bossId
		? table.boss.indexOf(selection.bossId)
		: -1;
	bytes.push(bossIndex >= 0 ? bossIndex : NONE_INDEX);

	const crewIndices = selection.crewIds
		.map((id) => table.crew.indexOf(id))
		.filter((i) => i >= 0)
		.slice(0, CREW_SLOT_COUNT);
	for (let i = 0; i < CREW_SLOT_COUNT; i++) {
		bytes.push(crewIndices[i] ?? NONE_INDEX);
	}

	const moveIndices = selection.moveIds
		.map((id) => table.move.indexOf(id))
		.filter((i) => i >= 0)
		.slice(0, MOVE_SLOT_COUNT);
	for (let i = 0; i < MOVE_SLOT_COUNT; i++) {
		bytes.push(moveIndices[i] ?? NONE_INDEX);
	}

	bytes.push(crc8(bytes));

	return `${CODE_PREFIX}${bytesToBase32(bytes)}`;
}

export function decodeDeckCode(code: string): DeckDecodeResult {
	const trimmed = code.trim();
	if (!trimmed) return { ok: false, error: "empty" };

	// strip only a known "ft<version>" label, not greedy digits, because base32 payload can start with digits and has no delimiter
	const knownVersions = Object.keys(CODE_TABLES_BY_VERSION)
		.map(Number)
		.sort((a, b) => b - a);
	let withoutPrefix = trimmed;
	for (const version of knownVersions) {
		const label = `FT${version}`;
		if (trimmed.slice(0, label.length).toUpperCase() === label) {
			withoutPrefix = trimmed.slice(label.length).replace(/^-/, "");
			break;
		}
	}
	const bytes = base32ToBytes(withoutPrefix.replace(/[\s-]/g, ""));

	const expectedLength = 1 + 1 + CREW_SLOT_COUNT + MOVE_SLOT_COUNT + 1;
	if (!bytes || bytes.length < expectedLength) {
		return { ok: false, error: "malformed" };
	}

	const payload = bytes.slice(0, expectedLength - 1);
	const checksum = bytes[expectedLength - 1];
	if (crc8(payload) !== checksum) {
		return { ok: false, error: "checksum_mismatch" };
	}

	const version = payload[0];
	const table =
		version !== undefined ? CODE_TABLES_BY_VERSION[version] : undefined;
	if (!table) return { ok: false, error: "unsupported_version" };

	const bossByte = payload[1];
	const bossId =
		bossByte !== undefined && bossByte !== NONE_INDEX
			? (table.boss[bossByte] ?? null)
			: null;

	const crewIds: string[] = [];
	for (let i = 0; i < CREW_SLOT_COUNT; i++) {
		const byte = payload[2 + i];
		if (byte === undefined || byte === NONE_INDEX) continue;
		const id = table.crew[byte];
		if (id) crewIds.push(id);
	}

	const moveIds: string[] = [];
	const moveStart = 2 + CREW_SLOT_COUNT;
	for (let i = 0; i < MOVE_SLOT_COUNT; i++) {
		const byte = payload[moveStart + i];
		if (byte === undefined || byte === NONE_INDEX) continue;
		const id = table.move[byte];
		if (id) moveIds.push(id);
	}

	return { ok: true, deck: { bossId, crewIds, moveIds } };
}