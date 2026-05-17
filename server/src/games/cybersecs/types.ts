import type {
	CybsecsPhase,
	GameMode,
	CybsecsRole,
	CybsecsAlignment,
	MissionAction,
	VoteChoice,
	MissionResult,
	WinReason,
	EhIntel,
	ObfuscatorIntel,
	CybsecsAction,
} from "../../../../shared/cybersecs.js";

// engine mutates state in place. readonly on identity fields prevents reassignment
// phase-scoped submission fields reset to null on each phase entry
export interface CybsecsServerPlayer {
	readonly playerId: string;
	readonly role: CybsecsRole;
	readonly alignment: CybsecsAlignment;

	// role knowledge, written once by assignRoles, never mutated after
	knownHackerIds: readonly string[];
	knownEthicalHackerId: string | null;
	// analyst only: two IDs in randomized order (one sysadmin, one spoofer), null otherwise
	flaggedCandidateIds: readonly [string, string] | null;

	// phase-scoped submissions, null = not yet submitted this phase
	skipVote: boolean | null;
	vote: VoteChoice | null;
	missionAction: MissionAction | null;

	// ethical hacker state
	ehUsesLeft: number; // 2 for EH, 0 otherwise
	ehIntel: EhIntel | null; // set on backfire, persists for reconnect

	// obfuscator state
	obfuscatorUsesLeft: number; // 1 for obfuscator, 0 otherwise, decremented on use
	// armed for current mission cycle, toggled during nominating/voting/mission,
	// persists across rejections, consumed when mission resolves
	obfuscateArmed: boolean;
	// true mission result delivered privately on obfuscated resolve, persists for reconnect
	obfuscatorIntel: ObfuscatorIntel | null;
}

// returned by resolveMission, applied by applyMissionResult. pure calculation, no mutation
export interface EhEffect {
	readonly playerId: string;
	readonly usesLeft: number;
	readonly intel: EhIntel | null;
}

// returned by resolveMission when obfuscation is active
export interface ObfuscatorEffect {
	readonly recipientId: string; // player who receives the true result privately
	readonly trueResult: MissionResult; // the unmasked result
}

export interface MissionResolution {
	// public result pushed to state.missionResults, dummy values when obfuscated
	readonly publicResult: MissionResult;
	// true result for win detection, always accurate
	readonly trueResult: MissionResult;
	readonly ehEffect?: EhEffect; // present when EH used ability
	readonly obfuscatorEffect?: ObfuscatorEffect; // present when obfuscator armed and consumed
}

export interface CybsecsServerState {
	phase: CybsecsPhase;
	mode: GameMode;
	missionIndex: number;
	playerOrder: string[];
	leaderIndex: number;
	rejectionCount: number;
	nominatedTeam: string[];
	teamSize: number;
	passedPlayerIds: string[];
	players: Map<string, CybsecsServerPlayer>;
	// public mission results, contains obfuscated entries when ability was active
	missionResults: MissionResult[];
	// true secured count, drives win detection, not published directly
	secureds: number;
	// true hacked count, drives win detection
	hacked: number;
	winner: CybsecsAlignment | null;
	winReason: WinReason | null;
}

export type CybsecsServerAction = CybsecsAction;