import type { CrewClass } from "../../../../shared/games/face-turn/types";
import {
	BOSS_DISPLAY,
	CREW_DISPLAY,
	MOVE_DISPLAY,
	type BossCardDisplay,
	type CrewCardDisplay,
	type MoveCardDisplay,
} from "../../../../shared/games/face-turn/card-display";

export type EffectPrimitive =
	| {
			type: "deal_damage";
			target: "enemy_boss";
			amount: number;
			undefendable?: boolean;
			cannotBeMultiplied?: boolean;
	  }
	| {
			type: "deal_damage_all_enemy_bosses";
			amount: number;
	  }
	| {
			type: "deal_damage_per_face_up_ally";
			target: "enemy_boss";
			amountPerAlly: number;
	  }
	| {
			type: "deal_damage_percent_current_hp";
			target: "enemy_boss";
			percent: number;
			cannotBeMultiplied?: boolean;
	  }
	| {
			type: "deal_damage_ignore_armor";
			amount: number;
	  }
	| {
			type: "deal_damage_per_discarded_variable";
			damagePerCard: number;
	  }
	| {
			type: "deal_damage_per_enemy_hand_discarded";
			damagePerCard: number;
	  }
	| {
			type: "deal_damage_self_boss";
			amount: number;
	  }
	| {
			type: "strike_enemy_crew";
			undefendable?: boolean;
	  }
	| {
			type: "strike_enemy_crew_undefendable_with_cash_cost";
			cashCost: number;
	  }
	| {
			type: "strike_enemy_crew_defendable";
	  }
	// kills the actor's own already face-up crew, never turns face-down
	| {
			type: "strike_own_crew";
			targetSlot?: number;
	  }
	| { type: "turn_enemy_crew"; targetSlot?: number }
	| { type: "turn_ally_crew"; targetSlot?: number }
	| {
			type: "turn_all_other_ally_crew";
	  }
	| { type: "hide_ally_crew"; targetSlot?: number }
	| {
			type: "hide_other_ally_crew";
	  }
	| {
			type: "hide_then_retrigger_ally";
	  }
	| {
			type: "hide_one_turn_different_ally";
	  }
	| {
			type: "hide_self";
	  }
	| {
			type: "swap_crew_with_teammate";
	  }
	| {
			type: "swap_with_any_face_up_crew";
	  }
	| {
			type: "copy_enemy_active_move";
	  }
	| { type: "draw_cards"; amount: number }
	| { type: "discard_cards_from_hand"; amount: number }
	| { type: "discard_all_enemy_hand" }
	| { type: "discard_all_actives_all_players" }
	| { type: "discard_enemy_actives" }
	| {
			type: "discard_one_draw_three";
	  }
	// amount depends on whether actor has called a bluff this game
	| {
			type: "discard_variable_by_bluff_flag";
			baseAmount: number;
			reducedAmount: number;
	  }
	// draws bonusAmount if hand was empty after removal
	| {
			type: "draw_cards_or_more_if_hand_was_empty";
			baseAmount: number;
			bonusAmount: number;
	  }
	| {
			type: "return_one_from_discard_to_hand";
	  }
	| {
			type: "return_discards_to_hand_until_full";
	  }
	// fizzles if already in hand or not in deck
	| {
			type: "search_deck_for_card_add_to_hand";
			cardId: string;
			costOverride?: number;
	  }
	| {
			type: "look_at_top_deck_draw_one";
			lookCount: number;
			drawCount?: number;
	  }
	| { type: "gain_cash"; amount: number }
	| { type: "steal_cash"; amount: number }
	// lets actor choose target when multiple living enemies exist
	| { type: "steal_cash_choose_target"; amount: number }
	| {
			type: "redistribute_cash_to_poorest";
			cashAmount: number;
			drawAmount: number;
	  }
	| {
			type: "set_both_cash_zero_then_draw";
			drawAmount: number;
	  }
	| { type: "heal_boss"; amount: number }
	| { type: "armor_boss"; amount: number }
	| { type: "armor_all_ally_bosses"; amount: number }
	| { type: "remove_all_armor"; target: "enemy_boss" | "ally_boss" }
	| {
			type: "immunity_until_next_turn";
			turns?: number;
	  }
	| {
			type: "set_ally_boss_hp_gain_cash_draw";
			hpAmount: number;
			cashGain: number;
			drawAmount: number;
	  }
	| {
			type: "peek_enemy_hand_then_gain_cash";
			cashGain: number;
	  }
	| {
			type: "peek_steal";
			cashAmount: number;
	  }
	| {
			type: "steal_random_card";
	  }
	| {
			type: "peek_two_random_enemy_cards_discard_one";
	  }
	| {
			type: "reveal_enemy_crew_class";
	  }
	| {
			type: "command_guess_crew_class_turn_if_correct";
	  }
	| {
			type: "command_discard_hand_for_cash";
			cashPerCard: number;
	  }
	// damages enemy boss equal to actor's armor, then empties actor's armor
	| {
			type: "command_deal_damage_equal_to_armor";
	  }
	| {
			type: "negate_enemy_slow_move";
	  }
	| {
			type: "reflect_slow_move_base_damage";
	  }
	| {
			type: "passive_poison_per_round";
			damagePerRound: number;
	  }
	| {
			type: "passive_cash_per_turn";
			amount: number;
	  }
	| { type: "passive_draw_per_turn"; amount: number }
	| {
			type: "passive_cash_on_enemy_move_or_strike";
			amount: number;
	  }
	| { type: "passive_heal_on_move_played"; amount: number }
	| { type: "passive_damage_random_enemy_on_move_played"; amount: number }
	| { type: "passive_armor_per_turn"; amount: number }
	| {
			type: "passive_optional_discard_for_damage_per_turn";
			discardCost: number;
			damage: number;
	  }
	| {
			type: "passive_extra_reserve_crew";
	  }
	| {
			type: "passive_watcher_hide_on_challenge_win";
	  }
	| {
			type: "passive_armor_on_ally_crew_turn";
			amount: number;
	  }
	// scoping to moves only is a known approximation
	| {
			type: "passive_negate_damage_percent";
			percent: number;
	  }
	| {
			type: "passive_disable_all_crew_skills";
	  }
	| {
			type: "passive_disable_all_enemy_crew_passives";
	  }
	// flips the default for crew turn selection
	| {
			type: "passive_defender_chooses_crew_to_turn";
	  }
	| {
			type: "passive_background_check";
	  }
	| {
			type: "passive_life_insurance";
	  }
	| {
			type: "passive_false_flag";
	  }
	// defends strike targeting while hp > 50; strike fizzles, no crew turn
	| {
			type: "passive_defend_strikes_above_half_hp";
	  }
	// resolved structurally in triggerCrewTurnedEffects
	| {
			type: "passive_suppress_enemy_turned_effects";
	  }
	// resolved structurally in discardFromHand
	| {
			type: "passive_armor_on_discard";
	  }
	// triggers once per turn when hand becomes empty; flag resets at startTurn
	| {
			type: "passive_draw_on_hand_empty_once_per_turn";
			amount: number;
	  }
	| {
			type: "passive_optional_strike_on_successful_challenge";
	  }
	// triggers when holder or teammate flips own crew
	| {
			type: "passive_strike_on_self_turned_ally";
	  }
	// fires when holder kills enemy crew; turns holder's own slot face-down
	| {
			type: "passive_turn_self_down_on_enemy_crew_kill";
	  }
	// all damage this player deals is piercing: bypasses armor
	| {
			type: "passive_all_damage_is_piercing";
	  }
	// monkey man: steals cash when dealing damage to enemy boss
	| {
			type: "passive_steal_cash_on_damage_dealt";
			amount: number;
	  }
	// the razor: strike, or deal damage with a move other than Stab,
	// to add a copy of Stab to hand
	| {
			type: "passive_razor_stab_on_strike_or_damage";
	  }
	| {
			type: "win_if_void_pieces_assembled";
			requiredPieceIds: readonly string[];
	  }
	| { type: "become_also_striker" }
	| { type: "become_also_hider" }
	| { type: "become_also_defender" }
	| { type: "transform_andrew_into_wolfman" }
	| {
			type: "passive_reduce_all_move_costs";
			reduction: number;
	  }
	// only reduces burst move costs; summed independently
	| {
			type: "passive_reduce_burst_move_costs";
			reduction: number;
	  }
	// flat reduction to strike/defend/collect/hide class action costs
	| {
			type: "passive_reduce_class_action_costs";
			reduction: number;
	  }
	// surcharge read live from holder, not accumulated on target
	| {
			type: "passive_increase_enemy_move_costs";
			amount: number;
	  }
	// once per turn; fires only when holder's boss takes damage
	| {
			type: "passive_cash_on_damage_taken";
			amount: number;
	  }
	| {
			type: "give_ally_cash_then_optional_hide";
			cashAmount: number;
	  }
	| {
			type: "discard_then_reactivate_ally_turned_effect";
			discardCost: number;
	  }
	| {
			type: "mutual_discard_hand_then_redraw_same_count";
	  }
	| {
			type: "passive_team_cash_on_ally_collect";
			amount: number;
	  }
	| {
			type: "passive_mirror_enemy_collect_cash";
	  }
	// marks a face-down enemy crew at cast time
	| {
			type: "mark_enemy_crew_for_delayed_turn";
	  }
	// lasting counter while active, consumed structurally
	| {
			type: "passive_cease_and_desist";
	  }
	| {
			type: "discard_targeted_enemy_active_move";
	  }
	| {
			type: "passive_cash_on_challenge_win";
			amount: number;
	  }
	| {
			type: "shuffle_discard_into_deck_then_draw";
	  }
	| {
			type: "passive_self_damage_and_cash_per_turn";
			damage: number;
			cashAmount: number;
	  }
	// self-discards immediately on resolution
	| {
			type: "choose_red_herring_crew";
	  }
	// never defaults to self, requires a genuine living teammate
	| {
			type: "gain_cash_and_draw_ally";
			cashAmount: number;
			drawAmount: number;
	  };

