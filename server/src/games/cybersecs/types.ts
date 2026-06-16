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
} from "../../../../shared/games/cybersecs";

// engine mutates state in place. readonly on identity fields prevents reassignment
// phase-scoped fields reset to null on each phase entry
export interface CybsecsServerPlayer {
	readonly playerId: string;
	readonly role: CybsecsRole;
	readonly alignment: CybsecsAlignment;

	// role knowledge — written once by assignRoles, never mutated after
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
	obfuscatorUsesLeft: number; // 1 for obfuscator, 0 otherwise
	obfuscateArmed: boolean; // persists across rejections, consumed on mission resolve
	obfuscatorIntel: ObfuscatorIntel | null; // true result delivered privately on resolve
	obfuscatorIntelMissionIndex: number | null; // mission when intel was set, for UI gating
}

// Discriminated union — kind is the authoritative signal at the type level.
// block:    usesLeft decremented; ehIntel NOT written (mission was neutralized, no new info).
// backfire: usesLeft decremented; intel written to EH's secret.
export type EhOutcome =
	| {
			readonly kind: "block";
			readonly playerId: string;
			readonly usesLeft: number;
	  }
	| {
			readonly kind: "backfire";
			readonly playerId: string;
			readonly usesLeft: number;
			readonly intel: EhIntel;
	  };

// pure output of resolveMission when obfuscation is active
export interface ObfuscatorEffect {
	readonly recipientId: string; // player who receives the true result privately
	readonly trueResult: Extract<MissionResult, { obfuscated: false }>;
}

export interface MissionResolution {
	// pushed to state.missionResults — obfuscated variant when ability active
	readonly publicResult: MissionResult;
	// drives win detection, always non-obfuscated
	readonly trueResult: Extract<MissionResult, { obfuscated: false }>;
	readonly ehOutcome?: EhOutcome;
	readonly obfuscatorEffect?: ObfuscatorEffect;
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
	roleIndex: Map<CybsecsRole, string>;
	missionResults: MissionResult[];
	trueMissionResults: Extract<MissionResult, { obfuscated: false }>[];
	winner: CybsecsAlignment | null;
	winReason: WinReason | null;
}

export type CybsecsServerAction = CybsecsAction;