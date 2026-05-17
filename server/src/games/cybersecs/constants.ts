import type {
	GameMode,
	CybsecsRole,
	CybsecsAlignment,
} from "../../../../shared/cybersecs.js";

export const C = {
	ROLE_REVEAL_MS: 15_000,
	TALKING_MS: 90_000,
	NOMINATING_MS: 45_000,
	VOTING_MS: 30_000,
	MISSION_MS: 30_000,
	MISSION_RESULT_MS: 8_000,
	DOXXING_MS: 45_000,
	// required team size per mission
	MISSION_TEAM_SIZES: {
		5: [2, 3, 2, 3, 3],
		6: [2, 3, 4, 3, 4],
		7: [2, 3, 3, 4, 4],
		8: [3, 4, 4, 5, 5],
		9: [3, 4, 4, 5, 5],
		10: [3, 4, 4, 6, 5],
	} as Record<number, readonly number[]>,
	// 7+ players, mission index 3 requires 2 hacks
	DOUBLE_HACK: {
		MIN_PLAYERS: 7,
		MISSION_INDEX: 3,
	},
	// hammer
	MAX_REJECTIONS: 5,
} as const;

export const MODE_WEIGHTS = {
	baseline: 0.3,
	exposure: 0.35,
	override: 0.35,
} as const satisfies Record<GameMode, number>;

const _weightSum = (Object.values(MODE_WEIGHTS) as number[]).reduce(
	(a, b) => a + b,
	0,
);
if (Math.abs(_weightSum - 1) > 1e-10) {
	throw new Error(`MODE_WEIGHTS must sum to 1 (got ${_weightSum})`);
}

export const ROLE_ALIGNMENT: Record<CybsecsRole, CybsecsAlignment> = {
	agent: "agent",
	sysadmin: "agent",
	analyst: "agent",
	ethical_hacker: "agent",
	trojan: "agent",
	hacker: "hacker",
	doxxer: "hacker",
	intern: "hacker",
	spoofer: "hacker",
	black_hat: "hacker",
	obfuscator: "hacker",
};

export function requiredHacksFor(
	playerCount: number,
	missionIndex: number,
): number {
	return playerCount >= C.DOUBLE_HACK.MIN_PLAYERS &&
		missionIndex === C.DOUBLE_HACK.MISSION_INDEX
		? 2
		: 1;
}