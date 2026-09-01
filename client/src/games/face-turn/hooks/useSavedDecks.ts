import { useEffect, useState } from "react";
import {
	listSavedDecks,
	saveDeck as saveDeckToStorage,
	deleteSavedDeck as deleteDeckFromStorage,
	subscribe,
	type SavedDeck,
} from "../savedDecks";

export function useSavedDecks() {
	const [decks, setDecks] = useState<SavedDeck[]>(() => listSavedDecks());

	useEffect(() => {
		return subscribe(() => setDecks(listSavedDecks()));
	}, []);

	function save(
		name: string,
		selections: {
			bossId: string | null;
			crewIds: readonly string[];
			moveIds: readonly string[];
		},
	) {
		return saveDeckToStorage(name, selections);
	}

	function remove(id: string) {
		return deleteDeckFromStorage(id);
	}

	return { decks, save, remove };
}
