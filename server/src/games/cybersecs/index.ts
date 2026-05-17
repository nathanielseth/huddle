import type {
	GameEngine,
	GameEngineWithSecrets,
	GameContext,
	EngineResult,
} from "../../engine/GameEngine.js";
import type { GameTimer } from "../../../../shared/types.js";
import type {
	CybsecsState,
	CybsecsPlayerView,
	CybsecsSecret,
	MissionResult,
	EhIntel,
	ObfuscatorIntel,
} from "../../../../shared/cybersecs.js";
import type {
	CybsecsServerState,
	CybsecsServerAction,
	MissionResolution,
} from "./types.js";
import { C, requiredHacksFor } from "./constants.js";
import { pickMode, assignRoles, shuffle } from "./roles.js";
import { CybsecsActionSchema } from "./schemas.js";

function assertInvariant(
	condition: boolean,
	message: string,
): asserts condition {
	if (!condition) throw new Error(`Invariant violation: ${message}`);
}

const makeTimer = (durationMs: number): GameTimer => ({
	startsAt: Date.now(),
	duration: durationMs,
});

function playerSecret(
	state: CybsecsServerState,
	playerId: string,
): CybsecsSecret | null {
	const p = state.players.get(playerId);
	if (!p) return null;
	return {
		role: p.role,
		alignment: p.alignment,
		knownHackerIds: p.knownHackerIds,
		knownEthicalHackerId: p.knownEthicalHackerId,
		ethicalHackerUsesLeft: p.ehUsesLeft,
		ehIntel: p.ehIntel,
		flaggedCandidateIds: p.flaggedCandidateIds,
		obfuscatorUsesLeft: p.obfuscatorUsesLeft,
		obfuscateArmed: p.obfuscateArmed,
		obfuscatorIntel: p.obfuscatorIntel,
	};
}

function allSecrets(state: CybsecsServerState): Map<string, CybsecsSecret> {
	const out = new Map<string, CybsecsSecret>();
	for (const id of state.playerOrder) {
		const secret = playerSecret(state, id);
		if (secret) out.set(id, secret);
	}
	return out;
}

function buildPublicState(state: CybsecsServerState): CybsecsState {
	const revealVotes = state.phase !== "voting";

	const players: Record<string, CybsecsPlayerView> = {};
	for (const [id, p] of state.players) {
		players[id] = {
			playerId: id,
			isLeader: state.playerOrder[state.leaderIndex] === id,
			isNominated: state.nominatedTeam.includes(id),
			hasVoted: p.vote !== null,
			vote: revealVotes ? p.vote : null,
			hasSubmittedMissionAction: p.missionAction !== null,
		};
	}

	const isOver = state.winner !== null;
	const finalRoles = isOver
		? Object.fromEntries(
				[...state.players.entries()].map(([id, p]) => [id, p.role]),
			)
		: null;

	const skipVotedIds = [...state.players.entries()]
		.filter(([, p]) => p.skipVote === true)
		.map(([id]) => id);

	// apparent counters exclude obfuscated missions. state.secureds / state.hacked
	// hold true values for win detection and are never published
	const apparentSecureds = state.missionResults.filter(
		(r) => !r.obfuscated && r.secured,
	).length;
	const apparentHacked = state.missionResults.filter(
		(r) => !r.obfuscated && !r.secured,
	).length;

	return {
		phase: state.phase,
		mode: state.mode,
		missionIndex: state.missionIndex,
		playerOrder: state.playerOrder,
		leaderIndex: state.leaderIndex,
		rejectionCount: state.rejectionCount,
		nominatedTeam: state.nominatedTeam,
		teamSize: state.teamSize,
		skipVotedIds,
		passedPlayerIds: state.passedPlayerIds,
		missionResults: state.missionResults,
		secureds: apparentSecureds,
		hacked: apparentHacked,
		players,
		winner: state.winner,
		winReason: state.winReason,
		finalRoles,
	};
}