// single source of truth for what each effect targets, derived from handler code
export type EffectTargeting =
	| {
			scope: "enemy";
			slot: "boss" | "crew" | "active" | "player";
	  }
	| {
			scope: "ally";
			slot: "boss" | "crew" | "player";
			strict?: boolean;
	  }
	| { scope: "self" }
	| { scope: "none" };

type RequiresCrewKind =
	| "own_face_down"
	| "own_face_up"
	| "own_mixed"
	| "enemy_face_down"
	| "enemy_active_move";

const EFFECT_TARGETING_TABLE = {
	deal_damage: { scope: "enemy", slot: "boss" },
	deal_damage_all_enemy_bosses: { scope: "none" },
	deal_damage_per_face_up_ally: { scope: "enemy", slot: "boss" },
	deal_damage_percent_current_hp: { scope: "enemy", slot: "boss" },
	deal_damage_ignore_armor: { scope: "enemy", slot: "boss" },
	deal_damage_per_discarded_variable: { scope: "enemy", slot: "boss" },
	deal_damage_per_enemy_hand_discarded: { scope: "enemy", slot: "boss" },
	deal_damage_self_boss: { scope: "self" },
	// boss command but damage targets enemy
	command_deal_damage_equal_to_armor: { scope: "enemy", slot: "boss" },
	// targets a player, not boss
	passive_poison_per_round: { scope: "enemy", slot: "player" },

	strike_enemy_crew: { scope: "enemy", slot: "crew" },
	strike_enemy_crew_undefendable_with_cash_cost: {
		scope: "enemy",
		slot: "crew",
	},
	strike_enemy_crew_defendable: { scope: "enemy", slot: "crew" },
	// self, not ally (actor's own crew)
	strike_own_crew: { scope: "self" },

	turn_enemy_crew: { scope: "enemy", slot: "crew" },
	// self, not ally (actor's own crew)
	turn_ally_crew: { scope: "self" },
	turn_all_other_ally_crew: { scope: "self" },
	hide_ally_crew: { scope: "self" },
	hide_other_ally_crew: { scope: "self" },
	hide_then_retrigger_ally: { scope: "self" },
	hide_one_turn_different_ally: { scope: "self" },
	hide_self: { scope: "self" },
	// strict: never self
	swap_crew_with_teammate: { scope: "ally", slot: "player", strict: true },
	// modeled none: no single team scope fits
	swap_with_any_face_up_crew: { scope: "none" },
	// modeled none: resolved via pendingInteraction
	copy_enemy_active_move: { scope: "none" },

	draw_cards: { scope: "self" },
	discard_cards_from_hand: { scope: "self" },
	discard_all_enemy_hand: { scope: "enemy", slot: "player" },
	discard_all_actives_all_players: { scope: "none" },
	discard_enemy_actives: { scope: "enemy", slot: "player" },
	discard_one_draw_three: { scope: "self" },
	discard_variable_by_bluff_flag: { scope: "self" },
	draw_cards_or_more_if_hand_was_empty: { scope: "self" },
	return_one_from_discard_to_hand: { scope: "self" },
	return_discards_to_hand_until_full: { scope: "self" },
	search_deck_for_card_add_to_hand: { scope: "self" },
	look_at_top_deck_draw_one: { scope: "self" },

	gain_cash: { scope: "self" },
	steal_cash: { scope: "enemy", slot: "player" },
	// enemy target; choose_target variant
	steal_cash_choose_target: { scope: "enemy", slot: "player" },
	redistribute_cash_to_poorest: { scope: "self" },
	// enemy-facing half is the target
	set_both_cash_zero_then_draw: { scope: "enemy", slot: "player" },

	heal_boss: { scope: "ally", slot: "boss" },
	armor_boss: { scope: "ally", slot: "boss" },
	armor_all_ally_bosses: { scope: "none" },
	// current instance uses enemy_boss, but handler supports both
	remove_all_armor: { scope: "enemy", slot: "boss" },
	immunity_until_next_turn: { scope: "self" },
	set_ally_boss_hp_gain_cash_draw: { scope: "ally", slot: "boss" },

	peek_enemy_hand_then_gain_cash: { scope: "enemy", slot: "player" },
	peek_steal: { scope: "enemy", slot: "player" },
	steal_random_card: { scope: "enemy", slot: "player" },
	peek_two_random_enemy_cards_discard_one: { scope: "enemy", slot: "player" },
	reveal_enemy_crew_class: { scope: "enemy", slot: "player" },

	mark_enemy_crew_for_delayed_turn: { scope: "enemy", slot: "crew" },
	discard_targeted_enemy_active_move: { scope: "enemy", slot: "active" },
	shuffle_discard_into_deck_then_draw: { scope: "self" },
	choose_red_herring_crew: { scope: "self" },
	// strict: never self
	gain_cash_and_draw_ally: { scope: "ally", slot: "player", strict: true },
	win_if_void_pieces_assembled: { scope: "none" },
	transform_andrew_into_wolfman: { scope: "self" },
	give_ally_cash_then_optional_hide: { scope: "ally", slot: "player" },
	discard_then_reactivate_ally_turned_effect: { scope: "self" },
	// enemy-facing half is the target
	mutual_discard_hand_then_redraw_same_count: {
		scope: "enemy",
		slot: "player",
	},

	negate_enemy_slow_move: { scope: "none" },
	reflect_slow_move_base_damage: { scope: "none" },

	passive_cash_per_turn: { scope: "self" },
	passive_draw_per_turn: { scope: "self" },
	passive_cash_on_enemy_move_or_strike: { scope: "self" },
	passive_heal_on_move_played: { scope: "self" },
	// random target, no client-suppliable target
	passive_damage_random_enemy_on_move_played: { scope: "none" },
	passive_armor_per_turn: { scope: "self" },
	passive_optional_discard_for_damage_per_turn: { scope: "self" },
	passive_extra_reserve_crew: { scope: "self" },
	passive_watcher_hide_on_challenge_win: { scope: "self" },
	passive_armor_on_ally_crew_turn: { scope: "self" },
	passive_negate_damage_percent: { scope: "self" },
	passive_disable_all_crew_skills: { scope: "self" },
	passive_disable_all_enemy_crew_passives: { scope: "none" },
	passive_defender_chooses_crew_to_turn: { scope: "self" },
	passive_background_check: { scope: "self" },
	// reads ally target
	passive_life_insurance: { scope: "ally", slot: "player" },
	passive_false_flag: { scope: "self" },
	passive_defend_strikes_above_half_hp: { scope: "self" },
	passive_suppress_enemy_turned_effects: { scope: "none" },
	passive_armor_on_discard: { scope: "self" },
	passive_draw_on_hand_empty_once_per_turn: { scope: "self" },
	passive_optional_strike_on_successful_challenge: { scope: "self" },
	passive_strike_on_self_turned_ally: { scope: "self" },
	passive_turn_self_down_on_enemy_crew_kill: { scope: "self" },
	passive_all_damage_is_piercing: { scope: "self" },
	passive_steal_cash_on_damage_dealt: { scope: "self" },
	passive_razor_stab_on_strike_or_damage: { scope: "self" },
	become_also_striker: { scope: "self" },
	become_also_hider: { scope: "self" },
	become_also_defender: { scope: "self" },
	passive_reduce_all_move_costs: { scope: "self" },
	passive_reduce_burst_move_costs: { scope: "self" },
	passive_reduce_class_action_costs: { scope: "self" },
	passive_increase_enemy_move_costs: { scope: "self" },
	passive_cash_on_damage_taken: { scope: "self" },
	passive_team_cash_on_ally_collect: { scope: "self" },
	// enemy player target
	passive_mirror_enemy_collect_cash: { scope: "enemy", slot: "player" },
	passive_cease_and_desist: { scope: "none" },
	passive_cash_on_challenge_win: { scope: "self" },
	passive_self_damage_and_cash_per_turn: { scope: "self" },

	command_guess_crew_class_turn_if_correct: { scope: "none" },
	command_discard_hand_for_cash: { scope: "self" },
} satisfies Record<EffectPrimitive["type"], EffectTargeting>;

