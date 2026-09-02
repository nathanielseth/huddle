import type { LogEntry } from "./log";

export interface FaceturnsConfigPayload {
	mode: "duel" | "ffa" | "teams";
	teamChoices: Record<string, "A" | "B">;
}

export type FaceturnsPhase =
	| "drafting"
	| "mulligan"
	| "rps"
	| "rps_reveal"
	| "rps_order_choice"
	| "active_turn"
	| "move_chain_window"
	| "challenge_window"
	| "defend_window"
	| "defend_declared"
	| "defend_challenge_window"
	| "finished";

export type CrewClass = "striker" | "defender" | "collector" | "hider";
export type MoveType = "burst" | "slow" | "active";
export type ClassAction = "strike" | "defend" | "collect" | "hide";

export type GameMode = "duel" | "ffa" | "teams";

export interface BossCardDef {
	readonly id: string;
	readonly name: string;
	readonly flavorText: string;
	readonly maxHp: number;
}

export interface CrewCardDef {
	readonly id: string;
	readonly name: string;
	readonly class: CrewClass;
	readonly cost: number;
	readonly flavorText: string;
}

export interface MoveCardDef {
	readonly id: string;
	readonly name: string;
	readonly baseCost: number;
	readonly flavorText: string;

	// null while move type not assigned (draft selection)
	readonly moveType: MoveType | null;
	readonly effectSummary: string;
}

export type CrewSlotStatus = "face_down" | "face_up" | "empty";

export interface CrewSlotView {
	readonly slotIndex: number;
	readonly status: CrewSlotStatus;
	readonly crewId: string | null;
	readonly crewClass: CrewClass | null;
	readonly isTurned: boolean;
	readonly extraClasses: readonly CrewClass[];
	readonly isPassiveDisabled: boolean;
}

export interface BossView {
	readonly id: string;
	readonly name: string;
	readonly hp: number;
	readonly maxHp: number;

	// damage absorbed before hp
	readonly armor: number;

	// frontline immunity countdown, ticks down each round end
	readonly armorTurnsRemaining: number | null;

	// once per game
	readonly commandUsed: boolean;
	readonly passiveEffects: string[];
}

export interface ActiveMoveSlotView {
	readonly slotIndex: number;
	readonly moveId: string | null;
	readonly moveName: string | null;
}

export interface FaceturnsPlayerView {
	readonly playerId: string;

	// hand size exposed, card contents private
	readonly handSize: number;
	readonly deckSize: number;
	readonly discardSize: number;
	readonly cash: number;
	readonly boss: BossView;
	readonly crewSlots: readonly CrewSlotView[];
	readonly activeMoveSlots: readonly ActiveMoveSlotView[];
	readonly hasBluffedSuccessfully: boolean;
	readonly hasCalledBluffSuccessfully: boolean;
	readonly totalCardsDiscarded: number;
	readonly totalMovesPlayed: number;
	readonly hasArmoredBossThisGame: boolean;

	// no face-down crew left to turn, next strike executes boss instead
	readonly isExposed: boolean;

	// total incoming poison damage from all sources, applied at round end
	readonly poisonStacks: number;

	readonly cashGainPerTurn: number;
	readonly moveBaseCostReduction: number;
	readonly classActionCostReduction: number;
	readonly isEliminated: boolean;
	readonly teamIndex: number;
	readonly mulliganDecided: boolean;

	// the-dealer passive: discard a move from hand for cash on own turn
	readonly hasSellCards: boolean;
	readonly sellCardCashAmount: number;
}

export type PendingActionType =
	| "class_action_strike"
	| "class_action_collect"
	| "class_action_hide"
	| "class_action_defend"
	| "card_strike"; // burst-move defendable strike

export interface PendingAction {
	readonly type: PendingActionType;
	readonly actorId: string;
	readonly targetCrewSlot: number | null;
	readonly targetAllySlot: number | null;

	// only set for move actions, not class actions
	readonly moveId: string | null;

	// already deducted from actor, refunded if cancelled
	readonly cashCost: number;
	readonly targetPlayerId: string | null;

