export type CybsecsPhase =
	| "role_reveal"
	| "talking"
	| "nominating"
	| "voting"
	| "mission"
	| "mission_result"
	| "doxxing"
	| "game_over";

export type GameMode = "baseline" | "exposure" | "override";

export type CybsecsRole =
	| "agent" // regular agent, can only secure
	| "hacker" // regular hacker, can secure or hack
	| "sysadmin" // exposure: knows all hackers, must stay covert
	| "doxxer" // exposure: regular hacker + endgame doxx ability
	| "intern" // exposure 7+: isolated hacker, unknown to other hackers
	| "analyst" // exposure 7+: sees sysadmin + spoofer as candidates
	| "spoofer" // exposure 7+: hacker posing as sysadmin candidate
	| "ethical_hacker" // override: agent who can hack to neutralize
	| "black_hat" // override 6+: hacker who knows the EH's identity
	| "trojan" // override 7+: agent who appears as hacker to hackers
	| "obfuscator"; // override 7+: hacker with one-time mission obfuscation

export type CybsecsAlignment = "agent" | "hacker";

export type MissionAction = "secure" | "hack";
export type VoteChoice = "approve" | "reject";

export type WinReason =
	| "agents_secured_three"
	| "hackers_hacked_three"
	| "five_rejections"
	| "doxx_sysadmin"
	| "doxx_failed";

// delivered privately to EH on backfire (hack with 0 real hacker actions)
// detects hacker presence on the team, not actions or counts
export type EhIntel = "hacker_detected" | "no_hacker_detected";

// delivered privately when an obfuscated mission resolves: to obfuscator if on
// team, else to a random mission participant. EH backfire intel unaffected
export interface ObfuscatorIntel {
	readonly missionIndex: number;
	readonly hackCount: number;
	readonly requiredHacks: number;
	readonly secured: boolean;
}

export interface MissionResult {
	readonly missionIndex: number;
	// effective hacks after override neutralization. 0 (dummy) when obfuscated,
	// always check obfuscated flag before reading
	readonly hackCount: number;
	readonly requiredHacks: number;
	// false (dummy) when obfuscated, always check obfuscated flag before reading
	readonly secured: boolean;
	// true when obfuscator's ability masked this outcome
	readonly obfuscated: boolean;
}

export interface CybsecsPlayerView {
	readonly playerId: string;
	readonly isLeader: boolean;
	readonly isNominated: boolean;
	readonly hasVoted: boolean;
	readonly vote: VoteChoice | null;
	readonly hasSubmittedMissionAction: boolean;
}

export interface CybsecsState {
	readonly phase: CybsecsPhase;
	readonly mode: GameMode;
	readonly missionIndex: number;
	readonly playerOrder: readonly string[];
	readonly leaderIndex: number;
	readonly rejectionCount: number;
	readonly nominatedTeam: readonly string[];
	readonly teamSize: number;
	readonly skipVotedIds: readonly string[];
	readonly passedPlayerIds: readonly string[];
	readonly missionResults: readonly MissionResult[];
	// apparent counts exclude obfuscated missions. intel recipient can derive true
	// total from their ObfuscatorIntel
	readonly secureds: number;
	readonly hacked: number;
	readonly players: Readonly<Record<string, CybsecsPlayerView>>;
	readonly winner: CybsecsAlignment | null;
	readonly winReason: WinReason | null;
	readonly finalRoles: Readonly<Record<string, CybsecsRole>> | null;
}

// visibility matrix:
// agent/analyst/trojan/intern/ethical_hacker - empty knownHackerIds
// hacker/doxxer/spoofer/obfuscator - see hacker ring (hacker/doxxer/spoofer/black_hat/trojan/obfuscator)
// black_hat - same ring + knownEthicalHackerId
// sysadmin - all hacker-aligned (including intern)
export interface CybsecsSecret {
	readonly role: CybsecsRole;
	readonly alignment: CybsecsAlignment;
	readonly knownHackerIds: readonly string[];
	readonly knownEthicalHackerId: string | null; // black hat only
	readonly ethicalHackerUsesLeft: number; // 2 for EH, 0 otherwise
	readonly ehIntel: EhIntel | null; // set on EH backfire, detects presence not actions
	readonly flaggedCandidateIds: readonly [string, string] | null; // analyst only, sysadmin+spoofer
	readonly obfuscatorUsesLeft: number; // 1 for obfuscator, 0 otherwise
	// armed for current mission cycle, persists across rejections, consumed on resolve
	readonly obfuscateArmed: boolean;
	// set when obfuscated mission resolves and this player is the intel recipient,
	// persists for reconnect
	readonly obfuscatorIntel: ObfuscatorIntel | null;
}

export type CybsecsAction =
	| { readonly type: "skip_vote"; readonly skip: boolean }
	| { readonly type: "nominate"; readonly team: readonly string[] }
	| { readonly type: "pass" }
	| { readonly type: "vote"; readonly choice: VoteChoice }
	| { readonly type: "mission_action"; readonly action: MissionAction }
	| { readonly type: "doxx"; readonly targetId: string }
	| { readonly type: "toggle_obfuscate"; readonly active: boolean };