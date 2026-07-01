import type {
	FaceturnsPhase,
	CrewClass,
	ClassAction,
	RpsChoice,
	WinCondition,
	ResolutionResult,
	GameMode,
	MoveChainEntry,
} from "../../../../shared/games/face-turn";

export interface GameConfig {
	mode: GameMode;
	// present only for teams mode — two fixed arrays of player ids
	teams?: [string[], string[]];
}

export interface FaceturnServerPlayer {
	readonly playerId: string;
	teamIndex: number;

	bossId: string;
	bossHp: number;
	bossMaxHp: number;
	bossShield: number;
	// frontline immunity — turns of immunity remaining
	// decremented once per round end; exact in duels, an approximation in ffa/teams
	bossImmunityTurns: number;
	bossCommandUsed: boolean;

	// always exactly two crew slots
	crewIds: [string | null, string | null];
	crewTurned: [boolean, boolean];
	// extra classes from lotus, cristatella etc — keyed by slot index
	crewClassOverrides: Map<number, Set<CrewClass>>;

	hand: string[];
	deck: string[];
	discardPile: string[];

	// active move zone — max 3 slots (constant)
	activeMoves: Array<string | null>;

	cash: number;

	hasBluffedSuccessfully: boolean;
	hasCalledBluffSuccessfully: boolean;
	totalCardsDiscarded: number;
	totalMovesPlayed: number;
	hasShieldedBossThisGame: boolean;
	// set permanently true the first time any crew turns face-up, regardless
	// of later unturns — powers suplex's "this game" condition
	// never cleared, same pattern as hasBluffedSuccessfully
	hasTurnedAllyCrewThisGame: boolean;

	// inbound poison — maps source player id → damage per round; stacks additively
	incomingPoison: Map<string, number>;

	// derived passive stats
	//
	// never mutated directly — recomputePassives calculates them from all
	// active sources (turned crew, active moves, boss) to prevent desyncs

	// side hustle: cash granted at start of each turn the player takes
	cashGainPerTurn: number;
	// dataminer, the dealer (passive), command center: cards drawn at start of turn
	drawPerTurn: number;
	// blood money — cash gained whenever any opponent plays a move or
	// performs a strike (declared class action or card-driven)
	// both halves wired separately in game.ts and effects.ts
	cashOnEnemyMoveOrStrike: number;
	healOnMovePlayed: number;
	crewSkillsDisabled: boolean;
	damageMultiplier: number;
	damageReductionPercent: number;

	hasWatcherPassive: boolean;
	// lighthouse: subtractive reduction applied to block class-action cost (min 0)
	blockCostReduction: number;
	// void torso: shield granted to this player's boss at start of every turn
	shieldPerTurn: number;
	// big voucher: permanent-while-active cost reduction applied to all moves
	// this player plays (minimum 0) — distinct from per-card costOverrides
	moveBaseCostReduction: number;
	survivorModeActive: boolean;

	// void arms: when true, this player chooses which of their own face-down
	// crew gets turned — instead of the attacker choosing (engine default)
	hasVoidArms: boolean;
	// supply drop: when true, every collector action by this player or a
	// teammate grants supplyDropCashAmount cash to every team member
	// trigger-based, not per-turn accumulation
	hasSupplyDrop: boolean;
	supplyDropCashAmount: number;
	// derived — true when at least one living ally's active-zone life
	// insurance has this player locked-in as the protected target
	// recomputePassives scans all living teammates' lifeInsuranceTargets
	hasLifeInsurance: boolean;
	// maps this player's active-move slot index (0–2) to the protected ally's
	// playerId, locked at cast time; only life insurance writes to this map
	// cleared when the slot's life insurance is consumed or discarded
	lifeInsuranceTargets: Map<0 | 1 | 2, string>;
	// false flag operation: when true, a failed challenge (bluff called
	// correctly) prevents the crew-turning penalty and discards the false
	// flag active move instead
	hasFalseFlag: boolean;
	// doctor norman: one-shot flag set when totalCardsDiscarded hits 6 exactly
	doctorNormanTriggered: boolean;
	// vanessa de vera: per-turn flag reset in startTurn — prevents re-triggering
	vanessaDrawUsedThisTurn: boolean;
	// too big: once-per-game flag for the optional self-unturn offer
	tooBigUnturnUsed: boolean;
	// lighthouse: set of this player's own crew slot indices whose passive is
	// currently disabled — cleared when that crew unturns
	disabledPassiveSlots: Set<0 | 1>;
	// prank call: per-round flag reset alongside other round-end resets
	prankCallBonusUsedThisRound: boolean;

	// void legs: when true, a discard-for-damage offer opens at start of turn
	hasVoidLegsChoice: boolean;
	voidLegsDiscardCost: number;
	voidLegsDamage: number;
	// background check: when true, an opponent who challenges this player's
	// class action must guess a face-down crew's class first
	hasBackgroundCheck: boolean;

