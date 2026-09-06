import { useEffect, useState } from "react";
import {
	listSavedDecks,
	saveDeck as saveDeckToStorage,
	deleteSavedDeck as deleteDeckFromStorage,
	listRecentDecks,
	deleteRecentDeck as deleteRecentDeckFromStorage,
	subscribe,
	type SavedDeck,
} from "../savedDecks";

export function useSavedDecks() {
	const [decks, setDecks] = useState<SavedDeck[]>(() => listSavedDecks());
	const [recentDecks, setRecentDecks] = useState<SavedDeck[]>(() =>
		listRecentDecks(),
	);

	useEffect(() => {
		return subscribe(() => {
			setDecks(listSavedDecks());
			setRecentDecks(listRecentDecks());
		});
	}, []);

	function save(
		name: string,
		selections: {
			bossId: string | null;
			crewIds: readonly string[];
			moveIds: readonly string[];
		},
		thumbnailArtSrc?: string,
	) {
		return saveDeckToStorage(name, selections, thumbnailArtSrc);
	}

	function remove(id: string) {
		return deleteDeckFromStorage(id);
	}

	function removeRecent(id: string) {
		return deleteRecentDeckFromStorage(id);
	}

	return { decks, recentDecks, save, remove, removeRecent };
}