import type {
	FaceturnsPhase,
	CrewClass,
	ClassAction,
	RpsChoice,
	WinCondition,
	ResolutionResult,
	GameMode,
	MoveChainEntry,
} from "../../../../shared/games/face-turn/types";

export interface GameConfig {
	mode: GameMode;
	// only present in teams mode: two fixed arrays of player ids
	teams?: [string[], string[]];
}

export interface FaceturnServerPlayer {
	readonly playerId: string;
	teamIndex: number;

	bossId: string;
	bossHp: number;
	bossMaxHp: number;
	bossShield: number;
	// decremented once per round end, exact in duels, an approximation in ffa/teams
	// also negates face turn and strike execute attempts
	bossImmunityTurns: number;
	bossCommandUsed: boolean;

	crewIds: [string | null, string | null];
	crewTurned: [boolean, boolean];
	// bonus crew classes from effects like lotus and cristatella
	crewClassOverrides: Map<number, Set<CrewClass>>;

	reserveCrewId: string | null;

	hand: string[];
	deck: string[];
	discardPile: string[];

	// max 3 slots, enforced by game logic
	activeMoves: Array<string | null>;

	cash: number;

	hasBluffedSuccessfully: boolean;
	hasCalledBluffSuccessfully: boolean;
	totalCardsDiscarded: number;
	totalMovesPlayed: number;
	hasShieldedBossThisGame: boolean;
	// set permanently true once any crew turns face-up, powers suplex's "this game" condition, never cleared
	hasTurnedAllyCrewThisGame: boolean;

	// stacking per-round damage from each source player
	incomingPoison: Map<string, number>;

	// derived passive stats, recomputed by recomputePassives from all active sources, never mutated directly
	cashGainPerTurn: number;
	// cards drawn at start of own turn (dataminer, the dealer passive, command center)
	drawPerTurn: number;
	// cash gained whenever any opponent plays a move or performs a strike (class action or card-driven)
	cashOnEnemyMoveOrStrike: number;
	healOnMovePlayed: number;
	crewSkillsDisabled: boolean;
	damageMultiplier: number;
	damageReductionPercent: number;

	hasWatcherPassive: boolean;
	// subtractive block cost reduction (lighthouse), min 0
	blockCostReduction: number;
	// shield granted to this player's boss at start of every turn (void torso)
	shieldPerTurn: number;
	// global cost reduction for all moves (big voucher), distinct from per-card costOverrides, min 0
	moveBaseCostReduction: number;

	mulliganDecided: boolean;

	// action-level gate: while bossHp > 50, strikes and face turn cannot target this boss
	// the attempt fizzles entirely, distinct from damage reduction
	hasTerminalStrikeBlock: boolean;

	// when true, this player chooses which of their face-down crew gets turned instead of the attacker
	hasVoidArms: boolean;
	// every collector action by this player or a teammate grants supplyDropCashAmount to each team member
	// trigger-based, not per-turn accumulation
	hasSupplyDrop: boolean;
	supplyDropCashAmount: number;
	// true when any teammate's life insurance active move has this player as the protected target
	// executes also count as lethal damage for this purpose
	hasLifeInsurance: boolean;
	// maps active-move slot index to protected ally's playerId, locked at cast time
	// cleared when the slot's life insurance is consumed or discarded
	lifeInsuranceTargets: Map<0 | 1 | 2, string>;
	// maps an active-move slot to its locked watched enemy; cleared only when that slot is discarded, and read live by applyTrickleDownOnCollect
	trickleDownTargets: Map<0 | 1 | 2, string>;
	// failed challenge discards the false flag active move instead of turning crew
	hasFalseFlag: boolean;
	// set when totalCardsDiscarded hits the doctor norman trigger threshold exactly
	// (see DOCTOR_NORMAN_TRIGGER_DISCARD_COUNT in resolveEffects.ts, currently 4)
	doctorNormanTriggered: boolean;
	// per-turn flag reset in startTurn (vanessa de vera)
	vanessaDrawUsedThisTurn: boolean;
	// once-per-game flag for the self-unturn offer (too big)
	tooBigUnturnUsed: boolean;
	// crew slots with disabled passives, cleared on unturn (lighthouse)
	disabledPassiveSlots: Set<0 | 1>;
	// per-round flag reset alongside other round-end resets (prank call)
	prankCallBonusUsedThisRound: boolean;