export const EFFECT_TARGETING: Readonly<
	Record<EffectPrimitive["type"], EffectTargeting>
> = EFFECT_TARGETING_TABLE;

export function getEffectTargeting(
	type: EffectPrimitive["type"],
): EffectTargeting {
	return EFFECT_TARGETING[type];
}

// only entries that add crew-shape preconditions
export const EFFECT_REQUIRES_CREW: Readonly<
	Partial<Record<EffectPrimitive["type"], RequiresCrewKind>>
> = {
	turn_ally_crew: "own_face_down",
	choose_red_herring_crew: "own_face_down",
	hide_ally_crew: "own_face_up",
	hide_then_retrigger_ally: "own_face_up",
	strike_own_crew: "own_face_up",
	hide_one_turn_different_ally: "own_mixed",
	mark_enemy_crew_for_delayed_turn: "enemy_face_down",
	discard_targeted_enemy_active_move: "enemy_active_move",
};

export type EffectCondition =
	| { when: "always" }
	| { when: "another_ally_is_turned" }
	| { when: "has_turned_ally_crew_this_game" }
	| { when: "ally_class_is_turned"; class: CrewClass }
	| { when: "self_class_is_turned"; class: CrewClass }
	| { when: "has_armored_boss" }
	| { when: "enemy_has_more_cash" }
	| { when: "void_pieces_assembled" }
	| { when: "no_face_up_crew" }
	| { when: "self_turned_not_by_enemy" }
	| { when: "has_bluffed_successfully" };