	hasPrankCall: boolean;
	prankCallBonusAmount: number;

	// turn-scoped (reset each turn)
	playedMoveThisTurn: boolean;
	classActionUsedThisTurn: boolean;
	costOverrides: Map<string, number>; // move id → overridden cost (per turn)

	draftSelections: DraftSelections | null;
	isDraftLocked: boolean;
}

export interface DraftSelections {
	bossId: string | null;
	crewIds: string[];
	moveIds: string[];
}

// move chain — active only during move_chain_window
// only the two participants (caster and original target) can add entries
// burst moves resolve immediately; only slow moves stack
export interface ServerMoveChain {
	// the two players who may act in this chain
	participants: [string, string];
	// lifo stack of slow moves — bottom is first played, top is most recent
	stack: MoveChainEntry[];
	// the player whose turn it is to respond — starts as the original target,
	// flips whenever a slow move is pushed
	responderId: string;
	// stack depth at the moment responderId last changed — when the current
	// responder passes and the stack hasn't grown past this, they added no
	// slow move, so the chain resolves immediately without asking the other
	// participant
	stackDepthAtLastSlow: number;
}

export interface FaceturnServerState {
	phase: FaceturnsPhase;
	players: Map<string, FaceturnServerPlayer>;
	mode: GameMode;

	// in ffa/duel each player is their own solo team; in teams, indices 0 and 1
	teams: string[][];

	// ordered list of player ids for turn rotation
	turnOrder: string[];

	// kept for rps serialisation and to identify the two rps representatives
	playerOrder: [string, string];

	eliminatedPlayers: Set<string>;

	turnNumber: number;
	// increments when all living players have taken a turn (full round cycle)
	roundNumber: number;
	activePlayerId: string | null;

	pendingAction: ServerPendingAction | null;
	challengeEligiblePlayerIds: string[];

	moveChain: ServerMoveChain | null;

	// a card effect awaiting a second player choice before resolution continues
	pendingInteraction: PendingInteraction | null;

	lastResolution: ResolutionResult | null;

	// the watcher's command — a one-shot private reveal of an enemy's full
	// hand, delivered only to forPlayerId via getPlayerSecret
	// cleared after the next state build; must not leak to opponents
	watcherReveal: { forPlayerId: string; hand: readonly string[] } | null;

	rpsChoices: Map<string, RpsChoice>;
	// never 'tie' — ties coinflip to a winner immediately, so a first mover
	// always exists
	rpsResult: "player1" | "player2" | null;

	// winnerId is null for draws
	winnerId: string | null;
	winCondition: WinCondition | null;

	// public state cache — invalidated on every mutation to avoid stale broadcasts
	_publicStateCacheValid: boolean;
	_cachedPublicState: unknown;
}

export type PendingInteraction =
	| {
			// look at 2 revealed enemy cards, pick which to discard
			type: "peek_discard";
			actorId: string;
			revealedCards: [string, string];
	  }
	| {
			// neeto's clock: pick a turned crew to reactivate
			type: "crew_reactivate";
			actorId: string;
			eligibleSlots: number[];
	  }
	| {
			// g-rone's on-flip choice: which enemy gets per-round poison damage
			type: "poison_target_pick";
			actorId: string;
			eligibleTargetIds: string[];
			damagePerRound: number;
	  }
	| {
			// challenge/bluff consequence and strike resolution — when a player
			// has 2+ unturned crew, someone must pick which slot to turn
			// chooserPlayerId is the attacker by default, or the defender if
			// they have void arms; isStrike gates blood money (only true for
			// genuine strikes, not challenge-resolution turns)
			type: "choose_crew_to_turn";
			targetPlayerId: string;
			actorId: string;
			chooserPlayerId: string;
			eligibleSlots: number[];
			isStrike: boolean;
	  }
	| {
			// empty the clip: actor picks how many cards (0..maxCount) to discard
			// damage resolved against targetPlayerId captured when the card was
			// played — enemy-fallback logic not re-evaluated later
			type: "choose_discard_count";
			actorId: string;
			maxCount: number;
			targetPlayerId: string;
			damagePerCard: number;
	  }
	| {
			// take it back: actor picks one card to return from their discard
			// pile to hand — snapshot is the full pile (public info already via
			// discardSize) so the client can render concrete options
			type: "choose_from_discard";
			actorId: string;
			discardPileSnapshot: readonly string[];
	  }
	| {
			// dig deep: top `lookCount` cards of the actor's deck, revealed
			// privately to the actor only — not mirrored into PendingInteractionView
			type: "dig_deep_pick";
			actorId: string;
			revealedCards: readonly string[];
	  }
	| {
			// handles: genuine optional unturn of one of the actor's own face-up
			// crew (both guaranteed face-up when this opens)
			type: "handles_unturn_offer";
			actorId: string;
			eligibleSlots: number[];
	  }
	| {
			// switch up: actor turns one face-up ally crew face-down and a
			// different face-down ally crew face-up — the lists are disjoint
			type: "switch_up_pick";
			actorId: string;
			faceUpSlots: number[];
			faceDownSlots: number[];
	  }
	| {
			// tactical support: cash already granted to targetPlayerId; actor
			// may optionally turn one of that target's face-up crew face-down
			type: "tactical_support_unturn_offer";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			// bear bones: after a successful challenge call, actor may optionally
			// strike one face-down enemy crew — eligibleTargetIds is always a
			// single-element array when chained from too big
			type: "bear_bones_bonus_strike";
			actorId: string;
			eligibleTargetIds: string[];
	  }
	| {
			// too big: once-per-game optional self-unturn offer after a successful
			// challenge call
			type: "too_big_unturn_offer";
			actorId: string;
	  }
	| {
			// void legs: at start of turn, actor may discard 1 card to deal 5
			// damage — only opens if the player has at least 1 card
			type: "void_legs_choice";
			actorId: string;
			hasCardsToDiscard: boolean;
	  }
	| {
			// background check: before a challenge resolves, the challenger must
			// guess the class of one of the challenged player's face-down crew
			type: "background_check_guess";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			// the watcher passive: optional unturn offer to the actor who
			// successfully defended a challenge
			type: "watcher_unturn_offer";
			actorId: string;
			eligibleSlots: number[];
	  }
	| {
			// lighthouse: actor picks any face-up crew (ally or enemy) to disable
			// its passive until that crew turns face-down — first interaction
			// with cross-player slot selection
			type: "lighthouse_disable_pick";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
	  }
	| {
			// tag out: teams mode only — actor swaps one of their own crew slots
			// with one of a teammate's crew slots
			type: "tag_out_pick";
			actorId: string;
			teammateId: string;
			ownEligibleSlots: number[];
			teammateEligibleSlots: number[];
	  }
	| {
			// truth serum: the target (not the actor) picks which face-down crew
			// slot to reveal
			type: "truth_serum_reveal";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  };