	// discard-for-damage offer at start of turn (void legs)
	hasVoidLegsChoice: boolean;
	voidLegsDiscardCost: number;
	voidLegsDamage: number;
	// opponent who challenges this player's class action must guess a face-down crew's class first
	hasBackgroundCheck: boolean;

	hasPrankCall: boolean;
	prankCallBonusAmount: number;

	// turn-scoped, reset each turn
	playedMoveThisTurn: boolean;
	classActionUsedThisTurn: boolean;
	costOverrides: Map<string, number>; // per-turn cost overrides by move id

	draftSelections: DraftSelections | null;
	isDraftLocked: boolean;
}

export interface DraftSelections {
	bossId: string | null;
	crewIds: string[];
	moveIds: string[];
}

// move chain, active only during move_chain_window
// only the caster and original target may push entries
// burst moves resolve instantly, only slow moves stack
export interface ServerMoveChain {
	participants: [string, string];
	// lifo stack: index 0 is first played, last element most recent
	stack: MoveChainEntry[];
	// whose turn to respond; starts as original target, flips on each slow move push
	responderId: string;
	// stack length when responderId last flipped; if current responder passes
	// and stack length hasn't increased since, chain resolves immediately
	stackDepthAtLastSlow: number;
}

export interface FaceturnServerState {
	phase: FaceturnsPhase;
	players: Map<string, FaceturnServerPlayer>;
	mode: GameMode;

	// in ffa/duel each player is their own solo team; in teams, indices 0 and 1
	teams: string[][];

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

	// one-shot private reveal of an enemy's hand, only visible to forPlayerId
	// cleared after next state build, must never leak to opponents
	watcherReveal: { forPlayerId: string; hand: readonly string[] } | null;

	rpsChoices: Map<string, RpsChoice>;
	// never 'tie': ties resolved by coinflip immediately, so a first mover always exists
	rpsResult: "player1" | "player2" | null;

	// null for draws
	winnerId: string | null;
	winCondition: WinCondition | null;

	// NEW: one-shot scratch value stashed by discard_all_enemy_hand's handler
	// (monkey-man), consumed and cleared by the very next
	// deal_damage_per_enemy_hand_discarded primitive in the same effects
	// array. must never be read by anything else — it is not durable state
	// and is not part of the public view.
	lastEnemyHandDiscardCount?: number | undefined;

	// public state cache, invalidated on every mutation
	_publicStateCacheValid: boolean;
	_cachedPublicState: unknown;
}

