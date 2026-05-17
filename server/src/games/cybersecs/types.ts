import type {
	CybsecsPhase,
	GameMode,
	CybsecsRole,
	CybsecsAlignment,
	MissionAction,
	VoteChoice,
	MissionResult,
	ObfuscatorIntel,
	WinReason,
	EhIntel,
	CybsecsAction,
} from "../../../../shared/cybersecs.js";

// engine mutates state in place. readonly on identity fields prevents reassignment
// phase-scoped fields reset to null on each phase entry
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
	ehIntelMissionIndex: number | null; // mission when intel was generated, for UI gating

	// obfuscator state
	obfuscatorUsesLeft: number; // 1 for obfuscator, 0 otherwise, decremented on use
	// armed via toggle_obfuscate, persists across rejections, consumed on mission resolve
	obfuscateArmed: boolean;
	// true result delivered privately on obfuscated resolve, persists for reconnect
	obfuscatorIntel: ObfuscatorIntel | null;
	obfuscatorIntelMissionIndex: number | null; // mission when intel was set, for UI gating
}

// pure output of resolveMission when EH uses an ability. applied by applyMissionResult
// intel: null = block (no new info), EhIntel = backfire (presence detected)
// applyMissionResult only writes ehIntel when intel !== null
export interface EhEffect {
	readonly playerId: string;
	readonly usesLeft: number;
	readonly intel: EhIntel | null;
}

// pure output of resolveMission when obfuscation is active
export interface ObfuscatorEffect {
	readonly recipientId: string; // player who receives the true result privately
	readonly trueResult: Extract<MissionResult, { obfuscated: false }>; // never masked
}

export interface MissionResolution {
	// pushed to state.missionResults, obfuscated variant when ability active
	readonly publicResult: MissionResult;
	// drives secureds/hacked and win detection, always non-obfuscated
	readonly trueResult: Extract<MissionResult, { obfuscated: false }>;
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
	// accumulates across rejections within a mission, resets on new mission index
	passedPlayerIds: string[];
	players: Map<string, CybsecsServerPlayer>;
	roleIndex: Map<CybsecsRole, string>;
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