	// set for defends; card_strike defends can't be challenged
	readonly originalActionType: PendingActionType | null;
}

export interface MoveChainEntry {
	readonly moveId: string;
	readonly actorId: string;
	readonly targetCrewSlot: number | null;
	readonly targetAllySlot: number | null;
	readonly targetPlayerId: string | null;
	readonly cashCost: number;
}

export interface MoveChainView {
	readonly participants: readonly [string, string];
	readonly chain: readonly MoveChainEntry[];
	readonly responderId: string;
}

// one entry per stack pop, lifo order; negated fields null when stack empty
export type MoveChainResolutionStep =
	| {
			readonly kind: "executed";
			readonly moveId: string;
			readonly actorId: string;
			readonly damageDealt: number | null;
	  }
	| {
			readonly kind: "negated";
			readonly negatorMoveId: string;
			readonly negatorActorId: string;
			readonly negatedMoveId: string | null;
			readonly negatedActorId: string | null;
	  }
	| {
			readonly kind: "reflected";
			readonly negatorMoveId: string;
			readonly negatorActorId: string;
			readonly negatedMoveId: string | null;
			readonly negatedActorId: string | null;
			readonly reflectedDamage: number | null;
	  };

export interface MoveChainResolutionView {
	readonly steps: readonly MoveChainResolutionStep[];
}

export interface TurnInfo {
	readonly turnNumber: number;
	readonly activePlayerId: string;
	readonly classActionUsedThisTurn: boolean;
}

export type RpsChoice = "rock" | "paper" | "scissors";

export interface RpsState {
	readonly player1Choice: RpsChoice | null;
	readonly player2Choice: RpsChoice | null;
	// ties coinflipped immediately, result never tie
	readonly result: "player1" | "player2" | null;
}

export interface RpsOrderChoiceState {
	readonly winnerId: string;
}

export interface DraftPlayerView {
	readonly playerId: string;
	readonly selectedCount: number;
	readonly isDraftLocked: boolean;
}

export type PendingInteractionView =
	| { type: "peek_discard"; actorId: string }
	| { type: "crew_reactivate"; actorId: string; eligibleSlots: number[] }
	| {
			type: "poison_target_pick";
			actorId: string;
			eligibleTargetIds: string[];
			damagePerRound: number;
	  }
	| {
			type: "choose_crew_to_turn";
			actorId: string;
			targetPlayerId: string;
			chooserPlayerId: string;
			eligibleSlots: number[];
			isStrike: boolean;
	  }
	| {
			type: "choose_discard_count";
			actorId: string;
			maxCount: number;
			targetPlayerId: string;
			damagePerCard: number;
	  }
	| {
			type: "choose_from_discard";
			actorId: string;
			discardPileSnapshot: readonly string[];
	  }
	| {
			// top of deck reveal private to actor
			type: "dig_deep_pick";
			actorId: string;
			maxPicks?: number;
	  }
	| {
			type: "switch_up_pick";
			actorId: string;
			faceUpSlots: number[];
			faceDownSlots: number[];
	  }
	| {
			type: "tactical_support_hide_offer";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			type: "bear_bones_bonus_strike";
			actorId: string;
			eligibleTargetIds: string[];
	  }
	| {
			type: "bear_bones_steal_pick";
			actorId: string;
			eligibleTargetIds: string[];
			amount: number;
	  }
	| {
			type: "void_legs_choice";
			actorId: string;
			hasCardsToDiscard: boolean;
	  }
	| {
			type: "background_check_guess";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			type: "watcher_hide_offer";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: number }[];
	  }
	| {
			type: "lighthouse_disable_pick";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: number }[];
			maxPicks?: number;
	  }
	| {
			type: "tag_out_pick";
			actorId: string;
			teammateId: string;
			ownEligibleSlots: number[];
			teammateEligibleSlots: number[];
	  }
	| {
			type: "truth_serum_reveal";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			type: "too_big_swap_pick";
			actorId: string;
			ownSlot: number;
			eligibleTargets: readonly { playerId: string; slot: number }[];
	  }
	| {
			// belladonna: copy enemy active move, or pass
			type: "belladonna_copy_pick";
			actorId: string;
			eligibleTargets: readonly {
				playerId: string;
				slot: number;
				moveId: string;
			}[];
	  }
	| {
			// revealed cards private to actor
			type: "watcher_steal_pick";
			actorId: string;
			targetPlayerId: string;
	  };