function makeResult(
	state: CybsecsServerState,
	timer: GameTimer | null,
	privatePayloads?: Map<string, CybsecsSecret>,
	roomPhase?: "ended",
): EngineResult {
	return {
		serverPayload: state,
		publicPayload: buildPublicState(state),
		timer,
		...(privatePayloads !== undefined && {
			privatePayloads: privatePayloads as Map<string, unknown>,
		}),
		...(roomPhase !== undefined && { roomPhase }),
	};
}

function enterTalking(state: CybsecsServerState): GameTimer {
	state.phase = "talking";
	for (const p of state.players.values()) p.skipVote = null;
	return makeTimer(C.TALKING_MS);
}

function enterNominating(state: CybsecsServerState): GameTimer {
	state.phase = "nominating";
	state.nominatedTeam = [];
	return makeTimer(C.NOMINATING_MS);
}

function enterVoting(state: CybsecsServerState): GameTimer {
	state.phase = "voting";
	for (const p of state.players.values()) p.vote = null;
	return makeTimer(C.VOTING_MS);
}

function enterMission(state: CybsecsServerState): GameTimer {
	state.phase = "mission";
	for (const p of state.players.values()) p.missionAction = null;
	return makeTimer(C.MISSION_MS);
}

// auto-nomination on timer expiry
function autoNominate(state: CybsecsServerState): void {
	const { playerOrder, leaderIndex, teamSize } = state;
	const candidates = [
		...playerOrder.slice(leaderIndex),
		...playerOrder.slice(0, leaderIndex),
	];
	state.nominatedTeam = candidates.slice(0, teamSize);
}

// handles obfuscate toggle
function handleToggleObfuscate(
	state: CybsecsServerState,
	playerId: string,
	active: boolean,
	currentTimer: GameTimer | null,
): EngineResult | null {
	const player = state.players.get(playerId);
	if (
		!player ||
		player.role !== "obfuscator" ||
		player.obfuscatorUsesLeft <= 0
	) {
		return null;
	}
	player.obfuscateArmed = active;
	const secret = playerSecret(state, playerId);
	const payloads = secret
		? new Map<string, CybsecsSecret>([[playerId, secret]])
		: undefined;
	return makeResult(state, currentTimer, payloads);
}

// resolves a mission: true hack count, EH logic (override mode), obfuscation
function resolveMission(state: CybsecsServerState): MissionResolution {
	const { missionIndex, nominatedTeam, players, mode } = state;
	const playerCount = state.playerOrder.length;
	const reqHacks = requiredHacksFor(playerCount, missionIndex);
	const teamPlayers = nominatedTeam.map((id) => players.get(id)!);

	let trueHackCount: number;
	let ehEffect: MissionResolution["ehEffect"];

	if (mode !== "override") {
		// baseline / exposure
		trueHackCount = teamPlayers.filter(
			(p) => p.missionAction === "hack",
		).length;
	} else {
		// override
		const realHackCount = teamPlayers.filter(
			(p) => p.alignment === "hacker" && p.missionAction === "hack",
		).length;

		const ehPlayer = teamPlayers.find((p) => p.role === "ethical_hacker");

		if (
			ehPlayer !== undefined &&
			ehPlayer.missionAction === "hack" &&
			ehPlayer.ehUsesLeft > 0
		) {
			const usesLeft = ehPlayer.ehUsesLeft - 1;

			if (realHackCount >= 1) {
				// block: neutralize all real hacks
				trueHackCount = 0;
				ehEffect = {
					playerId: ehPlayer.playerId,
					usesLeft,
					intel: ehPlayer.ehIntel,
				};
			} else {
				// backfire: EH hacked with no real hackers, detect hacker presence
				// black hat undetectable
				const anyDetectable = teamPlayers.some(
					(p) => p.alignment === "hacker" && p.role !== "black_hat",
				);
				const intel: EhIntel = anyDetectable
					? "hacker_detected"
					: "no_hacker_detected";
				trueHackCount = reqHacks;
				ehEffect = { playerId: ehPlayer.playerId, usesLeft, intel };
			}
		} else {
			// EH did not use ability or is exhausted
			trueHackCount = realHackCount;
		}
	}

	const trueResult: MissionResult = {
		missionIndex,
		hackCount: trueHackCount,
		requiredHacks: reqHacks,
		secured: trueHackCount < reqHacks,
		obfuscated: false,
	};

	// obfuscation check
	const obfuscatorPlayer = [...state.players.values()].find(
		(p) =>
			p.role === "obfuscator" && p.obfuscateArmed && p.obfuscatorUsesLeft > 0,
	);

	if (!obfuscatorPlayer) {
		return {
			publicResult: trueResult,
			trueResult,
			...(ehEffect !== undefined && { ehEffect }),
		};
	}

	// recipient is obfuscator if on team, else a random mission participant
	const recipientId = nominatedTeam.includes(obfuscatorPlayer.playerId)
		? obfuscatorPlayer.playerId
		: nominatedTeam[Math.floor(Math.random() * nominatedTeam.length)]!;

	const publicResult: MissionResult = {
		missionIndex,
		hackCount: 0,
		requiredHacks: reqHacks,
		secured: false,
		obfuscated: true,
	};

	return {
		publicResult,
		trueResult,
		...(ehEffect !== undefined && { ehEffect }),
		obfuscatorEffect: { recipientId, trueResult },
	};
}

