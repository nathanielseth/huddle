import type {
	CrewClass,
	PendingInteractionView,
} from "@shared/games/face-turn/types";
import { sendFaceturnAction, type FaceturnsAction } from "../actions";
import { useFaceturnState, getInteractionResponder } from "./useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";

// interactions with a documented decline path
const DECLINABLE_TYPES = new Set<PendingInteractionView["type"]>([
	"tactical_support_hide_offer",
	"watcher_hide_offer",
	"bear_bones_bonus_strike",
	"void_legs_choice",
	"belladonna_copy_pick",
]);

// resolve argument shapes per interaction type, mirrors resolve_* actions minus type discriminant
interface ResolveArgs {
	peek_discard: { discardMoveId: string };
	crew_reactivate: { crewSlot: number };
	poison_target_pick: { targetPlayerId: string };
	choose_crew_to_turn: { crewSlot: number };
	choose_discard_count: { count: number };
	choose_from_discard: { cardId: string };
	dig_deep_pick: { cardIds: string[] };
	switch_up_pick: { hideSlot: number; turnSlot: number };
	tactical_support_hide_offer: { slot?: number };
	bear_bones_bonus_strike: {
		confirmed: boolean;
		targetPlayerId?: string;
		targetCrewSlot?: number;
	};
	bear_bones_steal_pick: { targetPlayerId: string };
	void_legs_choice: { confirmed: boolean };
	background_check_guess: { targetCrewSlot: number; guessClass: CrewClass };
	watcher_hide_offer: { slot?: number; targetPlayerId?: string };
	lighthouse_disable_pick: {
		picks: { targetPlayerId: string; crewSlot: number }[];
	};
	tag_out_pick: { ownSlot: number; teammateSlot: number };
	truth_serum_reveal: { crewSlot: number };
	too_big_swap_pick: { targetPlayerId: string; crewSlot: number };
	watcher_steal_pick: { cardId: string };
	belladonna_copy_pick: {
		confirmed: boolean;
		targetPlayerId?: string;
		targetActiveMoveSlot?: number;
	};
}

function buildResolveAction<K extends keyof ResolveArgs>(
	kind: K,
	args: ResolveArgs[K],
): FaceturnsAction {
	switch (kind) {
		case "peek_discard":
			return {
				type: "resolve_peek_discard",
				...(args as ResolveArgs["peek_discard"]),
			};
		case "crew_reactivate":
			return {
				type: "resolve_crew_reactivate",
				...(args as ResolveArgs["crew_reactivate"]),
			};
		case "poison_target_pick":
			return {
				type: "resolve_poison_target",
				...(args as ResolveArgs["poison_target_pick"]),
			};
		case "choose_crew_to_turn":
			return {
				type: "resolve_choose_crew_to_turn",
				...(args as ResolveArgs["choose_crew_to_turn"]),
			};
		case "choose_discard_count":
			return {
				type: "resolve_choose_discard_count",
				...(args as ResolveArgs["choose_discard_count"]),
			};
		case "choose_from_discard":
			return {
				type: "resolve_choose_from_discard",
				...(args as ResolveArgs["choose_from_discard"]),
			};
		case "dig_deep_pick":
			return {
				type: "resolve_dig_deep_pick",
				...(args as ResolveArgs["dig_deep_pick"]),
			};
		case "switch_up_pick":
			return {
				type: "resolve_switch_up_pick",
				...(args as ResolveArgs["switch_up_pick"]),
			};
		case "tactical_support_hide_offer":
			return {
				type: "resolve_tactical_support_hide_offer",
				...(args as ResolveArgs["tactical_support_hide_offer"]),
			};
		case "bear_bones_bonus_strike":
			return {
				type: "resolve_bear_bones_bonus_strike",
				...(args as ResolveArgs["bear_bones_bonus_strike"]),
			};
		case "bear_bones_steal_pick":
			return {
				type: "resolve_bear_bones_steal_pick",
				...(args as ResolveArgs["bear_bones_steal_pick"]),
			};
		case "void_legs_choice":
			return {
				type: "resolve_void_legs_choice",
				...(args as ResolveArgs["void_legs_choice"]),
			};
		case "background_check_guess":
			return {
				type: "resolve_background_check_guess",
				...(args as ResolveArgs["background_check_guess"]),
			};
		case "watcher_hide_offer":
			return {
				type: "resolve_watcher_hide_offer",
				...(args as ResolveArgs["watcher_hide_offer"]),
			};
		case "lighthouse_disable_pick":
			return {
				type: "resolve_lighthouse_disable_pick",
				...(args as ResolveArgs["lighthouse_disable_pick"]),
			};
		case "tag_out_pick":
			return {
				type: "resolve_tag_out_pick",
				...(args as ResolveArgs["tag_out_pick"]),
			};
		case "truth_serum_reveal":
			return {
				type: "resolve_truth_serum_reveal",
				...(args as ResolveArgs["truth_serum_reveal"]),
			};
		case "too_big_swap_pick":
			return {
				type: "resolve_too_big_swap_pick",
				...(args as ResolveArgs["too_big_swap_pick"]),
			};
		case "watcher_steal_pick":
			return {
				type: "resolve_watcher_steal_pick",
				...(args as ResolveArgs["watcher_steal_pick"]),
			};
		case "belladonna_copy_pick":
			return {
				type: "resolve_belladonna_copy_pick",
				...(args as ResolveArgs["belladonna_copy_pick"]),
			};
		default: {
			const _exhaustive: never = kind;
			throw new Error(
				`[face-turn] unhandled interaction kind: ${String(_exhaustive)}`,
			);
		}
	}
}