export interface FaceturnsState {
	readonly phase: FaceturnsPhase;
	readonly players: Readonly<Record<string, FaceturnsPlayerView>>;

	// rps representative order, needed for serialisation and turn order
	readonly playerOrder: readonly [string, string];
	readonly mode: GameMode;

	// in ffa/duel each player is a solo team
	readonly teams: readonly (readonly string[])[];

	// turn order with eliminated players filtered out
	readonly turnOrder: readonly string[];
	readonly eliminatedPlayers: readonly string[];
	readonly challengeEligiblePlayerIds: readonly string[];
	readonly turn: TurnInfo | null;
	readonly pendingAction: PendingAction | null;
	readonly lastResolution: ResolutionResult | null;
	// step by step log of most recently closed chain, overwritten each chain
	readonly lastChainResolution: MoveChainResolutionView | null;

	// append-only match log, capped server-side; never overwritten
	readonly log: readonly LogEntry[];

	// null for ffa mode
	readonly rps: RpsState | null;
	// non-null only during rps_order_choice phase
	readonly rpsOrderChoice: RpsOrderChoiceState | null;
	readonly draft: Readonly<Record<string, DraftPlayerView>> | null;
	readonly pendingInteraction: PendingInteractionView | null;
	readonly moveChain: MoveChainView | null;
	readonly roundNumber: number;
	readonly winnerId: string | null;
	readonly winCondition: WinCondition | null;
}

export type WinCondition =
	| "boss_hp_zero_execution"
	| "boss_hp_zero_damage"
	| "void_assembly"
	| "round_limit"
	| "draw";

export type ResolutionResult =
	| {
			readonly type:
				| "challenge_success"
				| "challenge_fail"
				| "action_resolved"
				| "action_negated";
			readonly challengerId: string | null;
			readonly actorId: string;
			readonly crewTurnedPlayerId: string | null;
			readonly crewTurnedSlot: number | null;
			readonly executedPlayerId: string | null;
	  }
	| {
			readonly type: "crew_class_revealed";
			readonly actorId: string;
			readonly targetPlayerId: string;
			readonly revealedSlot: number;
			readonly revealedClass: CrewClass;
	  }
	| {
			readonly type: "strike_or_execute_resolved";
			readonly attackerId: string;
			readonly targetPlayerId: string;
			readonly via: "strike" | "face_turn" | "challenge_loss";
			readonly outcome: "crew_turned" | "crew_killed" | "executed" | "negated";
			readonly crewTurnedSlot: number | null;
			readonly crewKilledSlot: number | null;
			readonly crewRefilledFromReserve: boolean;
			readonly negatedBy: "terminal" | "immunity" | null;
			readonly survivedViaLifeInsurance: boolean;
	  };

export interface FaceturnsSecret {
	readonly hand: readonly string[];

	// hand card ids (may include duplicates) playable right now
	readonly playableMoveIds: readonly string[];

	// hand card ids playable via chain_play_burst/chain_play_slow right now
	// empty unless this player is a participant in the active move chain
	readonly chainPlayableMoveIds: readonly string[];

	// slot index to crew id; hidden until face-up
	readonly crewAssignments: Readonly<Record<number, string>>;

	readonly reserveCrewId: string | null;

	// temporary per-turn cost overrides from discount effects
	readonly costOverrides: Readonly<Record<string, number>>;

	// draft picks visible only to this player
	readonly draftSelections: {
		readonly bossId: string | null;
		readonly crewIds: readonly string[];
		readonly moveIds: readonly string[];
	} | null;

	// two cards revealed when resolving peek effects
	readonly peekRevealedCards: readonly [string, string] | null;
	readonly digDeepRevealedCards: readonly string[] | null;

	// two cards revealed from enemy hand for watcher steal
	readonly watcherStealRevealedCards: readonly [string, string] | null;
}