export type ServerPendingActionType =
	| "class_action_strike"
	| "class_action_collect"
	| "class_action_unturn"
	| "class_action_block"
	| "card_strike"; // burst-move-originated blockable strike (ambush)

export interface ServerPendingAction {
	type: ServerPendingActionType;
	actorId: string;
	targetCrewSlot: number | null;
	targetAllySlot: number | null;
	moveId: string | null;
	cashCost: number; // already deducted
	declaredClass: ClassAction | null;
	actorWasBluffing: boolean;
	targetPlayerId: string | null;
	// the original action type that opened this chain, preserved through the
	// challenge_window → block_declared reassignment — used solely to reject
	// challenge_block for card_strike-originated blocks (ambush has no
	// declared class) — null for any pendingAction that isn't itself a block
	originalActionType: ServerPendingActionType | null;
}

export const FACETURN_CONSTANTS = {
	MAX_DECK_SIZE: 24,
	CREW_SLOTS: 2,
	MOVES_PER_DECK: 21, // 1 boss + 2 crew + 21 moves = 24 total
	OPENING_HAND_SIZE: 3,
	HAND_LIMIT: 6,

	DRAFTING_DURATION_MS: 5 * 60 * 1_000,
	RPS_DURATION_MS: 30 * 1_000,
	MULLIGAN_DURATION_MS: 30 * 1_000,
	ACTIVE_TURN_DURATION_MS: 35 * 1_000,
	CHALLENGE_WINDOW_MS: 15 * 1_000,
	MOVE_CHAIN_WINDOW_MS: 15 * 1_000, // per-response timer during a chain
	BLOCK_DECLARED_MS: 15 * 1_000,
	BLOCK_WINDOW_MS: 15 * 1_000, // target's window to declare a block against a card_strike
	BLOCK_CHALLENGE_MS: 15 * 1_000,
	RESOLUTION_DISPLAY_MS: 3 * 1_000,

	STRIKE_CASH_COST: 3,
	BLOCK_CASH_COST: 2,
	COLLECT_CASH_COST: 0,
	UNTURN_CASH_COST: 4,
	// command actions (razor's guess, dealer's swap, watcher's peek)
	BOSS_COMMAND_COST: 6,
	// face turn: pay 7 cash to turn a crew face up — a different action from
	// command, both exist on every boss; constant exists to avoid hardcoded 7s
	BOSS_FACE_TURN_COST: 7,
	COLLECT_CASH_GAIN: 1,

	BOSS_DEFAULT_HP: 100,
	MAX_ACTIVE_MOVE_SLOTS: 3,

	ROUND_LIMIT_DUEL: 15,
	ROUND_LIMIT_TEAMS: 18,
	ROUND_LIMIT_FFA: 20,

	MAX_PLAYERS: 4,
	MIN_PLAYERS: 2,
	TEAM_SIZE: 2,
	FFA_MIN_PLAYERS: 3,
	FFA_MAX_PLAYERS: 4,
} as const;