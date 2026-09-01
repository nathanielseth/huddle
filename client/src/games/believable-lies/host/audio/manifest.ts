// sprite keys must match the filenames (minus extension) fed to audiosprite; see generate-sprite.sh
// assets live at /public/audio/believable-lies/narrator.{json,mp3,ogg}
export type NarratorKey =
	| "phase-question-select"
	| "phase-lie-input"
	| "phase-picking"
	| "phase-result"
	| "phase-round-end"
	| "phase-finished"
	| "result-truth-found-by-many"
	| "result-truth-found-by-few"
	| "result-nobody-found-truth"
	| "category-history"
	| "category-science"
	| "category-food"
	| "category-pop-culture"
	| "category-filipino"
	| "category-weird"
	| "game-intro"
	| "game-winner";

export const CATEGORY_TO_NARRATOR_KEY: Partial<Record<string, NarratorKey>> = {
	History: "category-history",
	Science: "category-science",
	Food: "category-food",
	"Pop Culture": "category-pop-culture",
	Filipino: "category-filipino",
	Weird: "category-weird",
};

// "found by many" threshold: at least half the players (rounded up)
export function pickResultStinger(
	truthPickerIds: readonly string[],
	totalPlayers: number,
): NarratorKey {
	if (truthPickerIds.length === 0) return "result-nobody-found-truth";
	if (truthPickerIds.length >= Math.ceil(totalPlayers / 2)) {
		return "result-truth-found-by-many";
	}
	return "result-truth-found-by-few";
}

export const NARRATOR_SPRITE_BASE = "/assets/audio/believable-lies/narrator";