export interface ConditionalEffect {
	readonly condition: EffectCondition;
	readonly effect: EffectPrimitive;
	readonly negated?: boolean;
}

export type CardEffect = EffectPrimitive | ConditionalEffect;

export const when = (
	condition: EffectCondition,
	effect: EffectPrimitive,
	negated?: boolean,
): ConditionalEffect => ({
	condition,
	effect,
	...(negated ? { negated: true } : {}),
});

export interface BossCard extends BossCardDisplay {
	readonly commandEffects: readonly CardEffect[];
	readonly passiveEffects: readonly CardEffect[];
}

export interface CrewCard extends CrewCardDisplay {
	readonly turnedEffects: readonly CardEffect[];
	readonly passiveEffects: readonly CardEffect[];
}

export interface MoveCard extends MoveCardDisplay {
	readonly effects: readonly CardEffect[];
}

const BOSS_MECHANICS: Record<
	string,
	Pick<BossCard, "commandEffects" | "passiveEffects">
> = {
	"the-watcher": {
		commandEffects: [{ type: "peek_steal", cashAmount: 1 }],
		passiveEffects: [{ type: "passive_watcher_hide_on_challenge_win" }],
	},
	"the-dealer": {
		commandEffects: [{ type: "command_discard_hand_for_cash", cashPerCard: 1 }],
		passiveEffects: [{ type: "passive_extra_reserve_crew" }],
	},
	"the-razor": {
		commandEffects: [{ type: "command_guess_crew_class_turn_if_correct" }],
		passiveEffects: [{ type: "passive_razor_stab_on_strike_or_damage" }],
	},
	"the-bastion": {
		commandEffects: [{ type: "command_deal_damage_equal_to_armor" }],
		passiveEffects: [{ type: "passive_cash_on_damage_taken", amount: 1 }],
	},
};

export const BOSSES: readonly BossCard[] = BOSS_DISPLAY.map((display) => ({
	...display,
	...BOSS_MECHANICS[display.id]!,
}));

const CREW_MECHANICS: Record<
	string,
	Pick<CrewCard, "turnedEffects" | "passiveEffects">
