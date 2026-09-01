import type {
	FaceturnsPhase,
	ClassAction,
	RpsChoice,
	WinCondition,
	ResolutionResult,
	GameMode,
	MoveChainEntry,
	MoveChainResolutionView,
} from "../../../../shared/games/face-turn/types";
import type { LogEntry } from "../../../../shared/games/face-turn/log";
import { FACETURN_CONSTANTS } from "../../../../shared/games/face-turn/constants";
import type { FaceturnDerivedPlayerStats } from "./derived";
import type { PendingInteraction } from "./interactions/types";
export { FACETURN_CONSTANTS };
export type { PendingInteraction };

export interface GameConfig {
	mode: GameMode;
	teams?: [string[], string[]];
}

export interface PendingDefendableStrike {
	actorId: string;
	targetPlayerId: string;
	targetCrewSlot: number | null;
}

export interface WarrantOfArrestMark {
	targetPlayerId: string;
	targetSlot: 0 | 1;
	targetCrewId: string;
	turnsRemaining: number;
}

export interface RedHerringMark {
	slot: 0 | 1;
	crewId: string;
}

export interface FaceturnServerPlayer {
	readonly playerId: string;
	teamIndex: number;

	bossId: string;
	bossHp: number;
	bossMaxHp: number;
	bossArmor: number;
	// decrements at round end; exact in duels, approximate in ffa/teams. also defends face turn and strike execute
	bossImmunityTurns: number;
	bossCommandUsed: boolean;
	// tags how bossHp last reached 0
	lastHpZeroCause: "execution" | "damage" | null;

	crewIds: [string | null, string | null];
	crewTurned: [boolean, boolean];

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
	hasArmoredBossThisGame: boolean;
	// true once any crew turns face-up; never cleared. used by suplex's condition
	hasTurnedAllyCrewThisGame: boolean;

	incomingPoison: Map<string, number>;

	mulliganDecided: boolean;

	// warrant of arrest: marks this player has placed on enemy crew,
	// keyed by this player's own active-move slot. see WarrantOfArrestMark.
	warrantMarks: Map<0 | 1 | 2, WarrantOfArrestMark>;
	// red herring: this player's own pending redirect, if any. see
	// RedHerringMark. not a derived/recomputed field — set at cast time,
	// cleared on consumption or invalidation.
	redHerringMark: RedHerringMark | null;

	// maps active slot to protected ally; locked at cast time
	lifeInsuranceTargets: Map<0 | 1 | 2, string>;
	// maps active slot to watched enemy; read live by applyTrickleDownOnCollect
	trickleDownTargets: Map<0 | 1 | 2, string>;
	// per-turn flag; reset in startTurn.
	ratQueenDrawUsedThisTurn: boolean;
	// crew slots with disabled passives; cleared when crew hides
	disabledPassiveSlots: Set<0 | 1>;

	playedMoveThisTurn: boolean;
	classActionUsedThisTurn: boolean;
	costOverrides: Map<string, number>;

	draftSelections: DraftSelections | null;
	isDraftLocked: boolean;

	// derived passive stats; wholesale-rebuilt by recomputePassives
	derived: FaceturnDerivedPlayerStats;
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
}

export interface FaceturnServerState {
	phase: FaceturnsPhase;
	players: Map<string, FaceturnServerPlayer>;
	mode: GameMode;

	rng: () => number;

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

	// turned‑effect strikes (e.g. Shrike) queue if pendingAction is busy, drained by afterAction once state is clean, reusing Ambush’s card_strike/defend_window flow
	pendingDefendableStrikes: PendingDefendableStrike[];

	lastResolution: ResolutionResult | null;
	// mirrors lastResolution's lifecycle: just gets overwritten by whoever
	// resolves a move chain next. written inside resolveMoveChainFull so
	// none of its callers need to change.
	lastChainResolution: MoveChainResolutionView | null;

	// append-only match log — see ./log.ts for pushLog and the cap.
	log: LogEntry[];
	// next seq to assign; monotonic for the life of the game, never
	// reused even as old entries get evicted past the cap.
	_nextLogSeq: number;

	// one-shot private hand reveal; cleared after next state build
	watcherReveal: { forPlayerId: string; hand: readonly string[] } | null;

	rpsChoices: Map<string, RpsChoice>;
	// ties resolved by coinflip; a first mover always exists
	rpsResult: "player1" | "player2" | null;
	// set once rpsResult resolves, survives into phase "rps_order_choice"
	// (state.rps itself goes null once the phase leaves "rps"/"rps_reveal",
	// so this is the only place the winner is still recorded there). cleared
	// once order is chosen and we move on to "mulligan".
	rpsOrderChoiceWinnerId: string | null;

	winnerId: string | null;
	winCondition: WinCondition | null;

	// target with no face-down crew left, regardless of whether it ends the game
	executionAttempts: number;
	executionsSurvivedViaLifeInsurance: number;

	// one-shot scratch for monkey-man; consumed by next primitive. never persist.
	lastEnemyHandDiscardCount?: number | undefined;

	_publicStateCacheValid: boolean;
	_cachedPublicState: unknown;
}

export type ServerPendingActionType =
	| "class_action_strike"
	| "class_action_collect"
	| "class_action_hide"
	| "class_action_defend"
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
	// only set for defends; used to disallow challenge_defend on card_strike
	originalActionType: ServerPendingActionType | null;
}