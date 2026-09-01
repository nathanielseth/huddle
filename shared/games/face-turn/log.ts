import type { MoveChainResolutionStep } from "./types";

export type LogEntry =
	| {
			readonly seq: number;
			readonly kind: "turn_start";
			readonly playerId: string;
			readonly roundNumber: number;
	  }
	| {
			readonly seq: number;
			readonly kind: "move_played";
			readonly actorId: string;
			readonly moveId: string;
			readonly targetPlayerId: string | null;
	  }
	| {
			readonly seq: number;
			readonly kind: "class_action_declared";
			readonly actorId: string;
			readonly action: "strike" | "collect" | "hide" | "defend";
			readonly targetPlayerId: string | null;
	  }
	| {
			readonly seq: number;
			readonly kind: "damage_dealt";
			readonly sourceActorId: string;
			readonly targetPlayerId: string;
			readonly amount: number;
			// optional because poison ticks and similar damage sources aren't tied to a played card
			readonly moveId?: string;
	  }
	| {
			readonly seq: number;
			readonly kind: "strike_resolved";
			readonly attackerId: string;
			readonly targetPlayerId: string;
			readonly via: "strike" | "face_turn" | "challenge_loss";
			readonly outcome: "crew_turned" | "crew_killed" | "executed" | "negated";
			readonly negatedBy: "terminal" | "immunity" | null;
	  }
	| {
			readonly seq: number;
			readonly kind: "crew_turned";
			readonly playerId: string;
			readonly slot: 0 | 1;
			readonly crewId: string;
			// null for self-caused turns or when no distinct actor is responsible
			readonly causedByActorId: string | null;
	  }
	| {
			readonly seq: number;
			readonly kind: "crew_hidden";
			readonly playerId: string;
			readonly slot: 0 | 1;
			readonly crewId: string;
			readonly causedByEnemy: boolean;
	  }
	| {
			readonly seq: number;
			readonly kind: "boss_command_used";
			readonly actorId: string;
			readonly bossId: string;
			readonly targetPlayerId: string | null;
			// only set for guess-based commands like the razor, null otherwise
			readonly succeeded: boolean | null;
	  }
	| {
			readonly seq: number;
			readonly kind: "challenge_resolved";
			readonly challengerId: string;
			readonly actorId: string;
			readonly success: boolean;
	  }
	| {
			readonly seq: number;
			readonly kind: "move_chain_resolved";
			readonly participants: readonly [string, string];
			readonly steps: readonly MoveChainResolutionStep[];
	  }
	| {
			readonly seq: number;
			readonly kind: "player_eliminated";
			readonly playerId: string;
			readonly cause: "boss_hp_zero_execution" | "boss_hp_zero_damage";
	  }
	| {
			readonly seq: number;
			readonly kind: "game_won";
			readonly winnerId: string | null;
			readonly winCondition:
				| "boss_hp_zero_execution"
				| "boss_hp_zero_damage"
				| "void_assembly"
				| "round_limit"
				| "draw";
	  };

export type LogEntryKind = LogEntry["kind"];