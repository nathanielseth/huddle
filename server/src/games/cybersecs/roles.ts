import type { GameMode, CybsecsRole } from "../../../../shared/cybersecs";
import type { CybsecsServerPlayer } from "./types";
import { ROLE_ALIGNMENT, MODE_WEIGHTS, SINGLETON_ROLES } from "./constants";
import { shuffle } from "../lib/random";
import { invariant } from "../lib/assert";

function assertNever(x: never): never {
	throw new Error(`Unhandled role: ${String(x)}`);
}

const BASELINE_THRESHOLD = MODE_WEIGHTS.baseline;
const EXPOSURE_THRESHOLD = MODE_WEIGHTS.baseline + MODE_WEIGHTS.exposure;

export function pickMode(playerCount: number): GameMode {
	if (playerCount <= 5) return "baseline";
	const roll = Math.random();
	if (roll < BASELINE_THRESHOLD) return "baseline";
	if (roll < EXPOSURE_THRESHOLD) return "exposure";
	return "override";
}

export function getRoleList(
	playerCount: number,
	mode: GameMode,
): CybsecsRole[] {
	let roles: CybsecsRole[];

	if (mode === "baseline") {
		const composition: Record<number, [agents: number, hackers: number]> = {
			5: [3, 2],
			6: [4, 2],
			7: [4, 3],
			8: [5, 3],
			9: [6, 3],
			10: [6, 4],
		};
		const [a, h] = composition[playerCount]!;
		roles = [
			...Array<CybsecsRole>(a).fill("agent"),
			...Array<CybsecsRole>(h).fill("hacker"),
		];
	} else if (mode === "exposure") {
		const table: Record<number, CybsecsRole[]> = {
			6: ["sysadmin", "agent", "agent", "agent", "doxxer", "hacker"],
			7: [
				"sysadmin",
				"analyst",
				"agent",
				"agent",
				"doxxer",
				"spoofer",
				"intern",
			],
			8: [
				"sysadmin",
				"analyst",
				"agent",
				"agent",
				"agent",
				"doxxer",
				"spoofer",
				"intern",
			],
			9: [
				"sysadmin",
				"analyst",
				"agent",
				"agent",
				"agent",
				"agent",
				"doxxer",
				"spoofer",
				"intern",
			],
			10: [
				"sysadmin",
				"analyst",
				"agent",
				"agent",
				"agent",
				"agent",
				"doxxer",
				"spoofer",
				"hacker",
				"intern",
			],
		};
		roles = [...table[playerCount]!];
	} else {
		const table: Record<number, CybsecsRole[]> = {
			6: ["ethical_hacker", "agent", "agent", "agent", "black_hat", "hacker"],
			7: [
				"ethical_hacker",
				"honeypot",
				"agent",
				"agent",
				"black_hat",
				"hacker",
				"obfuscator",
			],
			8: [
				"ethical_hacker",
				"honeypot",
				"agent",
				"agent",
				"agent",
				"black_hat",
				"hacker",
				"obfuscator",
			],
			9: [
				"ethical_hacker",
				"honeypot",
				"agent",
				"agent",
				"agent",
				"agent",
				"black_hat",
				"hacker",
				"obfuscator",
			],
			10: [
				"ethical_hacker",
				"honeypot",
				"agent",
				"agent",
				"agent",
				"agent",
				"black_hat",
				"hacker",
				"hacker",
				"obfuscator",
			],
		};
		roles = [...table[playerCount]!];
	}

	invariant(
		roles.length === playerCount,
		`getRoleList produced ${roles.length} roles for ${playerCount} players in ${mode} mode`,
	);

	return roles;
}

// hacker ring includes honeypot (agent-aligned, visible to hackers in override)
// and obfuscator (hacker-aligned). spoofer and honeypot are mode-exclusive
type KnowledgeResult = {
	knownHackerIds: string[];
	knownEthicalHackerId: string | null;
};

const EMPTY_KNOWLEDGE: KnowledgeResult = {
	knownHackerIds: [],
	knownEthicalHackerId: null,
};

const HACKER_RING_ROLES = new Set<CybsecsRole>([
	"hacker",
	"doxxer",
	"spoofer",
	"black_hat",
	"honeypot",
	"obfuscator",
]);

