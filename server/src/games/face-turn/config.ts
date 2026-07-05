import {
	FaceturnsConfigPayloadSchema,
	DEFAULT_FACETURN_CONFIG,
	type FaceturnsConfigAction,
	type FaceturnsConfigPayload,
} from "./schemas";
import type { GameConfig } from "./types";

export function applyConfigAction(
	currentPayload: unknown,
	action: unknown,
	senderPlayerId: string,
	senderIsHost: boolean,
): unknown {
	const typedAction = action as FaceturnsConfigAction;
	const base = FaceturnsConfigPayloadSchema.safeParse(currentPayload).success
		? (currentPayload as FaceturnsConfigPayload)
		: DEFAULT_FACETURN_CONFIG;

	switch (typedAction.kind) {
		case "set_mode": {
			if (!senderIsHost) return null;
			return { ...base, mode: typedAction.mode, teamChoices: {} };
		}
		case "set_team": {
			if (base.mode !== "teams") return null;
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

export function buildGameConfig(
	configPayload: unknown,
	playerIds: string[],
): GameConfig {
	const result = FaceturnsConfigPayloadSchema.safeParse(configPayload);
	const config = result.success ? result.data : DEFAULT_FACETURN_CONFIG;

	if (config.mode !== "teams") {
		return { mode: config.mode };
	}

	const teams: [string[], string[]] = [
		playerIds.filter((id) => config.teamChoices[id] === "A"),
		playerIds.filter((id) => config.teamChoices[id] === "B"),
	];
	return { mode: config.mode, teams };
}
