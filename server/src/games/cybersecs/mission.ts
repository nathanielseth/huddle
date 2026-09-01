import type {
	GameMode,
	MissionResult,
	EhIntel,
} from "../../../../shared/games/breachpoint/index";
import type {
	CybsecsServerState,
	CybsecsServerPlayer,
	MissionResolution,
	EhOutcome,
	ObfuscatorEffect,
} from "./types";
import { requiredHacksFor } from "./constants";

function countHacks(
	teamPlayers: CybsecsServerPlayer[],
	mode: GameMode,
): number {
	if (mode !== "override") {
		return teamPlayers.filter((p) => p.missionAction === "hack").length;
	}
	// override: EH is agent-aligned, so this correctly excludes their hack action
	return teamPlayers.filter(
		(p) => p.alignment === "hacker" && p.missionAction === "hack",
	).length;
}

function resolveEhOverride(
	teamPlayers: CybsecsServerPlayer[],
	realHackCount: number,
	reqHacks: number,
): { trueHackCount: number; ehOutcome?: EhOutcome } {
	const ehPlayer = teamPlayers.find(
		(p) =>
			p.role === "ethical_hacker" &&
			p.missionAction === "hack" &&
			p.ehUsesLeft > 0,
	);
	if (!ehPlayer) return { trueHackCount: realHackCount };

	const usesLeft = ehPlayer.ehUsesLeft - 1;

	if (realHackCount >= 1) {
		// block: neutralize all real hacks, no intel written to EH
		return {
			trueHackCount: 0,
			ehOutcome: { kind: "block", playerId: ehPlayer.playerId, usesLeft },
		};
	}

	// backfire: EH hacked with no real hackers on team, black hat is undetectable
	const anyDetectable = teamPlayers.some(
		(p) => p.alignment === "hacker" && p.role !== "black_hat",
	);
	const intel: EhIntel = anyDetectable
		? "hacker_detected"
		: "no_hacker_detected";

	return {
		trueHackCount: reqHacks,
		ehOutcome: {
			kind: "backfire",
			playerId: ehPlayer.playerId,
			usesLeft,
			intel,
		},
	};
}

function resolveObfuscation(
	state: CybsecsServerState,
	trueResult: Extract<MissionResult, { obfuscated: false }>,
): { publicResult: MissionResult; obfuscatorEffect?: ObfuscatorEffect } {
	const obfuscatorId = state.roleIndex.get("obfuscator");
	const obfuscatorPlayer = obfuscatorId
		? state.players.get(obfuscatorId)
		: undefined;

	if (
		!obfuscatorPlayer?.obfuscateArmed ||
		obfuscatorPlayer.obfuscatorUsesLeft <= 0
	) {
		return { publicResult: trueResult };
	}

	const { nominatedTeam } = state;
	// if obfuscator on team, intel goes to them; otherwise random teammate
	const recipientId = nominatedTeam.includes(obfuscatorPlayer.playerId)
		? obfuscatorPlayer.playerId
		: nominatedTeam[Math.floor(Math.random() * nominatedTeam.length)]!;

	return {
		publicResult: {
			obfuscated: true,
			missionIndex: trueResult.missionIndex,
			requiredHacks: trueResult.requiredHacks,
		},
		obfuscatorEffect: { recipientId, trueResult },
	};
}

export function resolveMission(state: CybsecsServerState): MissionResolution {
	const { missionIndex, nominatedTeam, players, mode, playerOrder } = state;
	const teamPlayers = nominatedTeam.map((id) => players.get(id)!);
	const reqHacks = requiredHacksFor(playerOrder.length, missionIndex);

	const rawHackCount = countHacks(teamPlayers, mode);
	const { trueHackCount, ehOutcome } =
		mode === "override"
			? resolveEhOverride(teamPlayers, rawHackCount, reqHacks)
			: { trueHackCount: rawHackCount };

	const trueResult: Extract<MissionResult, { obfuscated: false }> = {
		obfuscated: false,
		missionIndex,
		hackCount: trueHackCount,
		requiredHacks: reqHacks,
		secured: trueHackCount < reqHacks,
	};

	const { publicResult, obfuscatorEffect } = resolveObfuscation(
		state,
		trueResult,
	);

	return {
		publicResult,
		trueResult,
		...(ehOutcome !== undefined && { ehOutcome }),
		...(obfuscatorEffect !== undefined && { obfuscatorEffect }),
	};
}

// applies a MissionResolution to state. mutates player fields, pushes to both
// result logs, advances phase to mission_result. returns player IDs whose
// secrets changed so caller can build private payloads.
//
// EH block:    usesLeft decremented, ehIntel NOT written (kind === "block")
// EH backfire: usesLeft decremented, ehIntel + ehIntelMissionIndex written
// Obfuscator:  usesLeft decremented, disarmed, trueResult delivered to recipient
export function commitMissionResult(
	state: CybsecsServerState,
	{ publicResult, trueResult, ehOutcome, obfuscatorEffect }: MissionResolution,
): Set<string> {
	state.missionResults.push(publicResult);
	state.trueMissionResults.push(trueResult);
	state.phase = "mission_result";

	const updatedIds = new Set<string>();

	if (ehOutcome) {
		const ehPlayer = state.players.get(ehOutcome.playerId);
		if (ehPlayer) {
			ehPlayer.ehUsesLeft = ehOutcome.usesLeft;
			if (ehOutcome.kind === "backfire") {
				ehPlayer.ehIntel = ehOutcome.intel;
				ehPlayer.ehIntelMissionIndex = state.missionIndex;
			}
			updatedIds.add(ehOutcome.playerId);
		}
	}

	if (obfuscatorEffect) {
		const obfuscatorId = state.roleIndex.get("obfuscator");
		const obfPlayer = obfuscatorId
			? state.players.get(obfuscatorId)
			: undefined;
		if (obfPlayer) {
			obfPlayer.obfuscatorUsesLeft--;
			obfPlayer.obfuscateArmed = false;
			updatedIds.add(obfPlayer.playerId);
		}

		const recipient = state.players.get(obfuscatorEffect.recipientId);
		if (recipient) {
			recipient.obfuscatorIntel = obfuscatorEffect.trueResult;
			recipient.obfuscatorIntelMissionIndex = state.missionIndex;
			updatedIds.add(obfuscatorEffect.recipientId);
		}
	}

	return updatedIds;
}

// derives true secured/hacked counts from trueMissionResults
export function getWinCounts(state: CybsecsServerState): {
	secureds: number;
	hacked: number;
} {
	let secureds = 0;
	let hacked = 0;
	for (const r of state.trueMissionResults) {
		if (r.secured) secureds++;
		else hacked++;
	}
	return { secureds, hacked };
}