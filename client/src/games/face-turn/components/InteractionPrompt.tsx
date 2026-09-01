import { useFaceturnState } from "../hooks/useFaceturnState";
import {
	useFaceturnInteraction,
	getInteractionIdentity,
} from "../hooks/useFaceturnInteraction";
import {
	CrewReactivatePrompt,
	PoisonTargetPickPrompt,
	BearBonesStealPickPrompt,
	ChooseCrewToTurnPrompt,
	ChooseFromDiscardPrompt,
	TacticalSupportHideOfferPrompt,
	VoidLegsChoicePrompt,
	WatcherHideOfferPrompt,
	TruthSerumRevealPrompt,
	SwitchUpPickPrompt,
	TagOutPickPrompt,
	LighthouseDisablePickPrompt,
	TooBigSwapPickPrompt,
	BelladonnaCopyPickPrompt,
} from "./interaction-prompts/SimplePrompts";
import {
	ChooseDiscardCountPrompt,
	BearBonesPrompt,
	BackgroundCheckPrompt,
	DigDeepPrompt,
	PeekDiscardPrompt,
	WatcherStealPickPrompt,
} from "./interaction-prompts/StatefulPrompts";

export function InteractionPrompt() {
	const { pendingInteraction } = useFaceturnState();
	const { isResponder, canDecline, decline, resolve, locked } =
		useFaceturnInteraction();

	if (!pendingInteraction) return null;
	if (!isResponder) return null;

	const pi = pendingInteraction;
	const key = getInteractionIdentity(pi) ?? undefined;

	switch (pi.type) {
		case "peek_discard":
			return <PeekDiscardPrompt key={key} resolve={resolve} locked={locked} />;

		case "crew_reactivate":
			return (
				<CrewReactivatePrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "poison_target_pick":
			return (
				<PoisonTargetPickPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "choose_crew_to_turn":
			return (
				<ChooseCrewToTurnPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "choose_discard_count":
			return (
				<ChooseDiscardCountPrompt
					key={key}
					maxCount={pi.maxCount}
					damagePerCard={pi.damagePerCard}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "choose_from_discard":
			return (
				<ChooseFromDiscardPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "dig_deep_pick":
			return (
				<DigDeepPrompt
					key={key}
					maxPicks={pi.maxPicks ?? 1}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "switch_up_pick":
			return (
				<SwitchUpPickPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "tactical_support_hide_offer":
			return (
				<TacticalSupportHideOfferPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					decline={decline}
					canDecline={canDecline}
					locked={locked}
				/>
			);

		case "bear_bones_bonus_strike":
			return (
				<BearBonesPrompt
					key={key}
					eligibleTargetIds={pi.eligibleTargetIds}
					resolve={resolve}
					decline={decline}
					locked={locked}
				/>
			);

		case "bear_bones_steal_pick":
			return (
				<BearBonesStealPickPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "void_legs_choice":
			return (
				<VoidLegsChoicePrompt
					key={key}
					pi={pi}
					resolve={resolve}
					decline={decline}
					canDecline={canDecline}
					locked={locked}
				/>
			);

		case "background_check_guess":
			return (
				<BackgroundCheckPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "watcher_hide_offer":
			return (
				<WatcherHideOfferPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					decline={decline}
					canDecline={canDecline}
					locked={locked}
				/>
			);

		case "lighthouse_disable_pick":
			return (
				<LighthouseDisablePickPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "tag_out_pick":
			return (
				<TagOutPickPrompt key={key} pi={pi} resolve={resolve} locked={locked} />
			);

		case "truth_serum_reveal":
			return (
				<TruthSerumRevealPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "too_big_swap_pick":
			return (
				<TooBigSwapPickPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					locked={locked}
				/>
			);

		case "belladonna_copy_pick":
			return (
				<BelladonnaCopyPickPrompt
					key={key}
					pi={pi}
					resolve={resolve}
					decline={decline}
					locked={locked}
				/>
			);

		case "watcher_steal_pick":
			return (
				<WatcherStealPickPrompt key={key} resolve={resolve} locked={locked} />
			);

		default: {
			const _exhaustive: never = pi;
			console.error("[face-turn] unhandled interaction type", _exhaustive);
			return null;
		}
	}
}