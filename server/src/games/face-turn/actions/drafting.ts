import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import { CARD_IDS, BOSS_MAP, CREW_MAP, MOVE_MAP, isDraftable } from "../cards";
import {
	randomizeEmptyDraftSlots,
	loadDraftSelections,
	isDraftValid,
	finalizeDraft,
	dealOpeningHand,
} from "../game";
import { makeResult } from "../action-results";

export const draftingAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	const noOp = () => noOpResult(state, ctx);

	const draft = player.draftSelections;
	if (!draft || player.isDraftLocked) return noOp();

	switch (action.type) {
		case "select_boss": {
			if (!BOSS_MAP.has(action.bossId)) return noOp();
			// re-clicking same boss deselects
			draft.bossId = draft.bossId === action.bossId ? null : action.bossId;

			// switching from dealer reduces crew cap, trim extra from end
			const newCrewCap =
				draft.bossId === CARD_IDS.BOSS.THE_DEALER
					? C.CREW_SLOTS + 1
					: C.CREW_SLOTS;
			if (draft.crewIds.length > newCrewCap) {
				draft.crewIds = draft.crewIds.slice(0, newCrewCap);
			}
			break;
		}
		case "select_crew": {
			const crewDef = CREW_MAP.get(action.crewId);
			if (
				!crewDef ||
				!isDraftable(crewDef) ||
				draft.crewIds.includes(action.crewId)
			)
				return noOp();
			const crewCap =
				draft.bossId === CARD_IDS.BOSS.THE_DEALER
					? C.CREW_SLOTS + 1
					: C.CREW_SLOTS;
			if (draft.crewIds.length >= crewCap) return noOp();
			draft.crewIds.push(action.crewId);
			break;
		}
		case "deselect_crew": {
			draft.crewIds = draft.crewIds.filter((id) => id !== action.crewId);
			break;
		}
		case "select_move": {
			if (!MOVE_MAP.has(action.moveId) || draft.moveIds.includes(action.moveId))
				return noOp();
			if (draft.moveIds.length >= C.MOVES_PER_DECK) return noOp();
			draft.moveIds.push(action.moveId);
			break;
		}
		case "deselect_move": {
			draft.moveIds = draft.moveIds.filter((id) => id !== action.moveId);
			break;
		}
		case "randomize_draft": {
			randomizeEmptyDraftSlots(player, state.rng);
			break;
		}
		case "load_draft": {
			// wholesale replace, ids re-validated server-side
			loadDraftSelections(player, {
				bossId: action.bossId,
				crewIds: action.crewIds,
				moveIds: action.moveIds,
			});
			break;
		}
		case "lock_draft": {
			if (!isDraftValid(player)) return noOp();
			finalizeDraft(player, state.rng);
			player.isDraftLocked = true;

			if ([...state.players.values()].every((p) => p.isDraftLocked)) {
				if (state.mode === "ffa") {
					for (const p of state.players.values()) dealOpeningHand(p);
					state.phase = "mulligan";
					return makeResult(state, C.MULLIGAN_DURATION_MS);
				} else {
					state.phase = "rps";
					state.rpsChoices = new Map();
					state.rpsResult = null;
					return makeResult(state, C.RPS_DURATION_MS);
				}
			}
			break;
		}
		default:
			return noOp();
	}

	// makeResult resyncs private payloads, draft picks live in secret
	return makeResult(state, ctx.room.timer?.duration ?? null);
};