> = {
	pektus: {
		turnedEffects: [{ type: "deal_damage_ignore_armor", amount: 25 }],
		passiveEffects: [{ type: "passive_all_damage_is_piercing" }],
	},
	shrike: {
		turnedEffects: [{ type: "strike_enemy_crew_defendable" }],
		passiveEffects: [],
	},
	"g-rone": {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_poison_per_round", damagePerRound: 10 }],
	},
	"monkey-man": {
		turnedEffects: [{ type: "steal_random_card" }],
		passiveEffects: [{ type: "passive_steal_cash_on_damage_dealt", amount: 1 }],
	},
	"berto-lopez": {
		turnedEffects: [
			when(
				{ when: "another_ally_is_turned" },
				{ type: "deal_damage", target: "enemy_boss", amount: 30 },
			),
			when(
				{ when: "another_ally_is_turned" },
				{ type: "deal_damage", target: "enemy_boss", amount: 15 },
				true,
			),
		],
		passiveEffects: [{ type: "passive_turn_self_down_on_enemy_crew_kill" }],
	},
	"hot-girl": {
		turnedEffects: [
			{ type: "discard_all_enemy_hand" },
			{ type: "deal_damage_per_enemy_hand_discarded", damagePerCard: 5 },
		],
		passiveEffects: [],
	},
	"black-fist": {
		turnedEffects: [
			{ type: "discard_cards_from_hand", amount: 2 },
			{ type: "deal_damage", target: "enemy_boss", amount: 35 },
		],
		passiveEffects: [],
	},
	whisper: {
		turnedEffects: [
			{
				type: "discard_variable_by_bluff_flag",
				baseAmount: 3,
				reducedAmount: 1,
			},
			{ type: "strike_enemy_crew", undefendable: true },
		],
		passiveEffects: [],
	},
	"rilla-gorilla": {
		turnedEffects: [
			{ type: "armor_boss", amount: 30 },
			{ type: "deal_damage", target: "enemy_boss", amount: 10 },
		],
		passiveEffects: [],
	},
	frontline: {
		turnedEffects: [{ type: "immunity_until_next_turn", turns: 2 }],
		passiveEffects: [],
	},
	"mama-mercy": {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_armor_on_ally_crew_turn", amount: 20 }],
	},
	lighthouse: {
		turnedEffects: [{ type: "deal_damage_all_enemy_bosses", amount: 10 }],
		passiveEffects: [{ type: "passive_suppress_enemy_turned_effects" }],
	},
	glob: {
		turnedEffects: [
			when({ when: "has_armored_boss" }, { type: "armor_boss", amount: 40 }),
			when(
				{ when: "has_armored_boss" },
				{ type: "steal_cash", amount: 1 },
				true,
			),
		],
		passiveEffects: [],
	},
	silencer: {
		turnedEffects: [{ type: "armor_all_ally_bosses", amount: 10 }],
		passiveEffects: [{ type: "passive_disable_all_enemy_crew_passives" }],
	},
	"doctor-norman": {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_armor_on_discard" }],
	},
	lotus: {
		turnedEffects: [],
		passiveEffects: [{ type: "become_also_striker" }],
	},
	mayumi: {
		turnedEffects: [
			{ type: "gain_cash", amount: 2 },
			{ type: "draw_cards", amount: 1 },
		],
		passiveEffects: [],
	},
	"too-big": {
		turnedEffects: [{ type: "swap_with_any_face_up_crew" }],
		passiveEffects: [
			{
				type: "passive_self_damage_and_cash_per_turn",
				damage: 5,
				cashAmount: 0,
			},
		],
	},
	"claw-machine": {
		turnedEffects: [{ type: "draw_cards", amount: 3 }],
		passiveEffects: [],
	},
	bagman: {
		turnedEffects: [],
		passiveEffects: [{ type: "become_also_defender" }],
	},
	"cool-guy": {
		turnedEffects: [],
		passiveEffects: [
			{ type: "passive_damage_random_enemy_on_move_played", amount: 3 },
		],
	},
	belladonna: {
		turnedEffects: [{ type: "copy_enemy_active_move" }],
		passiveEffects: [
			{ type: "passive_reduce_class_action_costs", reduction: 1 },
		],
	},
	"rat-queen": {
		turnedEffects: [],
		passiveEffects: [
			{ type: "passive_draw_on_hand_empty_once_per_turn", amount: 2 },
		],
	},
	"bear-bones": {
		turnedEffects: [{ type: "steal_cash_choose_target", amount: 1 }],
		passiveEffects: [
			{ type: "passive_optional_strike_on_successful_challenge" },
		],
	},
	handles: {
		turnedEffects: [
			when({ when: "another_ally_is_turned" }, { type: "hide_self" }),
			when(
				{ when: "another_ally_is_turned" },
				{ type: "deal_damage_self_boss", amount: 5 },
			),
		],
		passiveEffects: [],
	},
	"miss-direction": {
		turnedEffects: [
			when(
				{ when: "another_ally_is_turned" },
				{ type: "hide_other_ally_crew" },
			),
		],
		passiveEffects: [{ type: "passive_armor_per_turn", amount: 10 }],
	},
	terminal: {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_defend_strikes_above_half_hp" }],
	},
	suplex: {
		turnedEffects: [{ type: "deal_damage", target: "enemy_boss", amount: 10 }],
		passiveEffects: [{ type: "passive_strike_on_self_turned_ally" }],
	},
	retro: {
		turnedEffects: [
			{
				type: "search_deck_for_card_add_to_hand",
				cardId: "chronotrix",
				costOverride: 3,
			},
		],
		passiveEffects: [],
	},
	andrew: {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_draw_per_turn", amount: 1 }],
	},
	zednem: {
		turnedEffects: [{ type: "draw_cards", amount: 2 }],
		passiveEffects: [{ type: "passive_reduce_burst_move_costs", reduction: 1 }],
	},
	keeper: {
		turnedEffects: [{ type: "steal_random_card" }],
		passiveEffects: [{ type: "passive_increase_enemy_move_costs", amount: 1 }],
	},
	wolfman: {
		turnedEffects: [{ type: "deal_damage", target: "enemy_boss", amount: 40 }],
		passiveEffects: [],
	},
};

