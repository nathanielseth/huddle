import type { PendingInteractionView } from "../../../../../shared/games/face-turn/types";
import type { CrewTurnCause } from "../../../../../shared/games/face-turn/log";
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
			type: "crew_reactivate";
			actorId: string;
			eligibleSlots: number[];
	  }
	| {
			type: "poison_target_pick";
			actorId: string;
			eligibleTargetIds: string[];
			damagePerRound: number;
	  }
	| {
			type: "choose_crew_to_turn";
			targetPlayerId: string;
			actorId: string;
			chooserPlayerId: string;
			eligibleSlots: number[];
			isStrike: boolean;
			deferredActionPending?: boolean;
			// true when an enemy (not the crew's owner) caused this turn
			causedByEnemy: boolean;
			via: CrewTurnCause;
	  }
	| {
			// target locked at play time
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
			type: "dig_deep_pick";
			actorId: string;
			revealedCards: readonly string[];
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
			// own slots first, then teammates', so client defaults to hiding own crew
			type: "watcher_hide_offer";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
	  }
	| {
			// face-down turns it, face-up kills it
			type: "bear_bones_bonus_strike";
			actorId: string;
			eligibleTargetIds: string[];
	  }
	| {
			// actor picks which enemy when more than one (ffa)
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
			type: "lighthouse_disable_pick";
			actorId: string;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
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
			ownSlot: 0 | 1;
			eligibleTargets: readonly { playerId: string; slot: 0 | 1 }[];
	  }
	| {
			// optional: declining is always legal
			type: "belladonna_copy_pick";
			actorId: string;
			eligibleTargets: readonly {
				playerId: string;
				slot: 0 | 1 | 2;
				moveId: string;
			}[];
	  }
	| {
			type: "watcher_steal_pick";
			actorId: string;
			targetPlayerId: string;
			revealedCards: [string, string];
	  };

export type InteractionResolveResult =
	| { kind: "after_action" }
	| { kind: "raw_result" }
	| { kind: "custom"; result: EngineResult };

export interface InteractionSpec<T extends PendingInteraction> {
	// usually interaction.actorId, but some use chooserPlayerId or targetPlayerId
	getResponderId(interaction: T): string;

	actionType: FaceturnsAction["type"];

	// returns null if action invalid, caller returns noOp()
	resolve(
		state: FaceturnServerState,
		interaction: T,
		action: FaceturnsAction,
		respondingPlayer: FaceturnServerPlayer,
	): InteractionResolveResult | null;

	// null if no default exists
	applyTimeoutDefault:
		| ((
				state: FaceturnServerState,
				interaction: T,
		  ) => InteractionResolveResult | null)
		| null;

	toView(interaction: T): PendingInteractionView;
}