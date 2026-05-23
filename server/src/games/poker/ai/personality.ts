import type { AIPersonality } from "./types";
import { shuffle } from "../../lib/random";

export const PERSONALITIES = {
	// cautious coward
	nit: {
		id: "nit",
		displayName: "The Rock",
		tightness: 0.76,
		aggression: 0.42,
		bluffFrequency: 0.05,
		sizingWeights: [4, 5, 1, 1] as const,
		noise: 0.08,
		thinkTimeMs: [600, 1_800] as const,

		openRangePct: 21,
		threeBetRangePct: 9,
		coldCallPct: 14,
	},

	// disciplined pro
	tag: {
		id: "tag",
		displayName: "The Shark",
		tightness: 0.60,
		aggression: 0.72,
		bluffFrequency: 0.26,
		sizingWeights: [2, 4, 3, 1] as const,
		noise: 0.09,
		thinkTimeMs: [400, 1_400] as const,

		openRangePct: 30,
		threeBetRangePct: 12,
		coldCallPct: 16,
	},

	// creative aggressor
	lag: {
		id: "lag",
		displayName: "The Predator",
		tightness: 0.38,
		aggression: 0.82,
		bluffFrequency: 0.34,
		sizingWeights: [1, 3, 4, 2] as const,
		noise: 0.18,
		thinkTimeMs: [300, 1_100] as const,

		openRangePct: 46,
		threeBetRangePct: 22,
		coldCallPct: 24,
	},

	// unhinged
	maniac: {
		id: "maniac",
		displayName: "The Maniac",
		tightness: 0.3,
		aggression: 0.95,
		bluffFrequency: 0.41,
		sizingWeights: [1, 2, 5, 2] as const,
		noise: 0.2,
		thinkTimeMs: [150, 700] as const,

		openRangePct: 62,
		threeBetRangePct: 26,
		coldCallPct: 41,
	},

	// just sit like damian priest
	station: {
		id: "station",
		displayName: "The Station",
		tightness: 0.28,
		aggression: 0.22,
		bluffFrequency: 0.15,
		sizingWeights: [4, 5, 1, 1] as const,
		noise: 0.16,
		thinkTimeMs: [400, 1_400] as const,

		openRangePct: 35,
		threeBetRangePct: 11,
		coldCallPct: 49,
	},
} as const satisfies Record<string, AIPersonality>;

export type PersonalityId = keyof typeof PERSONALITIES;

export const BOT_ROSTER = {
	nit: [
		"Dora",
		"Yona",
		"Tofu",
	],
	tag: ["Lalo", "Tintin", "Ratgon"],
	lag: ["Cotton", "Mochi", "Chonkers"],
	maniac: [ "Mudkip", "Monke", "Ichimo"],
	station: [
		"Cooper",
		"Bamboo",
		"Reshi",
	],
} as const satisfies Record<PersonalityId, readonly string[]>;

export type BotDisplayName = string & { readonly __brand: "BotDisplayName" };

export class NameDispenser {
	private readonly pools = new Map<PersonalityId, string[]>();
	private readonly issued = new Set<string>();
	private globalFallback: string[] | null = null;

	issue(personalityId: PersonalityId): BotDisplayName {
		const pool = this._pool(personalityId);

		while (pool.length > 0) {
			const candidate = pool.pop()!;
			if (!this.issued.has(candidate)) {
				this.issued.add(candidate);
				return candidate as BotDisplayName;
			}
		}

		return this._issueFromFallback();
	}

	private _issueFromFallback(): BotDisplayName {
		if (!this.globalFallback) {
			const allNames = Object.values(BOT_ROSTER).flat();
			this.globalFallback = shuffle(allNames);
		}

		while (this.globalFallback.length > 0) {
			const candidate = this.globalFallback.pop()!;
			if (!this.issued.has(candidate)) {
				this.issued.add(candidate);
				return candidate as BotDisplayName;
			}
		}

		throw new Error("name pool exhausted");
	}

	private _pool(personalityId: PersonalityId): string[] {
		const existing = this.pools.get(personalityId);
		if (existing) return existing;

		const shuffledPool = shuffle(BOT_ROSTER[personalityId]);
		this.pools.set(personalityId, shuffledPool);

		return shuffledPool;
	}

	has(name: string): boolean {
		return this.issued.has(name);
	}

	get size(): number {
		return this.issued.size;
	}
}

// 

const PERSONALITY_WEIGHTS: readonly [PersonalityId, number][] = [
	["nit", 20],
	["tag", 30],
	["lag", 20],
	["maniac", 10],
	["station", 20],
] as const;

const TOTAL_WEIGHT = PERSONALITY_WEIGHTS.reduce((s, [, w]) => s + w, 0);

function weightedRandomPersonality(): AIPersonality {
	let roll = Math.random() * TOTAL_WEIGHT;
	for (const [id, weight] of PERSONALITY_WEIGHTS) {
		roll -= weight;
		if (roll <= 0) return PERSONALITIES[id];
	}
	return PERSONALITIES.tag;
}

// public

export interface AIPlayerConfig {
	readonly playerId: string;
	readonly displayName: BotDisplayName;
	readonly personality: AIPersonality;
}

export function generateAIPlayer(
	playerId: string,
	dispenser: NameDispenser,
): AIPlayerConfig {
	const personality = weightedRandomPersonality();
	return {
		playerId,
		displayName: dispenser.issue(personality.id as PersonalityId),
		personality,
	};
}

export function createAIPlayer(
	playerId: string,
	username: string,
	personalityId: PersonalityId,
	dispenser: NameDispenser,
	options: { forceName?: boolean } = {},
): AIPlayerConfig {
	let displayName: BotDisplayName;

	if (options.forceName || !dispenser.has(username)) {
		(dispenser as unknown as { issued: Set<string> })["issued"].add(username);
		displayName = username as BotDisplayName;
	} else {
		// name already taken fallback
		displayName = dispenser.issue(personalityId);
	}

	return { playerId, displayName, personality: PERSONALITIES[personalityId] };
}

export function humanizeBet(
	raw: number,
	personality: AIPersonality,
	min: number,
	max: number,
): number {
	const grid =
		raw < 100
			? 10
			: raw < 500
				? 25
				: raw < 2_000
					? personality.noise > 0.15
						? 100
						: 50
					: raw < 6_000
						? personality.noise > 0.15
							? 250
							: 100
						: personality.noise > 0.15
							? 500
							: 250;

	const snapped = Math.round(raw / grid) * grid;
	return Math.max(min, Math.min(snapped, max));
}