export const CREW: readonly CrewCard[] = CREW_DISPLAY.map((display) => ({
	...display,
	...CREW_MECHANICS[display.id]!,
}));

const MOVE_MECHANICS: Record<string, Pick<MoveCard, "effects">> = {
	"poison-breath": {
		effects: [{ type: "passive_poison_per_round", damagePerRound: 10 }],
	},
	"side-hustle": {
		effects: [{ type: "passive_cash_per_turn", amount: 2 }],
	},
	equalizer: {
		effects: [
			when(
				{ when: "enemy_has_more_cash" },
				{
					type: "passive_cash_per_turn",
					amount: 2,
				},
			),
		],
	},
	dataminer: {
		effects: [{ type: "passive_draw_per_turn", amount: 1 }],
	},
	"blood-money": {
		effects: [{ type: "passive_cash_on_enemy_move_or_strike", amount: 1 }],
	},
	"background-check": {
		effects: [{ type: "passive_background_check" }],
	},
	"prank-call": {
		effects: [
			when(
				{ when: "has_bluffed_successfully" },
				{ type: "steal_cash", amount: 4 },
			),
		],
	},
	"void-arms": {
		effects: [{ type: "passive_defender_chooses_crew_to_turn" }],
	},
	"void-legs": {
		effects: [
			{
				type: "passive_optional_discard_for_damage_per_turn",
				discardCost: 1,
				damage: 5,
			},
		],
	},
	"void-torso": {
		effects: [{ type: "passive_armor_per_turn", amount: 5 }],
	},
	"big-voucher": {
		effects: [{ type: "passive_reduce_all_move_costs", reduction: 1 }],
	},
	"command-center": {
		effects: [
			{ type: "passive_draw_per_turn", amount: 1 },
			{ type: "passive_cash_per_turn", amount: 1 },
		],
	},
	blackmail: {
		effects: [{ type: "passive_disable_all_crew_skills" }],
	},
	"supply-drop": {
		effects: [{ type: "passive_team_cash_on_ally_collect", amount: 1 }],
	},
	"life-insurance": {
		effects: [{ type: "passive_life_insurance" }],
	},
	"false-flag-operation": {
		effects: [{ type: "passive_false_flag" }],
	},
	"bamboo-wall": {
		effects: [
			when(
				{ when: "no_face_up_crew" },
				{ type: "passive_armor_per_turn", amount: 10 },
				true,
			),
		],
	},
	"trickle-down-economics": {
		effects: [{ type: "passive_mirror_enemy_collect_cash" }],
	},
	"deleb-i": {
		effects: [
			{
				type: "win_if_void_pieces_assembled",
				requiredPieceIds: ["void-arms", "void-legs", "void-torso"],
			},
		],
	},
	reload: {
		effects: [{ type: "draw_cards", amount: 2 }],
	},
	"drive-by": {
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 30 }],
	},
	"claim-the-bounty": {
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 25 }],
	},
	stab: {
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 5 }],
	},
	ambush: {
		effects: [{ type: "strike_enemy_crew_defendable" }],
	},
	devastate: {
		effects: [
			{
				type: "deal_damage_percent_current_hp",
				target: "enemy_boss",
				percent: 50,
				cannotBeMultiplied: true,
			},
		],
	},
	"bulletproof-vest": {
		effects: [{ type: "armor_boss", amount: 10 }],
	},
	"job-application": {
		effects: [{ type: "set_both_cash_zero_then_draw", drawAmount: 3 }],
	},
	chronotrix: {
		effects: [
			{ type: "return_discards_to_hand_until_full" },
			{ type: "gain_cash", amount: 10 },
		],
	},
	"all-in": {
		effects: [
			{
				type: "set_ally_boss_hp_gain_cash_draw",
				hpAmount: 1,
				cashGain: 7,
				drawAmount: 2,
			},
		],
	},
	"cheap-labor": {
		effects: [
			{ type: "draw_cards", amount: 1 },
			{ type: "gain_cash", amount: 2 },
		],
	},
	"coordinated-strike": {
		effects: [
			when(
				{ when: "ally_class_is_turned", class: "striker" },
				{ type: "deal_damage", target: "enemy_boss", amount: 30 },
			),
			when(
				{ when: "ally_class_is_turned", class: "striker" },
				{ type: "deal_damage", target: "enemy_boss", amount: 15 },
				true,
			),
		],
	},
	ratatatat: {
		effects: [{ type: "deal_damage_ignore_armor", amount: 20 }],
	},
	"dig-deep": {
		effects: [
			{ type: "look_at_top_deck_draw_one", lookCount: 5, drawCount: 2 },
		],
	},
	reinforcements: {
		effects: [
			{ type: "armor_boss", amount: 15 },
			{ type: "draw_cards", amount: 1 },
		],
	},
	"empty-the-clip": {
		effects: [
			{ type: "deal_damage_per_discarded_variable", damagePerCard: 10 },
		],
	},
	"fresh-start": {
		effects: [
			{
				type: "draw_cards_or_more_if_hand_was_empty",
				baseAmount: 1,
				bonusAmount: 3,
			},
		],
	},
	"tactical-support": {
		effects: [{ type: "give_ally_cash_then_optional_hide", cashAmount: 2 }],
	},
	"full-moon": {
		effects: [{ type: "transform_andrew_into_wolfman" }],
	},
	"scorched-earth": {
		effects: [{ type: "discard_enemy_actives" }],
	},
	"triangle-of-trust": {
		effects: [{ type: "discard_one_draw_three" }],
	},
	"heel-turn": {
		effects: [{ type: "hide_ally_crew" }],
	},
	"first-aid": {
		effects: [{ type: "heal_boss", amount: 20 }],
	},
	"neetos-clock": {
		effects: [
			{ type: "discard_then_reactivate_ally_turned_effect", discardCost: 2 },
		],
	},
	bailout: {
		effects: [
			{ type: "heal_boss", amount: 20 },
			{ type: "gain_cash", amount: 2 },
		],
	},
	"pull-counter": {
		effects: [{ type: "hide_then_retrigger_ally" }],
	},
	"cash-out": {
		effects: [
			{ type: "discard_cards_from_hand", amount: 2 },
			{ type: "gain_cash", amount: 3 },
		],
	},
	"switch-up": {
		effects: [{ type: "hide_one_turn_different_ally" }],
	},
	"tag-out": {
		effects: [{ type: "swap_crew_with_teammate" }],
	},
	"take-it-back": {
		effects: [{ type: "return_one_from_discard_to_hand" }],
	},
	"spare-change": {
		effects: [{ type: "gain_cash", amount: 3 }],
	},
	paycheck: {
		effects: [{ type: "gain_cash", amount: 4 }],
	},
	"sucker-punch": {
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 15 }],
	},
	wolfblaster: {
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 40 }],
	},
	"dead-drop-retrieval": {
		effects: [{ type: "draw_cards", amount: 3 }],
	},
	"cheap-shot": {
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 20 }],
	},
	"unfinished-business": {
		effects: [
			when(
				{ when: "ally_class_is_turned", class: "defender" },
				{ type: "strike_enemy_crew", undefendable: true },
			),
		],
	},
	kamikaze: {
		effects: [
			{ type: "turn_ally_crew" },
			{ type: "deal_damage", target: "enemy_boss", amount: 30 },
		],
	},
	nope: {
		effects: [{ type: "negate_enemy_slow_move" }],
	},
	interrogation: {
		effects: [{ type: "peek_two_random_enemy_cards_discard_one" }],
	},
	"reverse-card": {
		effects: [{ type: "reflect_slow_move_base_damage" }],
	},
	pickpocket: {
		effects: [{ type: "steal_cash", amount: 2 }],
	},
	"strip-em-down": {
		effects: [
			{ type: "remove_all_armor", target: "enemy_boss" },
			{ type: "draw_cards", amount: 1 },
		],
	},
	"wheel-of-fortune": {
		effects: [{ type: "mutual_discard_hand_then_redraw_same_count" }],
	},
	"truth-serum": {
		effects: [{ type: "reveal_enemy_crew_class" }],
	},
	"ayuda-slip": {
		effects: [
			{ type: "redistribute_cash_to_poorest", cashAmount: 3, drawAmount: 1 },
		],
	},
	"warrant-of-arrest": {
		effects: [{ type: "mark_enemy_crew_for_delayed_turn" }],
	},
	"cease-and-desist": {
		effects: [{ type: "passive_cease_and_desist" }],
	},
	sabotage: {
		effects: [{ type: "discard_targeted_enemy_active_move" }],
	},
	extortion: {
		effects: [{ type: "passive_cash_on_challenge_win", amount: 3 }],
	},
	restock: {
		effects: [{ type: "shuffle_discard_into_deck_then_draw" }],
	},
	"sell-out": {
		effects: [
			{
				type: "passive_self_damage_and_cash_per_turn",
				damage: 5,
				cashAmount: 2,
			},
		],
	},
	"red-herring": {
		effects: [{ type: "choose_red_herring_crew" }],
	},
	"my-treat": {
		effects: [
			{ type: "gain_cash_and_draw_ally", cashAmount: 2, drawAmount: 1 },
		],
	},
	"to-the-death": {
		effects: [
			{ type: "strike_own_crew" },
			{ type: "strike_enemy_crew", undefendable: true },
		],
	},
};

