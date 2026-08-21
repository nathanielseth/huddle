import type { PendingInteractionView } from "../../../../../shared/games/face-turn/types";
import type { FaceturnsAction } from "../schemas";
import type { FaceturnServerState, FaceturnServerPlayer } from "../types";
import type { EngineResult } from "../../../engine/GameEngine";

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
			// true when an enemy (not the crew's own owner) caused this turn;
			causedByEnemy: boolean;
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
			// watcher: actor may unturn a face-up crew after defending a
			// challenge. eligibleTargets lists actor's own slots first, then
			// teammates' (teams mode), so the client defaults to unturning
			// own crew.
			type: "watcher_unturn_offer";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
	  }
	| {
			// bear bones: strike a face-down enemy crew after challenge win
			type: "bear_bones_bonus_strike";
			actorId: string;
			eligibleTargetIds: string[];
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
	  }
	| {
			// too big: swap this crew card with any other player's face-up crew card
			type: "too_big_swap_pick";
			actorId: string;
			ownSlot: 0 | 1;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
	  }
	| {
			// the watcher: actor sees 2 random cards from the target's hand
			// (private reveal) and picks 1 to steal
			type: "watcher_steal_pick";
			actorId: string;
			targetPlayerId: string;
			revealedCards: [string, string];
	  };

// caller action after resolve/applyTimeoutDefault
export type InteractionResolveResult =
	| { kind: "after_action" }
	| { kind: "raw_result" }
	| { kind: "custom"; result: EngineResult };

// bundles everything to resolve/timeout/project one interaction type
// adding a new one means a spec file + registry entry
export interface InteractionSpec<T extends PendingInteraction> {
	// resolving actor varies: usually interaction.actorId
	// but some specs use chooserPlayerId (choose_crew_to_turn) or targetPlayerId (truth_serum_reveal)
	getResponderId(interaction: T): string;

	// the FaceturnsAction["type"] this interaction accepts as its resolving
	// action, used to validate the incoming action before calling resolve
	actionType: FaceturnsAction["type"];

	// validate + apply the player's choice. returns null if the action was
	// invalid (wrong shape, illegal choice) so the caller returns noOp() exactly as before
	resolve(
		state: FaceturnServerState,
		interaction: T,
		action: FaceturnsAction,
		respondingPlayer: FaceturnServerPlayer,
	): InteractionResolveResult | null;

	// apply the timeout default, or null if this interaction has no default
	applyTimeoutDefault:
		| ((
				state: FaceturnServerState,
				interaction: T,
		  ) => InteractionResolveResult | null)
		| null;

	// client-facing view projection, what buildPendingInteractionView returns today for this variant
	toView(interaction: T): PendingInteractionView;
}