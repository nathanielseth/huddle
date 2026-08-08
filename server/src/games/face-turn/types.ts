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
import { FACETURN_CONSTANTS } from "../../../../shared/games/face-turn/constants";
export { FACETURN_CONSTANTS };

export interface GameConfig {
	mode: GameMode;
	teams?: [string[], string[]];
}

export interface FaceturnServerPlayer {
	readonly playerId: string;
	teamIndex: number;

	bossId: string;
	bossHp: number;
	bossMaxHp: number;
	bossShield: number;
	// decrements at round end; exact in duels, approximate in ffa/teams. also blocks face turn and strike execute
	bossImmunityTurns: number;
	bossCommandUsed: boolean;

	crewIds: [string | null, string | null];
	crewTurned: [boolean, boolean];
	crewClassOverrides: Map<number, Set<CrewClass>>;

	reserveCrewId: string | null;

	hand: string[];
	deck: string[];
	discardPile: string[];

	activeMoves: Array<string | null>;

	cash: number;

	hasBluffedSuccessfully: boolean;
	hasCalledBluffSuccessfully: boolean;
	totalCardsDiscarded: number;
	totalMovesPlayed: number;
	hasShieldedBossThisGame: boolean;
	// true once any crew turns face-up; never cleared. used by suplex's condition
	hasTurnedAllyCrewThisGame: boolean;

	incomingPoison: Map<string, number>;

	// derived passive stats; recomputed from active sources, never mutated directly
	cashGainPerTurn: number;
	drawPerTurn: number;
	cashOnEnemyMoveOrStrike: number;
	healOnMovePlayed: number;
	crewSkillsDisabled: boolean;
	// flat bonus applied once per effect resolution; not scaled by effect amount. see applyDamage
	damageBonusFlat: number;
	damageReductionPercent: number;

	hasWatcherPassive: boolean;
	// true while bastion's dual-trigger cash passive is active. derived like other has* flags
	hasBastionPassive: boolean;
	shieldPerTurn: number;
	// global move cost reduction; distinct from per-card costOverrides
	moveBaseCostReduction: number;
	// burst move cost reduction (zednem); separate from moveBaseCostReduction
	burstMoveCostReduction: number;
	// added to enemy move costs; read live from this player by opponents, not accumulated
	enemyMoveCostSurcharge: number;

	mulliganDecided: boolean;

	// blocks strikes and face turn when bossHp > 50; attempt fizzles
	hasTerminalStrikeBlock: boolean;

	hasVoidArms: boolean;
	// grants team cash on any collector action; trigger-based
	hasSupplyDrop: boolean;
	supplyDropCashAmount: number;
	// true when protected by a teammate's life insurance
	hasLifeInsurance: boolean;
	// maps active slot to protected ally; locked at cast time
	lifeInsuranceTargets: Map<0 | 1 | 2, string>;
	// maps active slot to watched enemy; read live by applyTrickleDownOnCollect
	trickleDownTargets: Map<0 | 1 | 2, string>;
	// failed challenge discards the false flag active move instead of turning crew
	hasFalseFlag: boolean;
	// per-turn flag; reset in startTurn.
	vanessaDrawUsedThisTurn: boolean;
	// once-per-game flag for too big's self-unturn
	tooBigUnturnUsed: boolean;
	// crew slots with disabled passives; cleared when crew unturns
	disabledPassiveSlots: Set<0 | 1>;
	// per-round; reset at round end.
	prankCallBonusUsedThisRound: boolean;
	// once-per-turn gate for bastion's cash bonus; shared across damage taken and crew turned triggers
	bastionCashBonusUsedThisTurn: boolean;

	// void legs choice at turn start.
	hasVoidLegsChoice: boolean;
	voidLegsDiscardCost: number;
	voidLegsDamage: number;
	// forces a background check guess before challenge
	hasBackgroundCheck: boolean;

	hasPrankCall: boolean;
	prankCallBonusAmount: number;

	playedMoveThisTurn: boolean;
	classActionUsedThisTurn: boolean;
	costOverrides: Map<string, number>;

	draftSelections: DraftSelections | null;
	isDraftLocked: boolean;
}

export interface DraftSelections {
	bossId: string | null;
	crewIds: string[];
	moveIds: string[];
}

// active during move_chain_window; only participants may push. burst resolves instantly, slow stacks
export interface ServerMoveChain {
	participants: [string, string];
	stack: MoveChainEntry[];
	responderId: string;
	// stack length when responder last flipped; chain resolves if no new slow played
	stackDepthAtLastSlow: number;
}