export function buildKnowledge(
	playerId: string,
	role: CybsecsRole,
	allPlayers: Map<string, CybsecsServerPlayer>,
): KnowledgeResult {
	const others = [...allPlayers.entries()].filter(([id]) => id !== playerId);

	switch (role) {
		case "agent":
		case "analyst":
		case "honeypot":
		case "intern":
		case "ethical_hacker":
			return EMPTY_KNOWLEDGE;

		case "hacker":
		case "doxxer":
		case "spoofer":
		case "obfuscator":
			return {
				knownHackerIds: others
					.filter(([, p]) => HACKER_RING_ROLES.has(p.role))
					.map(([id]) => id),
				knownEthicalHackerId: null,
			};

		case "black_hat": {
			const knownHackerIds = others
				.filter(([, p]) => HACKER_RING_ROLES.has(p.role))
				.map(([id]) => id);
			const ehEntry = others.find(([, p]) => p.role === "ethical_hacker");
			return { knownHackerIds, knownEthicalHackerId: ehEntry?.[0] ?? null };
		}

		case "sysadmin":
			// sees all hacker-aligned players, honeypot excluded (agent-aligned)
			return {
				knownHackerIds: others
					.filter(([, p]) => p.alignment === "hacker")
					.map(([id]) => id),
				knownEthicalHackerId: null,
			};

		default:
			return assertNever(role);
	}
}

// sysadmin/spoofer pair for analyst in exposure 7+
function buildCandidatePair(
	allPlayers: Map<string, CybsecsServerPlayer>,
): readonly [string, string] {
	const sysadmin = [...allPlayers.values()].find((p) => p.role === "sysadmin");
	const spoofer = [...allPlayers.values()].find((p) => p.role === "spoofer");

	invariant(sysadmin !== undefined, "Exposure mode requires a sysadmin");
	invariant(spoofer !== undefined, "Exposure mode requires a spoofer");

	return Math.random() < 0.5
		? [sysadmin.playerId, spoofer.playerId]
		: [spoofer.playerId, sysadmin.playerId];
}

export function assignRoles(
	playerOrder: string[],
	mode: GameMode,
): Map<string, CybsecsServerPlayer> {
	const roles = shuffle(getRoleList(playerOrder.length, mode));
	const playerMap = new Map<string, CybsecsServerPlayer>();

	// pass 1 - assign roles, alignments, and per-role defaults
	for (let i = 0; i < playerOrder.length; i++) {
		const playerId = playerOrder[i]!;
		const role = roles[i]!;
		playerMap.set(playerId, {
			playerId,
			role,
			alignment: ROLE_ALIGNMENT[role],
			knownHackerIds: [],
			knownEthicalHackerId: null,
			flaggedCandidateIds: null,
			skipVote: null,
			vote: null,
			missionAction: null,
			ehUsesLeft: role === "ethical_hacker" ? 2 : 0,
			ehIntel: null,
			ehIntelMissionIndex: null,
			obfuscatorUsesLeft: role === "obfuscator" ? 1 : 0,
			obfuscateArmed: false,
			obfuscatorIntel: null,
			obfuscatorIntelMissionIndex: null,
		});
	}

	// pass 2 - inject per-role knowledge
	for (const [id, player] of playerMap) {
		const { knownHackerIds, knownEthicalHackerId } = buildKnowledge(
			id,
			player.role,
			playerMap,
		);
		player.knownHackerIds = knownHackerIds;
		player.knownEthicalHackerId = knownEthicalHackerId;
	}

	// pass 3 - analyst candidate pair (exposure 7+ only)
	if (mode === "exposure") {
		const analyst = [...playerMap.values()].find((p) => p.role === "analyst");
		if (analyst) {
			analyst.flaggedCandidateIds = buildCandidatePair(playerMap);
		}
	}

	return playerMap;
}

// only singleton roles indexed, agent/hacker excluded
export function buildRoleIndex(
	players: Map<string, CybsecsServerPlayer>,
): Map<CybsecsRole, string> {
	const index = new Map<CybsecsRole, string>();
	for (const [id, p] of players) {
		if (SINGLETON_ROLES.has(p.role)) {
			index.set(p.role, id);
		}
	}
	return index;
}