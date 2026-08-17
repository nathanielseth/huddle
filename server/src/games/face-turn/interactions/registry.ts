import type { InteractionSpec, PendingInteraction } from "./types";
import { peekDiscardSpec } from "./peek-discard";
import { crewReactivateSpec } from "./crew-reactivate";
import { poisonTargetPickSpec } from "./poison-target-pick";
import { chooseCrewToTurnSpec } from "./choose-crew-to-turn";
import { chooseDiscardCountSpec } from "./choose-discard-count";
import { chooseFromDiscardSpec } from "./choose-from-discard";
import { digDeepPickSpec } from "./dig-deep-pick";
import { switchUpPickSpec } from "./switch-up-pick";
import { tacticalSupportUnturnSpec } from "./tactical-support-unturn";
import { bearBonesBonusStrikeSpec } from "./bear-bones-bonus-strike";
import { voidLegsChoiceSpec } from "./void-legs-choice";
import { backgroundCheckGuessSpec } from "./background-check-guess";
import { tagOutPickSpec } from "./tag-out-pick";
import { truthSerumRevealSpec } from "./truth-serum-reveal";
import { tooBigSwapPickSpec } from "./too-big-swap-pick";
import { chooseOwnCrewToStrikeSpec } from "./choose-own-crew-to-strike";
import { watcherStealPickSpec } from "./watcher-steal-pick";
import { lighthouseDisablePickSpec } from "./lighthouse-disable-pick";
import { watcherUnturnOfferSpec } from "./watcher-unturn-offer";

// registry keyed by interaction type; exhaustive mapped type so every PendingInteraction variant has a spec
// adding a new one without an entry fails to compile
export const interactionRegistry: {
	[K in PendingInteraction["type"]]: InteractionSpec<
		Extract<PendingInteraction, { type: K }>
	>;
} = {
	peek_discard: peekDiscardSpec,
	crew_reactivate: crewReactivateSpec,
	poison_target_pick: poisonTargetPickSpec,
	choose_crew_to_turn: chooseCrewToTurnSpec,
	choose_discard_count: chooseDiscardCountSpec,
	choose_from_discard: chooseFromDiscardSpec,
	dig_deep_pick: digDeepPickSpec,
	switch_up_pick: switchUpPickSpec,
	tactical_support_unturn_offer: tacticalSupportUnturnSpec,
	watcher_unturn_offer: watcherUnturnOfferSpec,
	bear_bones_bonus_strike: bearBonesBonusStrikeSpec,
	void_legs_choice: voidLegsChoiceSpec,
	background_check_guess: backgroundCheckGuessSpec,
	tag_out_pick: tagOutPickSpec,
	truth_serum_reveal: truthSerumRevealSpec,
	too_big_swap_pick: tooBigSwapPickSpec,
	choose_own_crew_to_strike: chooseOwnCrewToStrikeSpec,
	watcher_steal_pick: watcherStealPickSpec,
	lighthouse_disable_pick: lighthouseDisablePickSpec,
};

export function getInteractionSpec<T extends PendingInteraction>(
	interaction: T,
): InteractionSpec<T> {
	return interactionRegistry[interaction.type] as unknown as InteractionSpec<T>;
}