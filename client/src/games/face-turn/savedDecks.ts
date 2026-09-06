import { BOSS_DISPLAY_MAP } from "@shared/games/face-turn/card-display";
export interface SavedDeck {
	id: string;
	name: string;
	bossId: string | null;
	crewIds: string[];
	moveIds: string[];
	thumbnailArtSrc?: string;
	savedAt: number;
}

type Selections = {
	bossId: string | null;
	crewIds: readonly string[];
	moveIds: readonly string[];
};

const STORAGE_KEY = "huddle_faceturn_decks:v1";
const MAX_SAVED_DECKS = 20;
const RECENT_STORAGE_KEY = "huddle_faceturn_recent_decks:v1";
const MAX_RECENT_DECKS = 3;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
	for (const listener of listeners) listener();
}

// also fires on native storage event, so other tabs stay in sync
export function subscribe(listener: Listener): () => void {
	listeners.add(listener);
	if (listeners.size === 1) {
		window.addEventListener("storage", handleStorageEvent);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0) {
			window.removeEventListener("storage", handleStorageEvent);
		}
	};
}

function handleStorageEvent(e: StorageEvent): void {
	if (e.key === STORAGE_KEY || e.key === RECENT_STORAGE_KEY) notify();
}

function isSavedDeck(v: unknown): v is SavedDeck {
	if (typeof v !== "object" || v === null) return false;
	const d = v as Record<string, unknown>;
	return (
		typeof d.id === "string" &&
		typeof d.name === "string" &&
		(d.bossId === null || typeof d.bossId === "string") &&
		Array.isArray(d.crewIds) &&
		Array.isArray(d.moveIds) &&
		(d.thumbnailArtSrc === undefined ||
			typeof d.thumbnailArtSrc === "string") &&
		typeof d.savedAt === "number"
	);
}

function readFrom(key: string): SavedDeck[] {
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isSavedDeck);
	} catch {
		return [];
	}
}

// returns false on quota/storage errors so callers can show a message
function writeTo(key: string, decks: SavedDeck[]): boolean {
	try {
		localStorage.setItem(key, JSON.stringify(decks));
		notify();
		return true;
	} catch {
		return false;
	}
}

const readAll = () => readFrom(STORAGE_KEY);
const writeAll = (decks: SavedDeck[]) => writeTo(STORAGE_KEY, decks);

export function listSavedDecks(): SavedDeck[] {
	// newest first, most recently saved is most likely wanted
	return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

// falls back to the boss's name when the player leaves the name blank
function autoDeckName(selections: Selections): string {
	if (selections.bossId) {
		const boss = BOSS_DISPLAY_MAP.get(selections.bossId);
		if (boss) return boss.name;
	}
	return "Untitled draft";
}

// thumbnail default for saves that skip the picker entirely
function autoThumbnail(selections: Selections): string | undefined {
	if (!selections.bossId) return undefined;
	return BOSS_DISPLAY_MAP.get(selections.bossId)?.artSrc;
}

export function saveDeck(
	name: string,
	selections: Selections,
	thumbnailArtSrc?: string,
): SavedDeck | null {
	const decks = readAll();
	const entry: SavedDeck = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		name: name.trim() || autoDeckName(selections),
		bossId: selections.bossId,
		crewIds: [...selections.crewIds],
		moveIds: [...selections.moveIds],
		thumbnailArtSrc: thumbnailArtSrc ?? autoThumbnail(selections),
		savedAt: Date.now(),
	};
	decks.push(entry);
	// cap with oldest first eviction
	decks.sort((a, b) => a.savedAt - b.savedAt);
	while (decks.length > MAX_SAVED_DECKS) decks.shift();
	return writeAll(decks) ? entry : null;
}

export function deleteSavedDeck(id: string): boolean {
	return writeAll(readAll().filter((d) => d.id !== id));
}

function sameSelections(a: SavedDeck, b: Selections): boolean {
	if (a.bossId !== b.bossId) return false;
	if (a.crewIds.length !== b.crewIds.length) return false;
	if (a.moveIds.length !== b.moveIds.length) return false;
	const crewA = [...a.crewIds].sort();
	const crewB = [...b.crewIds].sort();
	const moveA = [...a.moveIds].sort();
	const moveB = [...b.moveIds].sort();
	return (
		crewA.every((id, i) => id === crewB[i]) &&
		moveA.every((id, i) => id === moveB[i])
	);
}

export function listRecentDecks(): SavedDeck[] {
	return readFrom(RECENT_STORAGE_KEY).sort((a, b) => b.savedAt - a.savedAt);
}

// call as the draft changes (debounced by the caller)
// most recent entry so mid-edit churn doesn't spam the list
// silently no-ops on an empty draft
export function recordRecentDeck(selections: Selections): void {
	if (
		!selections.bossId &&
		selections.crewIds.length === 0 &&
		selections.moveIds.length === 0
	) {
		return;
	}
	const decks = readFrom(RECENT_STORAGE_KEY).sort(
		(a, b) => b.savedAt - a.savedAt,
	);
	const [mostRecent] = decks;
	if (mostRecent && sameSelections(mostRecent, selections)) {
		mostRecent.savedAt = Date.now();
		writeTo(RECENT_STORAGE_KEY, decks);
		return;
	}
	const entry: SavedDeck = {
		id: `recent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		name: autoDeckName(selections),
		bossId: selections.bossId,
		crewIds: [...selections.crewIds],
		moveIds: [...selections.moveIds],
		thumbnailArtSrc: autoThumbnail(selections),
		savedAt: Date.now(),
	};
	decks.unshift(entry);
	while (decks.length > MAX_RECENT_DECKS) decks.pop();
	writeTo(RECENT_STORAGE_KEY, decks);
}

export function deleteRecentDeck(id: string): boolean {
	return writeTo(
		RECENT_STORAGE_KEY,
		readFrom(RECENT_STORAGE_KEY).filter((d) => d.id !== id),
	);
}