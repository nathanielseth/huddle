import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveBearBonesBonusStrike } from "../effects";
import { buildStrikeResolution, finalizeResolvedChallenge } from "../action-results";

type Interaction = Extract<
	PendingInteraction,
	{ type: "bear_bones_bonus_strike" }
>;

export const bearBonesBonusStrikeSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_bear_bones_bonus_strike",

	// chains into finalizeResolvedChallenge, which itself returns a full
	// EngineResult, so this is "custom" like background_check_guess
	resolve(state, interaction, action, respondingPlayer) {
		if (action.type !== "resolve_bear_bones_bonus_strike") return null;
		const defeatedPlayerId = state.pendingAction?.actorId ?? null;
		// clear before resolveBearBonesBonusStrike
		// it may chain into resolveStrikeOrExecute and open a new pendingInteraction; clearing later would wipe it
		state.pendingInteraction = null;
		const bonusOutcome = resolveBearBonesBonusStrike(
			state,
			respondingPlayer,
			action.confirmed,
			action.targetPlayerId ?? interaction.eligibleTargetIds[0] ?? null,
			action.targetCrewSlot ?? null,
		);
		const bonusTargetId =
			action.targetPlayerId ?? interaction.eligibleTargetIds[0];
		if (bonusOutcome && bonusTargetId) {
			state.lastResolution = buildStrikeResolution(
				bonusOutcome,
				respondingPlayer.playerId,
				bonusTargetId,
				"strike",
			);
		}
		return {
			kind: "custom",
			result: finalizeResolvedChallenge(state, defeatedPlayerId),
		};
	},

	applyTimeoutDefault(state, interaction) {
		const actor = state.players.get(interaction.actorId)!;
		// declines the bonus strike
		resolveBearBonesBonusStrike(state, actor, false, null, null);
		state.pendingAction = null;
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "bear_bones_bonus_strike",
		actorId: interaction.actorId,
		eligibleTargetIds: interaction.eligibleTargetIds,
	}),
};