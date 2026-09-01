// client only draft presets, localStorage backed, server validates card ids on load
export interface SavedDeck {
	id: string;
	name: string;
	bossId: string | null;
	crewIds: string[];
	moveIds: string[];
	savedAt: number;
}

const STORAGE_KEY = "huddle_faceturn_decks:v1";
const MAX_SAVED_DECKS = 20;

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
	if (e.key === STORAGE_KEY) notify();
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
		typeof d.savedAt === "number"
	);
}

function readAll(): SavedDeck[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isSavedDeck);
	} catch {
		return [];
	}
}

// returns false on quota/storage errors so callers can show a message
function writeAll(decks: SavedDeck[]): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
		notify();
		return true;
	} catch {
		return false;
	}
}

export function listSavedDecks(): SavedDeck[] {
	// newest first, most recently saved is most likely wanted
	return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveDeck(
	name: string,
	selections: {
		bossId: string | null;
		crewIds: readonly string[];
		moveIds: readonly string[];
	},
): SavedDeck | null {
	const decks = readAll();
	const entry: SavedDeck = {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		name: name.trim() || "Untitled deck",
		bossId: selections.bossId,
		crewIds: [...selections.crewIds],
		moveIds: [...selections.moveIds],
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