// commits a MissionResolution to state. counter updates always use trueResult
// produces private payloads for EH, obfuscator, and intel recipient
function applyMissionResult(
	state: CybsecsServerState,
	{ publicResult, trueResult, ehEffect, obfuscatorEffect }: MissionResolution,
): Map<string, CybsecsSecret> | undefined {
	state.missionResults.push(publicResult);
	if (trueResult.secured) state.secureds++;
	else state.hacked++;
	state.phase = "mission_result";

	const payloads = new Map<string, CybsecsSecret>();

	if (ehEffect) {
		const ehPlayer = state.players.get(ehEffect.playerId);
		if (ehPlayer) {
			ehPlayer.ehUsesLeft = ehEffect.usesLeft;
			ehPlayer.ehIntel = ehEffect.intel;
			const secret = playerSecret(state, ehEffect.playerId);
			if (secret) payloads.set(ehEffect.playerId, secret);
		}
	}

	if (obfuscatorEffect) {
		const obfPlayer = [...state.players.values()].find(
			(p) => p.role === "obfuscator",
		);
		if (obfPlayer) {
			obfPlayer.obfuscatorUsesLeft--;
			obfPlayer.obfuscateArmed = false;
			const obfSecret = playerSecret(state, obfPlayer.playerId);
			if (obfSecret) payloads.set(obfPlayer.playerId, obfSecret);
		}

		const recipient = state.players.get(obfuscatorEffect.recipientId);
		if (recipient) {
			const intel: ObfuscatorIntel = {
				missionIndex: obfuscatorEffect.trueResult.missionIndex,
				hackCount: obfuscatorEffect.trueResult.hackCount,
				requiredHacks: obfuscatorEffect.trueResult.requiredHacks,
				secured: obfuscatorEffect.trueResult.secured,
			};
			recipient.obfuscatorIntel = intel;
			const recipientSecret = playerSecret(state, obfuscatorEffect.recipientId);
			if (recipientSecret)
				payloads.set(obfuscatorEffect.recipientId, recipientSecret);
		}
	}

	return payloads.size > 0 ? payloads : undefined;
}

function executeMission(state: CybsecsServerState): EngineResult {
	const resolution = resolveMission(state);
	const updatedSecrets = applyMissionResult(state, resolution);
	return makeResult(state, makeTimer(C.MISSION_RESULT_MS), updatedSecrets);
}

function resolveVoting(state: CybsecsServerState): EngineResult {
	const totalPlayers = state.playerOrder.length;
	const approvals = [...state.players.values()].filter(
		(p) => p.vote === "approve",
	).length;

	if (approvals > totalPlayers / 2) {
		return makeResult(state, enterMission(state));
	}

	state.rejectionCount++;
	if (state.rejectionCount >= C.MAX_REJECTIONS) {
		state.winner = "hacker";
		state.winReason = "five_rejections";
		state.phase = "game_over";
		return makeResult(state, null, undefined, "ended");
	}

	state.leaderIndex = (state.leaderIndex + 1) % totalPlayers;
	return makeResult(state, enterNominating(state));
}

