import {
	FaceturnsConfigPayloadSchema,
	DEFAULT_FACETURN_CONFIG,
	type FaceturnsConfigAction,
	type FaceturnsConfigPayload,
} from "./schemas";
import { getFaceturnSeatBounds } from "../../../../shared/games/face-turn/constants";
import type { GameConfig } from "./types";

function parseConfig(payload: unknown): FaceturnsConfigPayload {
	const result = FaceturnsConfigPayloadSchema.safeParse(payload);
	return result.success ? result.data : DEFAULT_FACETURN_CONFIG;
}

function pruneTeamChoices(
	teamChoices: FaceturnsConfigPayload["teamChoices"],
	playerIds: readonly string[],
): FaceturnsConfigPayload["teamChoices"] {
	const known = new Set(playerIds);
	const next: FaceturnsConfigPayload["teamChoices"] = {};
	for (const [id, team] of Object.entries(teamChoices)) {
		if (known.has(id)) next[id] = team;
	}
	return next;
}

export function applyConfigAction(
	currentPayload: unknown,
	action: unknown,
	senderPlayerId: string,
	senderIsHost: boolean,
): unknown {
	const typedAction = action as FaceturnsConfigAction;
	const base = parseConfig(currentPayload);

	switch (typedAction.kind) {
		case "set_mode": {
			if (!senderIsHost) return null;
			return { ...base, mode: typedAction.mode, teamChoices: {} };
		}
		case "set_team": {
			if (base.mode !== "teams") return null;
			const teamSize = getFaceturnSeatBounds("teams").max / 2;
			const currentOnTeam = Object.values(base.teamChoices).filter(
				(t) => t === typedAction.team,
			).length;
			const alreadyOnThatTeam = base.teamChoices[senderPlayerId] === typedAction.team;
			if (!alreadyOnThatTeam && currentOnTeam >= teamSize) return null;
			return {
				...base,
				teamChoices: {
					...base.teamChoices,
					[senderPlayerId]: typedAction.team,
				},
			};
		}
	}
}

export function onPlayerRemoved(
	currentPayload: unknown,
	remainingPlayerIds: readonly string[],
): unknown {
	const base = parseConfig(currentPayload);
	return { ...base, teamChoices: pruneTeamChoices(base.teamChoices, remainingPlayerIds) };
}

export function buildGameConfig(
	configPayload: unknown,
	playerIds: string[],
): GameConfig {
	const config = parseConfig(configPayload);

	if (config.mode !== "teams") {
		return { mode: config.mode };
	}

	const teams: [string[], string[]] = [
		playerIds.filter((id) => config.teamChoices[id] === "A"),
		playerIds.filter((id) => config.teamChoices[id] === "B"),
	];
	return { mode: config.mode, teams };
}

export function getMaxSeats(configPayload: unknown): number {
	const config = parseConfig(configPayload);
	return getFaceturnSeatBounds(config.mode).max;
}

export function validateStart(
	configPayload: unknown,
	playerIds: string[],
): string | null {
	const config = parseConfig(configPayload);
	const { min, max } = getFaceturnSeatBounds(config.mode);
	const count = playerIds.length;

	if (count < min || count > max) {
		const modeLabel =
			config.mode === "duel" ? "Duel" : config.mode === "teams" ? "Teams" : "FFA";
		const range = min === max ? `exactly ${String(min)}` : `${String(min)}–${String(max)}`;
		return `${modeLabel} needs ${range} players — currently ${String(count)}. Add CPUs or change the mode.`;
	}

	if (config.mode === "teams") {
		const teamSize = max / 2;
		const teamA = playerIds.filter((id) => config.teamChoices[id] === "A");
		const teamB = playerIds.filter((id) => config.teamChoices[id] === "B");
		const unassigned = count - teamA.length - teamB.length;
		if (unassigned > 0) {
			return `${String(unassigned)} player${unassigned === 1 ? "" : "s"} haven't picked a team yet.`;
		}
		if (teamA.length === 0 || teamB.length === 0) {
			return "Both teams need at least one player.";
		}
		if (teamA.length > teamSize || teamB.length > teamSize) {
			return `Teams can have at most ${String(teamSize)} players each.`;
		}
	}

	return null;
}