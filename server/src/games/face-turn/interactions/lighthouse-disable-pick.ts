import type { InteractionSpec, PendingInteraction } from "./types";
import { resolveLighthouseDisablePick } from "../effects";

type Interaction = Extract<
	PendingInteraction,
	{ type: "lighthouse_disable_pick" }
>;

export const lighthouseDisablePickSpec: InteractionSpec<Interaction> = {
	getResponderId: (interaction) => interaction.actorId,
	actionType: "resolve_lighthouse_disable_pick",

	resolve(state, interaction, action) {
		if (action.type !== "resolve_lighthouse_disable_pick") return null;

		const maxPicks = interaction.maxPicks ?? 1;
		const seen = new Set<string>();
		let resolvedAny = false;
		for (const pick of action.picks.slice(0, maxPicks)) {
			const key = `${pick.targetPlayerId}:${pick.crewSlot}`;
			if (seen.has(key)) continue; // dedupe
			seen.add(key);
			const isEligible = interaction.eligibleTargets.some(
				(t) => t.playerId === pick.targetPlayerId && t.slot === pick.crewSlot,
			);
			if (!isEligible) continue;
			resolveLighthouseDisablePick(
				state,
				pick.targetPlayerId,
				pick.crewSlot,
				interaction.eligibleTargets,
			);
			resolvedAny = true;
		}
		if (!resolvedAny) return null;

		state.pendingInteraction = null;
		return { kind: "after_action" };
	},

	applyTimeoutDefault(state, interaction) {
		const maxPicks = interaction.maxPicks ?? 1;
		for (const t of interaction.eligibleTargets.slice(0, maxPicks)) {
			resolveLighthouseDisablePick(
				state,
				t.playerId,
				t.slot,
				interaction.eligibleTargets,
			);
		}
		return { kind: "after_action" };
	},

	toView: (interaction) => ({
		type: "lighthouse_disable_pick",
		actorId: interaction.actorId,
		eligibleTargets: interaction.eligibleTargets,
		...(interaction.maxPicks !== undefined
			? { maxPicks: interaction.maxPicks }
			: {}),
	}),
};