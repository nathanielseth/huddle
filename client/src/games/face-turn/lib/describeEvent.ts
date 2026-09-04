import type {
	PendingInteractionView,
	MoveChainResolutionStep,
} from "@shared/games/face-turn/types";
import type { LogEntry, CrewTurnCause } from "@shared/games/face-turn/log";
import {
	getMoveDisplay,
	getCrewDisplay,
	getBossDisplay,
} from "@shared/games/face-turn/card-display";

type PlayerLookup = Record<
	string,
	{ name: string; bossId?: string; bossName?: string }
>;

function nameOf(playerMap: PlayerLookup, id: string | null): string | null {
	return id ? (playerMap[id]?.name ?? id) : null;
}

function bossNameOf(playerMap: PlayerLookup, id: string): string {
	const entry = playerMap[id];
	const player = entry?.name ?? id;
	return entry?.bossName ? `${player}'s ${entry.bossName}` : player;
}

export function describeChainResolutionStep(
	step: MoveChainResolutionStep,
	playerMap: PlayerLookup,
): string {
	switch (step.kind) {
		case "executed": {
			const move = getMoveDisplay(step.moveId);
			return step.damageDealt
				? `${move.name} — ${step.damageDealt} dmg`
				: move.name;
		}
		case "negated": {
			const negator = getMoveDisplay(step.negatorMoveId);
			if (!step.negatedMoveId) return `${negator.name} — nothing to negate`;
			const negated = getMoveDisplay(step.negatedMoveId);
			return `${negator.name} negates ${negated.name}`;
		}
		case "reflected": {
			const negator = getMoveDisplay(step.negatorMoveId);
			if (!step.negatedMoveId) return `${negator.name} — nothing to reflect`;
			const negated = getMoveDisplay(step.negatedMoveId);
			const who = step.negatedActorId
				? (nameOf(playerMap, step.negatedActorId) ?? "them")
				: "them";
			return step.reflectedDamage
				? `${negator.name} reflects ${negated.name} — ${step.reflectedDamage} dmg back to ${who}`
				: `${negator.name} reflects ${negated.name}`;
		}
	}
}

export function describeChainResolutionLog(
	entry: Extract<LogEntry, { kind: "move_chain_resolved" }>,
	playerMap: PlayerLookup,
): string[] {
	const name = (id: string | null) => nameOf(playerMap, id) ?? "Someone";
	return entry.steps.map((step) => {
		switch (step.kind) {
			case "executed": {
				const move = getMoveDisplay(step.moveId);
				return step.damageDealt
					? `${name(step.actorId)} played ${move.name} — ${step.damageDealt} dmg`
					: `${name(step.actorId)} played ${move.name}`;
			}
			case "negated": {
				const negator = getMoveDisplay(step.negatorMoveId);
				if (!step.negatedMoveId) {
					return `${name(step.negatorActorId)} played ${negator.name} — nothing to negate`;
				}
				const negated = getMoveDisplay(step.negatedMoveId);
				return `${name(step.negatorActorId)} negated ${name(step.negatedActorId)}'s ${negated.name} with ${negator.name}`;
			}
			case "reflected": {
				const negator = getMoveDisplay(step.negatorMoveId);
				if (!step.negatedMoveId) {
					return `${name(step.negatorActorId)} played ${negator.name} — nothing to reflect`;
				}
				const negated = getMoveDisplay(step.negatedMoveId);
				const base = `${name(step.negatorActorId)} reflected ${name(step.negatedActorId)}'s ${negated.name} with ${negator.name}`;
				return step.reflectedDamage
					? `${base} — ${step.reflectedDamage} dmg back to ${name(step.negatedActorId)}`
					: base;
			}
		}
	});
}

function responderOf(pi: PendingInteractionView): string {
	if (pi.type === "choose_crew_to_turn") return pi.chooserPlayerId;
	if (pi.type === "truth_serum_reveal") return pi.targetPlayerId;
	return pi.actorId;
}

export function describePendingInteraction(
	pi: PendingInteractionView,
	playerMap: PlayerLookup,
): string {
	const who = nameOf(playerMap, responderOf(pi)) ?? "Someone";
	switch (pi.type) {
		case "peek_discard":
			return `${who} is peeking the discard pile`;
		case "crew_reactivate":
			return `${who} is reactivating a Crew slot`;
		case "poison_target_pick":
			return `${who} is choosing a poison target`;
		case "choose_crew_to_turn":
			return `${who} is choosing a Crew slot to turn on ${nameOf(playerMap, pi.targetPlayerId) ?? "someone"}`;
		case "choose_discard_count":
			return `${who} is choosing how many cards to discard`;
		case "choose_from_discard":
			return `${who} is picking a card from the discard pile`;
		case "dig_deep_pick":
			return `${who} is digging through their deck`;
		case "switch_up_pick":
			return `${who} is switching Crew slots`;
		case "tactical_support_hide_offer":
			return `${who} is deciding whether to hide a Crew`;
		case "bear_bones_bonus_strike":
			return `${who} is deciding on a bonus strike`;
		case "bear_bones_steal_pick":
			return `${who} is choosing who to steal Cash from`;
		case "void_legs_choice":
			return `${who} is deciding on Void Legs`;
		case "background_check_guess":
			return `${who} is guessing a Crew's class`;
		case "watcher_hide_offer":
			return `${who} is deciding whether to hide a Crew`;
		case "lighthouse_disable_pick":
			return `${who} is picking Crew to disable`;
		case "tag_out_pick":
			return `${who} is tagging out a Crew member`;
		case "truth_serum_reveal":
			return `${who} is revealing a Crew slot`;
		case "too_big_swap_pick":
			return `${who} is picking a Crew slot to swap`;
		case "watcher_steal_pick":
			return `${who} is picking a card to steal`;
		case "belladonna_copy_pick":
			return `${who} is deciding whether to copy an enemy Move`;
	}
}

