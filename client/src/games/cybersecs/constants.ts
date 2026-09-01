import type {
	CybsecsRole,
	WinReason,
	GameMode,
} from "@shared/games/breachpoint/index";

export const ROLE_META: Record<
	CybsecsRole,
	{ label: string; desc: string; alignment: "agent" | "hacker" }
> = {
	agent: {
		label: "Agent",
		desc: "Secure every mission. Trust no one.",
		alignment: "agent",
	},
	hacker: {
		label: "Hacker",
		desc: "Hack missions and stay hidden.",
		alignment: "hacker",
	},
	sysadmin: {
		label: "Sysadmin",
		desc: "You know all hackers. Stay covert — the Doxxer targets you if agents win.",
		alignment: "agent",
	},
	doxxer: {
		label: "Doxxer",
		desc: "Hack missions. If agents secure 3, identify and doxx the Sysadmin to win.",
		alignment: "hacker",
	},
	intern: {
		label: "Intern",
		desc: "Lone hacker — other hackers don't know you exist.",
		alignment: "hacker",
	},
	analyst: {
		label: "Analyst",
		desc: "One of your two flagged suspects is the Sysadmin. Figure out which.",
		alignment: "agent",
	},
	spoofer: {
		label: "Spoofer",
		desc: "You appear as a Sysadmin candidate to the Analyst. You're a hacker.",
		alignment: "hacker",
	},
	ethical_hacker: {
		label: "Ethical Hacker",
		desc: "Hack on missions to neutralize real hacks. 2 uses.",
		alignment: "agent",
	},
	black_hat: {
		label: "Black Hat",
		desc: "You know the Ethical Hacker's identity. Use that knowledge.",
		alignment: "hacker",
	},
	honeypot: {
		label: "Honeypot",
		desc: "Hackers see you as one of them. You are not.",
		alignment: "agent",
	},
	obfuscator: {
		label: "Obfuscator",
		desc: "Arm your ability to hide a mission's true outcome. 1 use.",
		alignment: "hacker",
	},
};

export const MODE_LABELS: Record<GameMode, string> = {
	baseline: "Baseline",
	exposure: "Exposure",
	override: "Override",
};

export const WIN_REASON_TEXT: Record<WinReason, string> = {
	agents_secured_three: "Agents secured 3 missions",
	hackers_hacked_three: "Hackers compromised 3 missions",
	five_rejections: "5 consecutive rejections — Hackers win by default",
	doxx_sysadmin: "Sysadmin was identified and doxxed",
	doxx_failed: "Doxx attempt failed — Sysadmin survives",
};

export const MISSION_TEAM_SIZES: Record<number, readonly number[]> = {
	5: [2, 3, 2, 3, 3],
	6: [2, 3, 4, 3, 4],
	7: [2, 3, 3, 4, 4],
	8: [3, 4, 4, 5, 5],
	9: [3, 4, 4, 5, 5],
	10: [3, 4, 4, 6, 5],
};