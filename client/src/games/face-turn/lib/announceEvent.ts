import type { LogEntry } from "@shared/games/face-turn/log";
import type { MoveType } from "@shared/games/face-turn/types";

type PlayerLookup = Record<string, { name: string }>;

function nameOf(playerMap: PlayerLookup, id: string | null): string {
	if (!id) return "Someone";
	return playerMap[id]?.name ?? id;
}

export interface Announcement {
	readonly id: string;
	readonly headline: string;
	readonly subline: string | null;
	readonly tone: MoveType | "neutral" | "danger" | "success";
}

const CLASS_ACTION_LABEL: Record<string, string> = {
	strike: "Strike",
	collect: "Collect",
	hide: "Hide",
	defend: "Defend",
};

// move_played is excluded: it has its own rail flash, not the top banner
export function toAnnouncement(
	entry: LogEntry,
	playerMap: PlayerLookup,
): Announcement | null {
	const who = (id: string | null) => nameOf(playerMap, id);

	switch (entry.kind) {
		case "turn_start":
			return null;

		case "move_played":
			return null;

		case "class_action_declared": {
			const label = CLASS_ACTION_LABEL[entry.action] ?? entry.action;
			return {
				id: `log-${entry.seq}`,
				headline: label,
				subline: entry.targetPlayerId
					? `${who(entry.actorId)} → ${who(entry.targetPlayerId)}`
					: who(entry.actorId),
				tone: entry.action === "defend" ? "slow" : "burst",
			};
		}

		case "strike_resolved": {
			const target = who(entry.targetPlayerId);
			switch (entry.outcome) {
				case "executed":
					return {
						id: `log-${entry.seq}`,
						headline: "Executed!",
						subline: `${who(entry.attackerId)} took out ${target}'s Boss`,
						tone: "danger",
					};
				case "negated":
					return {
						id: `log-${entry.seq}`,
						headline: "Strike Negated",
						subline: `${target} — ${entry.negatedBy}`,
						tone: "neutral",
					};
				case "crew_killed":
					return {
						id: `log-${entry.seq}`,
						headline: "Crew Killed",
						subline: target,
						tone: "danger",
					};
				case "crew_turned":
					return {
						id: `log-${entry.seq}`,
						headline: "Crew Revealed",
						subline: target,
						tone: "neutral",
					};
			}
			break;
		}

		case "challenge_declared":
			return {
				id: `log-${entry.seq}`,
				headline: "Challenge!",
				subline: `${who(entry.challengerId)} → ${who(entry.actorId)}`,
				tone: "neutral",
			};

		case "challenge_resolved":
			return entry.success
				? {
						id: `log-${entry.seq}`,
						headline: "Bluff Called!",
						subline: `${who(entry.challengerId)} caught ${who(entry.actorId)}`,
						tone: "success",
					}
				: {
						id: `log-${entry.seq}`,
						headline: "Challenge Failed",
						subline: `${who(entry.challengerId)} → ${who(entry.actorId)}`,
						tone: "neutral",
					};

		case "move_chain_resolved": {
			const n = entry.steps.length;
			const [p1, p2] = entry.participants;
			return {
				id: `log-${entry.seq}`,
				headline: "Chain Resolved",
				subline: `${who(p1)} vs ${who(p2)} — ${n} step${n === 1 ? "" : "s"}`,
				tone: "neutral",
			};
		}

		case "player_eliminated":
			return {
				id: `log-${entry.seq}`,
				headline: "Eliminated",
				subline: who(entry.playerId),
				tone: "danger",
			};

		case "game_won":
			return {
				id: `log-${entry.seq}`,
				headline: "Game Over",
				subline: entry.winnerId
					? `${who(entry.winnerId)} wins!`
					: "It's a draw.",
				tone: "success",
			};

		case "damage_dealt":
			return null;
	}
	return null;
}