export const MOVES: readonly MoveCard[] = MOVE_DISPLAY.map((display) => ({
	...display,
	...MOVE_MECHANICS[display.id]!,
}));

export const BOSS_MAP = new Map(BOSSES.map((b) => [b.id, b]));
export const CREW_MAP = new Map(CREW.map((c) => [c.id, c]));
export const MOVE_MAP = new Map(MOVES.map((m) => [m.id, m]));

export function getBoss(id: string): BossCard {
	const card = BOSS_MAP.get(id);
	if (!card) throw new Error(`[face-turn] unknown boss: "${id}"`);
	return card;
}

export function getCrew(id: string): CrewCard {
	const card = CREW_MAP.get(id);
	if (!card) throw new Error(`[face-turn] unknown crew: "${id}"`);
	return card;
}

export function getMove(id: string): MoveCard {
	const card = MOVE_MAP.get(id);
	if (!card) throw new Error(`[face-turn] unknown move: "${id}"`);
	return card;
}

export function isDraftable(card: CrewCard | MoveCard): boolean {
	return card.draftable !== false;
}

export type MoveTargetScope = "enemy" | "ally" | "none";

// derived from EFFECT_TARGETING so validation matches handler code
export function getMoveTargetScope(move: MoveCard): MoveTargetScope {
	let sawEnemy = false;
	let sawAlly = false;

	for (const e of move.effects) {
		const eff = unwrapEffect(e);
		const targeting = EFFECT_TARGETING[eff.type];
		if (targeting.scope === "enemy") sawEnemy = true;
		if (targeting.scope === "ally") sawAlly = true;
	}

	if (sawEnemy) return "enemy";
	if (sawAlly) return "ally";
	return "none";
}

