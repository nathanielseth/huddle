export type MatchupTier = "even" | "slight_edge" | "favored" | "heavy_favorite";

export const TIER_LABELS: Record<MatchupTier, string> = {
	even: "Even",
	slight_edge: "Slight edge",
	favored: "Favored",
	heavy_favorite: "Heavy favorite",
} as const;

export const TIER_SUBTITLES: Record<
	MatchupTier,
	{ favorite: string; underdog: string }
> = {
	even: { favorite: "Coin-flip matchup", underdog: "Coin-flip matchup" },
	slight_edge: { favorite: "Slight edge", underdog: "Slight underdog" },
	favored: { favorite: "Clear favorite", underdog: "Underdog" },
	heavy_favorite: { favorite: "Heavy favorite", underdog: "Long shot" },
} as const;

// the ONLY constants to update after re-running the distribution script.
// all values in terms of favored fighter's win probability (always >= 0.5)
const THRESHOLDS = {
	EVEN_MAX: 0.535, // ~32% of matchups
	SLIGHT_EDGE_MAX: 0.575, // ~28%, cumulative ~60%
	FAVORED_MAX: 0.625, // ~24%, cumulative ~84%
	// heavy_favorite: anything above FAVORED_MAX (~16%)
} as const;

export interface TierResult {
	tier: MatchupTier;
	label: string;
	// normalised edge strength in [0, 1]. 0 = low end of tier, 1 = high end.
	// useful for continuous visual effects (bar width, colour intensity)
	edge: number;
}

// classify a single fighter's win probability into a tier.
// use describeMatchup for both sides
export function getMatchupTier(winProbability: number): TierResult {
	const p = Math.max(winProbability, 1 - winProbability);
	const tier = classifyFavoredProb(p);
	return { tier, label: TIER_LABELS[tier], edge: computeEdge(p, tier) };
}

function classifyFavoredProb(p: number): MatchupTier {
	if (p < THRESHOLDS.EVEN_MAX) return "even";
	if (p < THRESHOLDS.SLIGHT_EDGE_MAX) return "slight_edge";
	if (p < THRESHOLDS.FAVORED_MAX) return "favored";
	return "heavy_favorite";
}

function computeEdge(p: number, tier: MatchupTier): number {
	const bounds: Record<MatchupTier, [number, number]> = {
		even: [0.5, THRESHOLDS.EVEN_MAX],
		slight_edge: [THRESHOLDS.EVEN_MAX, THRESHOLDS.SLIGHT_EDGE_MAX],
		favored: [THRESHOLDS.SLIGHT_EDGE_MAX, THRESHOLDS.FAVORED_MAX],
		// cap at 0.98, matching predictWinProbability clamp in odds.ts
		heavy_favorite: [THRESHOLDS.FAVORED_MAX, 0.98],
	};
	const [lo, hi] = bounds[tier];
	return Math.min(Math.max((p - lo) / (hi - lo), 0), 1);
}

export interface FighterMatchupInfo {
	tier: MatchupTier;
	label: string;
	subtitle: string;
	edge: number; // normalised [0, 1] from this fighter's perspective
	winProbability: number;
	moneylineHint: string; // e.g. "-180" or "+155"
}

export interface MatchupDescription {
	favorite: FighterMatchupInfo; // fighter with winProbability >= 0.5
	underdog: FighterMatchupInfo; // fighter with winProbability < 0.5
	isEven: boolean;
}

// describes a full matchup from fighter1's win probability
export function describeMatchup(
	fighter1WinProbability: number,
): MatchupDescription {
	const p1 = fighter1WinProbability;
	const p2 = 1 - p1;
	const f1IsFavorite = p1 >= p2;
	const favP = f1IsFavorite ? p1 : p2;
	const undP = f1IsFavorite ? p2 : p1;
	const tier = classifyFavoredProb(favP);

	const favorite: FighterMatchupInfo = {
		tier,
		label: TIER_LABELS[tier],
		subtitle: TIER_SUBTITLES[tier].favorite,
		edge: computeEdge(favP, tier),
		winProbability: favP,
		moneylineHint: toMoneylineString(favP),
	};

	const underdog: FighterMatchupInfo = {
		tier,
		label: TIER_LABELS[tier],
		subtitle: TIER_SUBTITLES[tier].underdog,
		edge: computeEdge(undP, tier),
		winProbability: undP,
		moneylineHint: toMoneylineString(undP),
	};

	return {
		favorite: f1IsFavorite ? favorite : underdog,
		underdog: f1IsFavorite ? underdog : favorite,
		isEven: tier === "even",
	};
}

function toMoneylineString(p: number): string {
	if (p >= 0.999) return "N/A";
	const ml =
		p >= 0.5
			? Math.round(-100 * (p / (1 - p)))
			: Math.round(100 * ((1 - p) / p));
	return ml > 0 ? `+${ml}` : String(ml);
}

export interface TierStyle {
	colorKey: "neutral" | "yellow" | "orange" | "red";
}

export const TIER_STYLES: Record<MatchupTier, TierStyle> = {
	even: { colorKey: "neutral" },
	slight_edge: { colorKey: "yellow" },
	favored: { colorKey: "orange" },
	heavy_favorite: { colorKey: "red" },
} as const;

// tiers in ascending advantage order — useful for rendering a legend
export const TIER_ORDER: readonly MatchupTier[] = [
	"even",
	"slight_edge",
	"favored",
	"heavy_favorite",
] as const;