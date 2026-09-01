import { useEffect, useRef } from "react";
import { Howl } from "howler";
import {
	CATEGORY_TO_NARRATOR_KEY,
	NARRATOR_SPRITE_BASE,
	type NarratorKey,
} from "./manifest";

interface SpriteManifest {
	urls: string[];
	sprite: Record<string, [number, number] | [number, number, boolean]>;
}

let _manifestPromise: Promise<SpriteManifest> | null = null;

function getManifestPromise(): Promise<SpriteManifest> {
	if (_manifestPromise) return _manifestPromise;
	_manifestPromise = new Promise<SpriteManifest>((resolve, reject) => {
		const load = () =>
			fetch(`${NARRATOR_SPRITE_BASE}.json`)
				.then((res) => {
					if (!res.ok)
						throw new Error(`[narrator] manifest ${String(res.status)}`);
					return res.json() as Promise<SpriteManifest>;
				})
				.then(resolve)
				.catch(reject);
		if (typeof window.requestIdleCallback === "function") {
			window.requestIdleCallback(() => void load(), { timeout: 2000 });
		} else {
			window.setTimeout(() => void load(), 300);
		}
	});
	return _manifestPromise;
}

let _howl: Howl | null = null;

function initHowl(): Promise<Howl> {
	if (_howl) return Promise.resolve(_howl);
	return getManifestPromise().then((manifest) => {
		if (_howl) return _howl;
		return new Promise<Howl>((resolve, reject) => {
			const howl = new Howl({
				src: manifest.urls,
				sprite: manifest.sprite,
				preload: false,
				volume: 0.9,
				onloaderror: (_id, err) => {
					reject(err instanceof Error ? err : new Error(String(err)));
				},
			});
			howl.once("load", () => {
				_howl = howl;
				resolve(howl);
			});
			howl.load();
		});
	});
}

// sprite load failure is non-critical — warn and swallow
const _howlPromise: Promise<void> = initHowl().then(
	() => undefined,
	(err: unknown) => {
		console.warn("[narrator] failed to initialise sprite", err);
	},
);

export function useHostNarrator() {
	const howlRef = useRef<Howl | null>(_howl);

	useEffect(() => {
		if (_howl) {
			howlRef.current = _howl;
			return;
		}
		let active = true;
		void _howlPromise.then(() => {
			if (active) howlRef.current = _howl;
		});
		return () => {
			active = false;
		};
	}, []);

	function stop() {
		howlRef.current?.stop();
	}

	function say(key: NarratorKey) {
		const howl = howlRef.current;
		if (import.meta.env.DEV) {
			console.log(
				`[narrator] say("${key}")${howl ? "" : " - not ready, dropped"}`,
			);
		}
		if (!howl) return;
		howl.stop();
		howl.play(key);
	}

	function sayCategory(category: string) {
		const key = CATEGORY_TO_NARRATOR_KEY[category];
		if (!key) {
			console.warn(`[narrator] no sprite key for category "${category}"`);
			return;
		}
		say(key);
	}

	return { say, sayCategory, stop };
}