export function unwrapEffect(e: CardEffect): EffectPrimitive {
	return "condition" in e && "effect" in e ? e.effect : e;
}

export const CARD_IDS = {
	BOSS: {
		THE_WATCHER: "the-watcher",
		THE_DEALER: "the-dealer",
		THE_RAZOR: "the-razor",
		THE_BASTION: "the-bastion",
	},
	CREW: {
		PEKTUS: "pektus",
		SHRIKE: "shrike",
		G_RONE: "g-rone",
		MONKEY_MAN: "monkey-man",
		BERTO_LOPEZ: "berto-lopez",
		HOT_GIRL: "hot-girl",
		BLACK_FIST: "black-fist",
		WHISPER: "whisper",
		RILLA_GORILLA: "rilla-gorilla",
		FRONTLINE: "frontline",
		MAMA_MERCY: "mama-mercy",
		LIGHTHOUSE: "lighthouse",
		GLOB: "glob",
		SILENCER: "silencer",
		DOCTOR_NORMAN: "doctor-norman",
		LOTUS: "lotus",
		MAYUMI: "mayumi",
		TOO_BIG: "too-big",
		CLAW_MACHINE: "claw-machine",
		BAGMAN: "bagman",
		COOL_GUY: "cool-guy",
		BELLADONNA: "belladonna",
		RAT_QUEEN: "rat-queen",
		BEAR_BONES: "bear-bones",
		HANDLES: "handles",
		MISS_DIRECTION: "miss-direction",
		TERMINAL: "terminal",
		SUPLEX: "suplex",
		RETRO: "retro",
		ANDREW: "andrew",
		ZEDNEM: "zednem",
		KEEPER: "keeper",
		WOLFMAN: "wolfman",
	},
	MOVE: {
		POISON_BREATH: "poison-breath",
		SIDE_HUSTLE: "side-hustle",
		EQUALIZER: "equalizer",
		DATAMINER: "dataminer",
		BLOOD_MONEY: "blood-money",
		BACKGROUND_CHECK: "background-check",
		PRANK_CALL: "prank-call",
		VOID_ARMS: "void-arms",
		VOID_LEGS: "void-legs",
		VOID_TORSO: "void-torso",
		BIG_VOUCHER: "big-voucher",
		COMMAND_CENTER: "command-center",
		BLACKMAIL: "blackmail",
		SUPPLY_DROP: "supply-drop",
		LIFE_INSURANCE: "life-insurance",
		FALSE_FLAG_OPERATION: "false-flag-operation",
		BAMBOO_WALL: "bamboo-wall",
		TRICKLE_DOWN_ECONOMICS: "trickle-down-economics",
		DELEB_I: "deleb-i",
		RELOAD: "reload",
		DRIVE_BY: "drive-by",
		CLAIM_THE_BOUNTY: "claim-the-bounty",
		AMBUSH: "ambush",
		DEVASTATE: "devastate",
		BULLETPROOF_VEST: "bulletproof-vest",
		JOB_APPLICATION: "job-application",
		CHRONOTRIX: "chronotrix",
		ALL_IN: "all-in",
		CHEAP_LABOR: "cheap-labor",
		COORDINATED_STRIKE: "coordinated-strike",
		RATATATAT: "ratatatat",
		DIG_DEEP: "dig-deep",
		REINFORCEMENTS: "reinforcements",
		EMPTY_THE_CLIP: "empty-the-clip",
		FRESH_START: "fresh-start",
		TACTICAL_SUPPORT: "tactical-support",
		FULL_MOON: "full-moon",
		SCORCHED_EARTH: "scorched-earth",
		TRIANGLE_OF_TRUST: "triangle-of-trust",
		HEEL_TURN: "heel-turn",
		FIRST_AID: "first-aid",
		NEETOS_CLOCK: "neetos-clock",
		BAILOUT: "bailout",
		PULL_COUNTER: "pull-counter",
		CASH_OUT: "cash-out",
		SWITCH_UP: "switch-up",
		TAG_OUT: "tag-out",
		TAKE_IT_BACK: "take-it-back",
		SPARE_CHANGE: "spare-change",
		PAYCHECK: "paycheck",
		SUCKER_PUNCH: "sucker-punch",
		STAB: "stab",		WOLFBLASTER: "wolfblaster",
		DEAD_DROP_RETRIEVAL: "dead-drop-retrieval",
		CHEAP_SHOT: "cheap-shot",
		UNFINISHED_BUSINESS: "unfinished-business",
		KAMIKAZE: "kamikaze",
		NOPE: "nope",
		INTERROGATION: "interrogation",
		REVERSE_CARD: "reverse-card",
		PICKPOCKET: "pickpocket",
		STRIP_EM_DOWN: "strip-em-down",
		WHEEL_OF_FORTUNE: "wheel-of-fortune",
		TRUTH_SERUM: "truth-serum",
		AYUDA_SLIP: "ayuda-slip",
		WARRANT_OF_ARREST: "warrant-of-arrest",
		CEASE_AND_DESIST: "cease-and-desist",
		SABOTAGE: "sabotage",
		EXTORTION: "extortion",
		RESTOCK: "restock",
		SELL_OUT: "sell-out",
		RED_HERRING: "red-herring",
		MY_TREAT: "my-treat",
		TO_THE_DEATH: "to-the-death",
	},
} as const;

export const VOID_PIECE_IDS = [
	CARD_IDS.MOVE.VOID_ARMS,
	CARD_IDS.MOVE.VOID_LEGS,
	CARD_IDS.MOVE.VOID_TORSO,
] as const;