function describeCrewTurnCause(via: CrewTurnCause): string | null {
	switch (via.reason) {
		case "strike":
			return null; // implied by context, no extra text needed
		case "challenge_loss":
			return "challenge lost";
		case "face_turn":
			return "Face Turn";
		case "class_action":
			return null; // voluntary hide, always self-initiated — no cause to add
		case "boss_command":
		case "boss_passive":
			return getBossDisplay(via.bossId).name;
		case "crew_passive":
			return getCrewDisplay(via.crewId).name;
		case "move":
			return getMoveDisplay(via.moveId).name;
	}
}

export function describeLogEntry(
	entry: LogEntry,
	playerMap: PlayerLookup,
): string {
	const name = (id: string | null) => nameOf(playerMap, id);
	switch (entry.kind) {
		case "turn_start":
			return `Round ${entry.roundNumber} — ${name(entry.playerId)}'s turn`;
		case "move_played": {
			const move = getMoveDisplay(entry.moveId);
			return entry.targetPlayerId
				? `${name(entry.actorId)} played ${move.name} on ${name(entry.targetPlayerId)}`
				: `${name(entry.actorId)} played ${move.name}`;
		}
		case "class_action_declared": {
			const verb =
				entry.action === "strike"
					? "declared a Strike"
					: entry.action === "collect"
						? "declared Collect"
						: entry.action === "hide"
							? "declared Hide"
							: "declared Defend";
			return entry.targetPlayerId
				? `${name(entry.actorId)} ${verb} on ${name(entry.targetPlayerId)}`
				: `${name(entry.actorId)} ${verb}`;
		}
		case "damage_dealt": {
			const via = entry.moveId
				? ` with ${getMoveDisplay(entry.moveId).name}`
				: "";
			return `${name(entry.sourceActorId)} dealt ${entry.amount} dmg to ${bossNameOf(playerMap, entry.targetPlayerId)}${via}`;
		}
		case "strike_resolved": {
			const target = name(entry.targetPlayerId);
			switch (entry.outcome) {
				case "executed":
					return `${name(entry.attackerId)} executed ${bossNameOf(playerMap, entry.targetPlayerId)}!`;
				case "negated":
					return `Strike on ${target} was negated (${entry.negatedBy}).`;
				case "crew_killed":
					return `${target}'s Crew was killed.`;
				case "crew_turned":
					return `${target}'s Crew was revealed.`;
			}
			break;
		}
		case "crew_turned": {
			const crew = getCrewDisplay(entry.crewId).name;
			const owner = name(entry.playerId);
			const cause = describeCrewTurnCause(entry.via);
			const base = entry.causedByActorId
				? `${name(entry.causedByActorId)} turned ${owner}'s ${crew} face-up`
				: `${owner}'s ${crew} turned face-up`;
			return cause ? `${base} (${cause})` : base;
		}
		case "crew_hidden": {
			const crew = getCrewDisplay(entry.crewId).name;
			const cause = describeCrewTurnCause(entry.via);
			const base = `${name(entry.playerId)}'s ${crew} was hidden face-down`;
			return cause ? `${base} (${cause})` : base;
		}
		case "boss_command_used": {
			const boss = getBossDisplay(entry.bossId).name;
			const target = entry.targetPlayerId
				? ` on ${name(entry.targetPlayerId)}`
				: "";
			const result =
				entry.succeeded === null
					? ""
					: entry.succeeded
						? " — correct!"
						: " — wrong.";
			return `${name(entry.actorId)} used ${boss}'s Boss Command${target}${result}`;
		}
		case "crew_reserve_swapped":
			return `${name(entry.actorId)} swapped in a reserve crew`;
		case "challenge_declared":
			return `${name(entry.challengerId)} is challenging ${name(entry.actorId)}`;
		case "challenge_resolved":
			return entry.success
				? `${name(entry.challengerId)} successfully called a bluff on ${name(entry.actorId)}!`
				: `${name(entry.challengerId)}'s challenge on ${name(entry.actorId)} failed.`;
		case "move_chain_resolved": {
			const [p1, p2] = entry.participants;
			const n = entry.steps.length;
			return `Move chain between ${name(p1)} and ${name(p2)} resolved (${n} step${n === 1 ? "" : "s"})`;
		}
		case "player_eliminated":
			return `${name(entry.playerId)} was eliminated (${entry.cause === "boss_hp_zero_execution" ? "executed" : "boss HP reached zero"})`;
		case "game_won":
			return entry.winnerId
				? `${name(entry.winnerId)} wins!`
				: entry.winCondition === "draw"
					? "Game ended in a draw."
					: "Game over.";
	}
}