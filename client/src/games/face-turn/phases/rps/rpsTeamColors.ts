// RPS is always a 1v1 between ft.playerOrder[0] and ft.playerOrder[1]. In
// every mode (duel, ffa, teams) the server assigns playerOrder[0] a
// teamIndex of 0 and playerOrder[1] a teamIndex of 1 (see
// buildTeamsAndTurnOrder in server/src/games/face-turn/game.ts), so this is
// a stable, server-authoritative "who's red / who's blue" for this matchup
// — not a client guess, and consistent with each player's actual team color
// when in teams mode.
export type RpsTeamColor = "red" | "blue";

export interface RpsTeamAccent {
	readonly accent: string;
	readonly accentSoft: string;
	readonly glow: string;
}

export const RPS_TEAM_ACCENT: Record<RpsTeamColor, RpsTeamAccent> = {
	red: {
		accent: "#FF5656",
		accentSoft: "#C62828",
		glow: "rgba(255, 86, 86, 0.45)",
	},
	blue: {
		accent: "#4C9EFF",
		accentSoft: "#175A9E",
		glow: "rgba(76, 158, 255, 0.45)",
	},
};

export function rpsTeamColorForIndex(teamIndex: number): RpsTeamColor {
	return teamIndex % 2 === 0 ? "red" : "blue";
}