// win detection reads true counters, never apparent public ones
function afterMissionResult(state: CybsecsServerState): EngineResult {
	if (state.secureds >= 3) {
		if (state.mode === "exposure") {
			state.phase = "doxxing";
			return makeResult(state, makeTimer(C.DOXXING_MS));
		}
		state.winner = "agent";
		state.winReason = "agents_secured_three";
		state.phase = "game_over";
		return makeResult(state, null, undefined, "ended");
	}

	if (state.hacked >= 3) {
		state.winner = "hacker";
		state.winReason = "hackers_hacked_three";
		state.phase = "game_over";
		return makeResult(state, null, undefined, "ended");
	}

	state.missionIndex++;
	state.rejectionCount = 0;
	state.passedPlayerIds = [];
	state.teamSize =
		C.MISSION_TEAM_SIZES[state.playerOrder.length]![state.missionIndex]!;
	state.leaderIndex = (state.leaderIndex + 1) % state.playerOrder.length;
	return makeResult(state, enterTalking(state));
}

function resolveDoxx(
	state: CybsecsServerState,
	targetId: string,
): EngineResult {
	const target = state.players.get(targetId);
	if (!target) return makeResult(state, makeTimer(C.DOXXING_MS));

	state.winner = target.role === "sysadmin" ? "hacker" : "agent";
	state.winReason =
		target.role === "sysadmin" ? "doxx_sysadmin" : "doxx_failed";
	state.phase = "game_over";
	return makeResult(state, null, undefined, "ended");
}