// identity full view, not type:actorId, because same type can recur back to back
export function getInteractionIdentity(
	pi: PendingInteractionView | null,
): string | null {
	if (!pi) return null;
	return `${getInteractionResponder(pi)}:${JSON.stringify(pi)}`;
}

export interface FaceturnInteractionHelpers {
	interaction: PendingInteractionView | null;
	isResponder: boolean;
	canDecline: boolean;
	locked: boolean;
	decline: () => void;
	resolve: <K extends keyof ResolveArgs>(kind: K, args: ResolveArgs[K]) => void;
}

export function useFaceturnInteraction(): FaceturnInteractionHelpers {
	const { pendingInteraction, playerId } = useFaceturnState();

	const isResponder = pendingInteraction
		? getInteractionResponder(pendingInteraction) === playerId
		: false;

	const canDecline = Boolean(
		pendingInteraction && DECLINABLE_TYPES.has(pendingInteraction.type),
	);

	const interactionIdentity = getInteractionIdentity(pendingInteraction);

	const { locked, runLocked } = useActionLock(interactionIdentity);

	function decline() {
		if (!pendingInteraction || locked) return;
		switch (pendingInteraction.type) {
			case "tactical_support_hide_offer":
				runLocked(() => {
					sendFaceturnAction({ type: "resolve_tactical_support_hide_offer" });
				});
				return;
			case "watcher_hide_offer":
				runLocked(() => {
					sendFaceturnAction({ type: "resolve_watcher_hide_offer" });
				});
				return;
			case "bear_bones_bonus_strike":
				runLocked(() => {
					sendFaceturnAction({
						type: "resolve_bear_bones_bonus_strike",
						confirmed: false,
					});
				});
				return;
			case "void_legs_choice":
				runLocked(() => {
					sendFaceturnAction({
						type: "resolve_void_legs_choice",
						confirmed: false,
					});
				});
				return;
			case "belladonna_copy_pick":
				runLocked(() => {
					sendFaceturnAction({
						type: "resolve_belladonna_copy_pick",
						confirmed: false,
					});
				});
				return;
			default:
				return; // not declinable
		}
	}

	function resolve<K extends keyof ResolveArgs>(kind: K, args: ResolveArgs[K]) {
		if (!pendingInteraction || pendingInteraction.type !== kind) return;
		if (locked) return;
		const action = buildResolveAction(kind, args);
		runLocked(() => {
			sendFaceturnAction(action);
		});
	}

	return {
		interaction: pendingInteraction,
		isResponder,
		canDecline,
		locked,
		decline,
		resolve,
	};
}