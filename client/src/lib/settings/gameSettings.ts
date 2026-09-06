import { create } from "zustand";

const STORAGE_KEY = "huddle_game_settings:v1";

export const CARD_SIZE_MIN = 50;
export const CARD_SIZE_MAX = 150;
export const CARD_SIZE_DEFAULT = 100;

export const AUDIO_VOLUME_MIN = 0;
export const AUDIO_VOLUME_MAX = 100;
export const AUDIO_VOLUME_DEFAULT = 100;

interface PersistedSettings {
	cardSizePct: number;
	audioVolumePct: number;
}

function loadPersisted(): PersistedSettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) throw new Error("no saved settings");
		const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
		return {
			cardSizePct: clamp(
				parsed.cardSizePct ?? CARD_SIZE_DEFAULT,
				CARD_SIZE_MIN,
				CARD_SIZE_MAX,
			),
			audioVolumePct: clamp(
				parsed.audioVolumePct ?? AUDIO_VOLUME_DEFAULT,
				AUDIO_VOLUME_MIN,
				AUDIO_VOLUME_MAX,
			),
		};
	} catch {
		return { cardSizePct: CARD_SIZE_DEFAULT, audioVolumePct: AUDIO_VOLUME_DEFAULT };
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function persist(state: PersistedSettings): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {
		// storage unavailable
	}
}

interface GameSettingsStore extends PersistedSettings {
	setCardSizePct: (pct: number) => void;
	setAudioVolumePct: (pct: number) => void;
}

export const useGameSettingsStore = create<GameSettingsStore>((set, get) => ({
	...loadPersisted(),

	setCardSizePct: (pct) => {
		const cardSizePct = clamp(pct, CARD_SIZE_MIN, CARD_SIZE_MAX);
		set({ cardSizePct });
		persist({ cardSizePct, audioVolumePct: get().audioVolumePct });
	},

	setAudioVolumePct: (pct) => {
		const audioVolumePct = clamp(pct, AUDIO_VOLUME_MIN, AUDIO_VOLUME_MAX);
		set({ audioVolumePct });
		persist({ cardSizePct: get().cardSizePct, audioVolumePct });
	},
}));
