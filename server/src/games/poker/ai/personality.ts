import type { AIPersonality } from "./types";

export const PERSONALITIES = {
	// cautious coward
	nit: {
		id: "nit",
		displayName: "The Rock",
		tightness: 0.8,
		aggression: 0.42,
		bluffFrequency: 0.05,
		sizingWeights: [4, 5, 1, 1] as const,
		noise: 0.08,
		thinkTimeMs: [600, 1_800] as const,

		openRangePct: 16,
		threeBetRangePct: 5,
		coldCallPct: 12,
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
		coldCallPct: 18,
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
		coldCallPct: 28,
	},

	// unhinged
	maniac: {
		id: "maniac",
		displayName: "The Maniac",
		tightness: 0.3,
		aggression: 0.95,
		bluffFrequency: 0.42,
		sizingWeights: [1, 2, 5, 2] as const,
		noise: 0.2,
		thinkTimeMs: [150, 700] as const,

		openRangePct: 68,
		threeBetRangePct: 28,
		coldCallPct: 44,
	},

	// just sit like damian priest
	station: {
		id: "station",
		displayName: "The Station",
		tightness: 0.28,
		aggression: 0.18,
		bluffFrequency: 0.07,
		sizingWeights: [4, 5, 1, 1] as const,
		noise: 0.16,
		thinkTimeMs: [400, 1_400] as const,

		openRangePct: 35,
		threeBetRangePct: 11,
		coldCallPct: 55,
	},
} as const satisfies Record<string, AIPersonality>;

export type PersonalityId = keyof typeof PERSONALITIES;

export const BOT_ROSTER = {
	nit: [
		"Dora",
		"Yona",
	],
	tag: ["Lalo", "Tintin",],
	lag: ["Cotton", ],
	maniac: [ "Mudkip",],
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
	private readonly suffixCounters = new Map<string, number>();

	issue(personalityId: PersonalityId): BotDisplayName {
		const pool = this._pool(personalityId);

		while (pool.length > 0) {
			const candidate = pool.pop()!;
			if (!this.issued.has(candidate)) {
				this.issued.add(candidate);
				return candidate as BotDisplayName;
			}
		}

		const roster = BOT_ROSTER[personalityId];
		const base = roster[Math.floor(Math.random() * roster.length)]!;
		return this._suffixed(base);
	}

	private _pool(personalityId: PersonalityId): string[] {
		const existing = this.pools.get(personalityId);
		if (existing) return existing;

		const copy = [...BOT_ROSTER[personalityId]];
		for (let i = copy.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[copy[i], copy[j]] = [copy[j]!, copy[i]!];
		}

		this.pools.set(personalityId, copy);
		return copy;
	}

	private _suffixed(base: string): BotDisplayName {
		const count = (this.suffixCounters.get(base) ?? 1) + 1;
		this.suffixCounters.set(base, count);

		let candidate = `${base}${count}`;
		// extremely unlikely, but guard against the suffixed form also colliding
		while (this.issued.has(candidate)) {
			const next = (this.suffixCounters.get(base) ?? count) + 1;
			this.suffixCounters.set(base, next);
			candidate = `${base}${next}`;
		}

		this.issued.add(candidate);
		return candidate as BotDisplayName;
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
