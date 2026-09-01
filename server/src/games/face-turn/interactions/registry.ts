import type { InteractionSpec, PendingInteraction } from "./types";
import { peekDiscardSpec } from "./peek-discard";
import { crewReactivateSpec } from "./crew-reactivate";
import { poisonTargetPickSpec } from "./poison-target-pick";
import { chooseCrewToTurnSpec } from "./choose-crew-to-turn";
import { chooseDiscardCountSpec } from "./choose-discard-count";
import { chooseFromDiscardSpec } from "./choose-from-discard";
import { digDeepPickSpec } from "./dig-deep-pick";
import { switchUpPickSpec } from "./switch-up-pick";
import { tacticalSupportHideSpec } from "./tactical-support-hide";
import { bearBonesBonusStrikeSpec } from "./bear-bones-bonus-strike";
import { bearBonesStealPickSpec } from "./bear-bones-steal-pick";
import { voidLegsChoiceSpec } from "./void-legs-choice";
import { backgroundCheckGuessSpec } from "./background-check-guess";
import { tagOutPickSpec } from "./tag-out-pick";
import { truthSerumRevealSpec } from "./truth-serum-reveal";
import { tooBigSwapPickSpec } from "./too-big-swap-pick";
import { watcherStealPickSpec } from "./watcher-steal-pick";
import { lighthouseDisablePickSpec } from "./lighthouse-disable-pick";
import { watcherHideOfferSpec } from "./watcher-hide-offer";
import { belladonnaCopyPickSpec } from "./belladonna-copy-pick";

// registry keyed by interaction type
// exhaustive mapped type so every PendingInteraction variant has a spec
const interactionRegistry: {
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
	tactical_support_hide_offer: tacticalSupportHideSpec,
	watcher_hide_offer: watcherHideOfferSpec,
	bear_bones_bonus_strike: bearBonesBonusStrikeSpec,
	bear_bones_steal_pick: bearBonesStealPickSpec,
	void_legs_choice: voidLegsChoiceSpec,
	background_check_guess: backgroundCheckGuessSpec,
	tag_out_pick: tagOutPickSpec,
	truth_serum_reveal: truthSerumRevealSpec,
	too_big_swap_pick: tooBigSwapPickSpec,
	watcher_steal_pick: watcherStealPickSpec,
	lighthouse_disable_pick: lighthouseDisablePickSpec,
	belladonna_copy_pick: belladonnaCopyPickSpec,
};

export function getInteractionSpec<T extends PendingInteraction>(
	interaction: T,
): InteractionSpec<T> {
	return interactionRegistry[interaction.type] as unknown as InteractionSpec<T>;
}