export interface FaceturnServerState {
	phase: FaceturnsPhase;
	players: Map<string, FaceturnServerPlayer>;
	mode: GameMode;

	teams: string[][];

	turnOrder: string[];
	// used for rps serialisation and identifying the two reps
	playerOrder: [string, string];

	eliminatedPlayers: Set<string>;

	turnNumber: number;
	// increments when all living players have taken a turn
	roundNumber: number;
	activePlayerId: string | null;

	pendingAction: ServerPendingAction | null;
	challengeEligiblePlayerIds: string[];

	moveChain: ServerMoveChain | null;

	// pending card effect requiring a player choice.
	pendingInteraction: PendingInteraction | null;

	lastResolution: ResolutionResult | null;

	// one-shot private hand reveal; cleared after next state build
	watcherReveal: { forPlayerId: string; hand: readonly string[] } | null;

	rpsChoices: Map<string, RpsChoice>;
	// ties resolved by coinflip; a first mover always exists
	rpsResult: "player1" | "player2" | null;

	winnerId: string | null;
	winCondition: WinCondition | null;

	// one-shot scratch for monkey-man; consumed by next primitive. never persist.
	lastEnemyHandDiscardCount?: number | undefined;

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
			// neeto's clock
			type: "crew_reactivate";
			actorId: string;
			eligibleSlots: number[];
	  }
	| {
			// g-rone's poison target choice
			type: "poison_target_pick";
			actorId: string;
			eligibleTargetIds: string[];
			damagePerRound: number;
	  }
	| {
			// chooser player: attacker unless void arms flips. isStrike gates blood money
			type: "choose_crew_to_turn";
			targetPlayerId: string;
			actorId: string;
			chooserPlayerId: string;
			eligibleSlots: number[];
			isStrike: boolean;
			// true when this is a challenge-loss penalty deferred behind the original pending action
			deferredActionPending?: boolean;
	  }
	| {
			// empty the clip: choose discard count. target locked at play time
			type: "choose_discard_count";
			actorId: string;
			maxCount: number;
			targetPlayerId: string;
			damagePerCard: number;
	  }
	| {
			// take it back: pick a discard to return to hand
			type: "choose_from_discard";
			actorId: string;
			discardPileSnapshot: readonly string[];
	  }
	| {
			// dig deep: actor picks from top deck cards (private reveal)
			type: "dig_deep_pick";
			actorId: string;
			revealedCards: readonly string[];
			maxPicks?: number;
	  }
	| {
			// switch up: pick one face-up to unturn and one face-down to turn
			type: "switch_up_pick";
			actorId: string;
			faceUpSlots: number[];
			faceDownSlots: number[];
	  }
	| {
			// tactical support: actor may unturn one of target's face-up crew
			type: "tactical_support_unturn_offer";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			// bear bones: optional strike on a face-down enemy crew after challenge win
			type: "bear_bones_bonus_strike";
			actorId: string;
			eligibleTargetIds: string[];
			cashCost: number;
	  }
	| {
			// too big: optional self-unturn after challenge win (once per game)
			type: "too_big_unturn_offer";
			actorId: string;
	  }
	| {
			// void legs: at turn start, discard for damage
			type: "void_legs_choice";
			actorId: string;
			hasCardsToDiscard: boolean;
	  }
	| {
			// background check: challenger guesses face-down crew's class
			type: "background_check_guess";
			actorId: string;
			targetPlayerId: string;
			eligibleSlots: number[];
	  }
	| {
			// watcher: actor may unturn a face-up crew after defending a challenge
			type: "watcher_unturn_offer";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
	  }
	| {
			// lighthouse: pick face-up crew to disable passive. cross-player slot selection
			type: "lighthouse_disable_pick";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
			maxPicks?: number;
	  }
	| {
			// tag out: swap crew slots with a teammate (teams only)
			type: "tag_out_pick";
			actorId: string;
			teammateId: string;
			ownEligibleSlots: number[];
			teammateEligibleSlots: number[];
	  }
	| {
			// truth serum: target picks which face-down crew to reveal
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
	| "card_strike";

export interface ServerPendingAction {
	type: ServerPendingActionType;
	actorId: string;
	targetCrewSlot: number | null;
	targetAllySlot: number | null;
	moveId: string | null;
	cashCost: number;
	declaredClass: ClassAction | null;
	actorWasBluffing: boolean;
	targetPlayerId: string | null;
	// only set for blocks; used to disallow challenge_block on card_strike
	originalActionType: ServerPendingActionType | null;
}