export type PendingInteraction =
	| {
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
			// after challenge, bluff, or strike resolution when target has multiple unturned crew:
			// chooserPlayerId defaults to attacker, or defender with void arms
			// isStrike true only for actual strikes (gates blood money)
			type: "choose_crew_to_turn";
			targetPlayerId: string;
			actorId: string;
			chooserPlayerId: string;
			eligibleSlots: number[];
			isStrike: boolean;
			// true only when this interaction is the challenge-loss penalty
			// against a losing challenger, opened mid-resolveChallenge while
			// the original pendingAction (the class action being challenged)
			// is still awaiting its own execution. absent/false for every
			// other choose_crew_to_turn caller (face turn, card strikes,
			// class-action strikes, bear bones, etc). orthogonal to isStrike,
			// which only governs "was turning this crew caused by a strike"
			// for via/blood-money purposes.
			deferredActionPending?: boolean;
	  }
	| {
			// empty the clip: actor picks how many cards (0..maxCount) to discard
			// damage target captured at play time; enemy-fallback logic not re-evaluated
			type: "choose_discard_count";
			actorId: string;
			maxCount: number;
			targetPlayerId: string;
			damagePerCard: number;
	  }
	| {
			// take it back: actor picks one card from their discard pile to return to hand
			// snapshot is the full pile so client can render concrete options
			type: "choose_from_discard";
			actorId: string;
			discardPileSnapshot: readonly string[];
	  }
	| {
			// dig deep: top cards of the actor's deck, revealed privately only to the actor
			// not mirrored into PendingInteractionView
			type: "dig_deep_pick";
			actorId: string;
			revealedCards: readonly string[];
			maxPicks?: number;
	  }
	| {
			// handles: genuine optional unturn of one own face-up crew (both guaranteed face-up when this opens)
			type: "handles_unturn_offer";
			actorId: string;
			eligibleSlots: number[];
	  }
	| {
			// switch up: turn one face-up ally crew face-down and a different face-down ally crew face-up
			// the two slot lists are disjoint
			type: "switch_up_pick";
			actorId: string;
			faceUpSlots: number[];
			faceDownSlots: number[];
	  }
	| {
			// tactical support: cash already granted to targetPlayerId; actor may optionally turn one of
			// that target's face-up crew face-down
			type: "tactical_support_unturn_offer";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			// bear bones: after a successful challenge call, optional strike on one face-down enemy crew
			// eligibleTargetIds is always a single-element array when chained from too big
			type: "bear_bones_bonus_strike";
			actorId: string;
			eligibleTargetIds: string[];
			cashCost: number;
	  }
	| {
			// too big: once-per-game optional self-unturn offer after a successful challenge call
			type: "too_big_unturn_offer";
			actorId: string;
	  }
	| {
			// void legs: at start of turn, discard 1 card for damage; only opens if player has at least 1 card
			type: "void_legs_choice";
			actorId: string;
			hasCardsToDiscard: boolean;
	  }
	| {
			// background check: before challenge resolves, challenger must guess class of
			// one of the challenged player's face-down crew
			type: "background_check_guess";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			// the watcher passive: optional unturn offer to the actor who successfully defended a challenge
			type: "watcher_unturn_offer";
			actorId: string;
			eligibleSlots: number[];
	  }
	| {
			// lighthouse: pick any face-up crew (ally or enemy) to disable its passive until that crew unturns
			// first interaction with cross-player slot selection
			type: "lighthouse_disable_pick";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
			maxPicks?: number;
	  }
	| {
			// tag out: teams mode only, swap one own crew slot with a teammate's
			type: "tag_out_pick";
			actorId: string;
			teammateId: string;
			ownEligibleSlots: number[];
			teammateEligibleSlots: number[];
	  }
	| {
			// truth serum: the target (not the actor) picks which face-down crew slot to reveal
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
	// preserved original action type when this pendingAction is a block
	// used to reject challenge_block for card_strike blocks (ambush has no declared class)
	// null for any pendingAction that isn't itself a block
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
	MOVE_CHAIN_WINDOW_MS: 15 * 1_000,
	BLOCK_DECLARED_MS: 15 * 1_000,
	BLOCK_WINDOW_MS: 15 * 1_000, // target's window to declare a block against a card_strike
	BLOCK_CHALLENGE_MS: 15 * 1_000,
	RESOLUTION_DISPLAY_MS: 3 * 1_000,

	STRIKE_CASH_COST: 3,
	BLOCK_CASH_COST: 0,
	COLLECT_CASH_COST: 0,
	UNTURN_CASH_COST: 4,

	BOSS_FACE_TURN_COST: 6,

	COLLECT_CASH_GAIN: 2,

	BOSS_DEFAULT_HP: 100,
	MAX_ACTIVE_MOVE_SLOTS: 3,

	ROUND_LIMIT_DUEL: 15,
	ROUND_LIMIT_TEAMS: 18,
	ROUND_LIMIT_FFA: 20,

	MAX_PLAYERS: 4,
	MIN_PLAYERS: 2,
	TEAM_SIZE: 3,
	FFA_MIN_PLAYERS: 3,
	FFA_MAX_PLAYERS: 6,
} as const;

export const CLASS_ACTION_COST_BY_CLASS: Record<CrewClass, number> = {
	striker: FACETURN_CONSTANTS.STRIKE_CASH_COST,
	blocker: FACETURN_CONSTANTS.BLOCK_CASH_COST,
	collector: FACETURN_CONSTANTS.COLLECT_CASH_COST,
	turner: FACETURN_CONSTANTS.UNTURN_CASH_COST,
};