export const cybsecsEngine: GameEngine & GameEngineWithSecrets = {
	gameId: "cybersecs",

	actionSchema: CybsecsActionSchema,

	getInitialState(): CybsecsServerState {
		return {
			phase: "role_reveal",
			mode: "baseline",
			missionIndex: 0,
			playerOrder: [],
			leaderIndex: 0,
			rejectionCount: 0,
			nominatedTeam: [],
			teamSize: 0,
			passedPlayerIds: [],
			players: new Map(),
			missionResults: [],
			secureds: 0,
			hacked: 0,
			winner: null,
			winReason: null,
		};
	},

	onStart(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as CybsecsServerState;
		const playerIds = [...room.players.values()].map((p) => p.playerId);

		state.mode = pickMode(playerIds.length);
		state.playerOrder = shuffle(playerIds);
		state.leaderIndex = 0;
		state.rejectionCount = 0;
		state.missionIndex = 0;
		state.teamSize = C.MISSION_TEAM_SIZES[playerIds.length]![0]!;
		state.players = assignRoles(state.playerOrder, state.mode);
		state.phase = "role_reveal";

		return makeResult(state, makeTimer(C.ROLE_REVEAL_MS), allSecrets(state));
	},

	onAction(ctx: GameContext, playerId: string, raw: unknown): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as CybsecsServerState;
		const action = raw as CybsecsServerAction;
		const player = state.players.get(playerId);

		const noOp = (): EngineResult => makeResult(state, room.timer);

		if (!player) return noOp();

		switch (state.phase) {
			case "talking": {
				if (action.type !== "skip_vote") return noOp();
				player.skipVote = action.skip;

				const skipCount = [...state.players.values()].filter(
					(p) => p.skipVote === true,
				).length;
				if (skipCount > state.playerOrder.length / 2) {
					return makeResult(state, enterNominating(state));
				}
				return makeResult(state, room.timer);
			}

			case "nominating": {
				if (action.type === "toggle_obfuscate") {
					return (
						handleToggleObfuscate(state, playerId, action.active, room.timer) ??
						noOp()
					);
				}

				if (action.type === "pass") {
					if (state.playerOrder[state.leaderIndex] !== playerId) return noOp();
					if (state.passedPlayerIds.includes(playerId)) return noOp();
					const unpassed = state.playerOrder.filter(
						(id) => !state.passedPlayerIds.includes(id) && id !== playerId,
					);
					if (unpassed.length === 0) return noOp();

					state.passedPlayerIds.push(playerId);
					state.leaderIndex =
						(state.leaderIndex + 1) % state.playerOrder.length;
					return makeResult(state, enterNominating(state));
				}

				if (action.type !== "nominate") return noOp();
				if (state.playerOrder[state.leaderIndex] !== playerId) return noOp();
				if (action.team.length !== state.teamSize) return noOp();
				if (!action.team.every((id) => state.players.has(id))) return noOp();
				if (new Set(action.team).size !== action.team.length) return noOp();

				state.nominatedTeam = [...action.team];
				return makeResult(state, enterVoting(state));
			}

			case "voting": {
				if (action.type === "toggle_obfuscate") {
					return (
						handleToggleObfuscate(state, playerId, action.active, room.timer) ??
						noOp()
					);
				}

				if (action.type !== "vote") return noOp();
				if (player.vote !== null) return noOp();

				player.vote = action.choice;

				const allVoted = [...state.players.values()].every(
					(p) => p.vote !== null,
				);
				return allVoted ? resolveVoting(state) : makeResult(state, room.timer);
			}

			case "mission": {
				if (action.type === "toggle_obfuscate") {
					return (
						handleToggleObfuscate(state, playerId, action.active, room.timer) ??
						noOp()
					);
				}

				if (action.type !== "mission_action") return noOp();
				if (!state.nominatedTeam.includes(playerId)) return noOp();
				if (player.missionAction !== null) return noOp();

				if (action.action === "hack") {
					const canHack =
						player.alignment === "hacker" ||
						(player.role === "ethical_hacker" && player.ehUsesLeft > 0);
					if (!canHack) return noOp();
				}

				player.missionAction = action.action;

				const allSubmitted = state.nominatedTeam
					.map((id) => state.players.get(id)!)
					.every((p) => p.missionAction !== null);

				return allSubmitted
					? executeMission(state)
					: makeResult(state, room.timer);
			}

			case "doxxing": {
				if (action.type !== "doxx") return noOp();
				const doxxer = [...state.players.values()].find(
					(p) => p.role === "doxxer",
				);
				if (!doxxer || doxxer.playerId !== playerId) return noOp();
				if (!state.players.has(action.targetId)) return noOp();
				if (action.targetId === playerId) return noOp();

				return resolveDoxx(state, action.targetId);
			}

			case "role_reveal":
			case "mission_result":
			case "game_over":
				return noOp();

			default: {
				const _unreachable: never = state.phase;
				return noOp();
			}
		}
	},

	onTimerExpired(ctx: GameContext): EngineResult {
		const { room } = ctx;
		const state = room.gamePayload as CybsecsServerState;

		switch (state.phase) {
			case "role_reveal":
				return makeResult(state, enterTalking(state));

			case "talking":
				return makeResult(state, enterNominating(state));

			case "nominating":
				autoNominate(state);
				return makeResult(state, enterVoting(state));

			case "voting": {
				for (const p of state.players.values()) {
					if (p.vote === null) p.vote = "approve";
				}
				return resolveVoting(state);
			}

			case "mission": {
				for (const id of state.nominatedTeam) {
					const p = state.players.get(id)!;
					if (p.missionAction === null) p.missionAction = "secure";
				}
				return executeMission(state);
			}

			case "mission_result":
				return afterMissionResult(state);

			case "doxxing": {
				const agentPlayers = [...state.players.values()].filter(
					(p) => p.alignment === "agent",
				);
				const target =
					agentPlayers[Math.floor(Math.random() * agentPlayers.length)];

				assertInvariant(
					target !== undefined,
					"Doxxing phase has no agent-aligned players — invalid game state",
				);

				return resolveDoxx(state, target.playerId);
			}

			case "game_over":
				return makeResult(state, null);

			default: {
				const _unreachable: never = state.phase;
				return makeResult(state, null);
			}
		}
	},

	getPlayerSecret(ctx: GameContext, playerId: string): CybsecsSecret | null {
		return playerSecret(ctx.room.gamePayload as CybsecsServerState, playerId);
	},
};