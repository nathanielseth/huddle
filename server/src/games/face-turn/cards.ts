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
			unblockable?: boolean;
			cannotBeMultiplied?: boolean;
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
			type: "deal_damage_ignore_shield";
			amount: number;
	  }
	// player chooses discard count; damage = count * damagePerCard
	| {
			type: "deal_damage_per_discarded_variable";
			damagePerCard: number;
	  }
	| {
			type: "deal_damage_per_enemy_hand_discarded";
			damagePerCard: number;
	  }
	| {
			type: "strike_enemy_crew";
			unblockable?: boolean;
	  }
	| {
			type: "strike_enemy_crew_unblockable_with_cash_cost";
			cashCost: number;
	  }
	| {
			type: "strike_enemy_crew_blockable";
	  }
	| { type: "turn_enemy_crew"; targetSlot?: number }
	| { type: "turn_ally_crew"; targetSlot?: number }
	| {
			type: "turn_all_other_ally_crew";
	  }
	| { type: "unturn_ally_crew"; targetSlot?: number }
	| {
			type: "unturn_other_ally_crew";
	  }
	| {
			type: "unturn_then_retrigger_ally";
	  }
	| {
			type: "unturn_one_turn_different_ally";
	  }
	| {
			type: "unturn_self";
	  }
	| {
			type: "swap_crew_with_teammate";
	  }
	| { type: "draw_cards"; amount: number }
	| { type: "discard_cards_from_hand"; amount: number }
	| { type: "discard_all_enemy_hand" }
	| { type: "discard_all_actives_all_players" }
	| {
			type: "discard_one_draw_three";
	  }
	// discard amount varies based on whether actor has called a bluff this game
	| {
			type: "discard_variable_by_bluff_flag";
			baseAmount: number;
			reducedAmount: number;
	  }
	// draws bonusAmount if hand was empty after this card is removed
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
	| { type: "shield_boss"; amount: number }
	| { type: "remove_all_shields"; target: "enemy_boss" | "ally_boss" }
	| {
			type: "immunity_until_next_turn";
			turns?: number;
	  }
	// hp set before draw
	| {
			type: "set_ally_boss_hp_gain_cash_draw";
			hpAmount: number;
			cashGain: number;
			drawAmount: number;
	  }
	// uses ctx.state.watcherReveal, not a pending interaction
	| {
			type: "peek_enemy_hand_then_gain_cash";
			cashGain: number;
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
			type: "command_replace_crew_from_reserve";
	  }
	// damage equals new shield total; actor's shield emptied after, regardless of target/damage
	| {
			type: "command_gain_shield_then_deal_damage_equal_to_shield";
			shieldAmount: number;
	  }
	| {
			type: "negate_enemy_slow_move";
	  }
	// the move itself is a slow move and can be nope'd
	| {
			type: "reflect_slow_move_base_damage";
	  }
	| {
			type: "passive_poison_per_round";
			damagePerRound: number;
	  }
	// per turn, not per round
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
	| { type: "passive_shield_per_turn"; amount: number }
	| {
			type: "passive_optional_discard_for_damage_per_turn";
			discardCost: number;
			damage: number;
	  }
	| {
			type: "passive_watcher_unturn_on_challenge_win";
	  }
	// event-based, not per-round accumulation
	| {
			type: "passive_shield_on_enemy_striker_turned";
			amount: number;
	  }
	// applies to all damage sources; scoping to moves only is a known approximation
	| {
			type: "passive_negate_damage_percent";
			percent: number;
	  }
	// added once per effect resolution; skipped when unblockable or cannotBeMultiplied
	| {
			type: "passive_flat_damage_bonus";
			amount: number;
	  }
	| {
			type: "passive_disable_all_crew_skills";
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
	// blocks strike targeting while hp > 50; strike fizzles, no crew turn; does not affect other damage
	| {
			type: "passive_block_strikes_above_half_hp";
	  }
	// suppresses enemy turnedEffects on face-up; resolved structurally, not via effect dispatch; type exists for declaration
	| {
			type: "passive_suppress_enemy_turned_effects";
	  }
	// resolved structurally in discardFromHand; type exists for declaration
	| {
			type: "passive_shield_on_discard";
	  }
	// triggers once per turn when hand becomes empty; flag resets at startTurn
	| {
			type: "passive_draw_on_hand_empty_once_per_turn";
			amount: number;
	  }
	| {
			type: "passive_unturn_self_on_first_successful_challenge_call";
	  }
	| {
			type: "passive_optional_strike_on_successful_challenge";
	  }
	| {
			type: "win_if_void_pieces_assembled";
			requiredPieceIds: readonly string[];
	  }
	| { type: "become_also_striker" }
	| { type: "become_also_turner" }
	| { type: "transform_andrew_into_wolfman" }
	// also disables class identity until crew turns face-down
	| {
			type: "disable_target_crew_passive";
			targetSlot?: number;
	  }
	| {
			type: "passive_reduce_all_move_costs";
			reduction: number;
	  }
	// only reduces burst move costs; summed independently with reduce_all_move_costs
	| {
			type: "passive_reduce_burst_move_costs";
			reduction: number;
	  }
	// surcharge read live from this player via getEnemies, not accumulated on target
	| {
			type: "passive_increase_enemy_move_costs";
			amount: number;
	  }
	// once per turn across damage taken or crew turned triggers; shared cap
	| {
			type: "passive_cash_on_damage_taken_or_crew_turned";
			amount: number;
	  }
	| {
			type: "give_ally_cash_then_optional_unturn";
			cashAmount: number;
	  }
	| {
			type: "discard_then_reactivate_ally_turned_effect";
			discardCost: number;
	  }
	| {
			type: "mutual_discard_hand_then_redraw_same_count";
	  }
	// round-scoped; resets via prankCallBonusUsedThisRound
	| {
			type: "passive_bonus_cash_on_first_bluff_per_round";
			amount: number;
	  }
	| {
			type: "passive_team_cash_on_ally_collect";
			amount: number;
	  }
	| {
			type: "passive_mirror_enemy_collect_cash";
	  };

// wraps a condition and a primitive; negated means fire when condition is false
export type EffectCondition =
	| { when: "always" }
	| { when: "another_ally_is_turned" }
	| { when: "has_turned_ally_crew_this_game" }
	| { when: "ally_class_is_turned"; class: CrewClass }
	| { when: "has_shielded_boss" }
	| { when: "void_pieces_assembled" };

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
		commandEffects: [{ type: "peek_enemy_hand_then_gain_cash", cashGain: 3 }],
		passiveEffects: [{ type: "passive_watcher_unturn_on_challenge_win" }],
	},
	"the-dealer": {
		commandEffects: [{ type: "command_replace_crew_from_reserve" }],
		passiveEffects: [{ type: "passive_draw_per_turn", amount: 1 }],
	},
	"the-razor": {
		commandEffects: [{ type: "command_guess_crew_class_turn_if_correct" }],
		passiveEffects: [{ type: "passive_flat_damage_bonus", amount: 5 }],
	},
	"the-bastion": {
		commandEffects: [
			{
				type: "command_gain_shield_then_deal_damage_equal_to_shield",
				shieldAmount: 20,
			},
		],
		passiveEffects: [
			{ type: "passive_cash_on_damage_taken_or_crew_turned", amount: 1 },
		],
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
		turnedEffects: [{ type: "deal_damage", target: "enemy_boss", amount: 25 }],
		passiveEffects: [],
	},
	shrike: {
		turnedEffects: [
			{ type: "strike_enemy_crew_unblockable_with_cash_cost", cashCost: 3 },
		],
		passiveEffects: [],
	},
	"g-rone": {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_poison_per_round", damagePerRound: 10 }],
	},
	"monkey-man": {
		turnedEffects: [
			{ type: "discard_all_enemy_hand" },
			{ type: "deal_damage_per_enemy_hand_discarded", damagePerCard: 5 },
		],
		passiveEffects: [],
	},
	"berto-lopez": {
		turnedEffects: [
			{
				type: "deal_damage_per_face_up_ally",
				target: "enemy_boss",
				amountPerAlly: 15,
			},
		],
		passiveEffects: [],
	},
	"hot-girl": {
		turnedEffects: [
			{
				type: "deal_damage_percent_current_hp",
				target: "enemy_boss",
				percent: 30,
				cannotBeMultiplied: true,
			},
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
				baseAmount: 5,
				reducedAmount: 1,
			},
			{ type: "strike_enemy_crew", unblockable: true },
		],
		passiveEffects: [],
	},
	"rilla-gorilla": {
		turnedEffects: [{ type: "shield_boss", amount: 30 }],
		passiveEffects: [],
	},
	frontline: {
		turnedEffects: [{ type: "immunity_until_next_turn", turns: 2 }],
		passiveEffects: [],
	},
	"mama-mercy": {
		turnedEffects: [],
		passiveEffects: [
			{ type: "passive_shield_on_enemy_striker_turned", amount: 40 },
		],
	},
	lighthouse: {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_suppress_enemy_turned_effects" }],
	},
	glob: {
		turnedEffects: [
			when({ when: "has_shielded_boss" }, { type: "shield_boss", amount: 40 }),
		],
		passiveEffects: [],
	},
	silencer: {
		turnedEffects: [{ type: "disable_target_crew_passive" }],
		passiveEffects: [],
	},
	"doctor-norman": {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_shield_on_discard" }],
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
		turnedEffects: [{ type: "steal_cash", amount: 1 }],
		passiveEffects: [
			{ type: "passive_unturn_self_on_first_successful_challenge_call" },
		],
	},
	"claw-machine": {
		turnedEffects: [{ type: "draw_cards", amount: 2 }],
		passiveEffects: [],
	},
	cristatella: {
		turnedEffects: [],
		passiveEffects: [{ type: "become_also_turner" }],
	},
	"cool-guy": {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_heal_on_move_played", amount: 5 }],
	},
	belladonna: {
		turnedEffects: [
			{ type: "heal_boss", amount: 10 },
			{ type: "gain_cash", amount: 1 },
			{ type: "draw_cards", amount: 1 },
		],
		passiveEffects: [],
	},
	"vanessa-de-vera": {
		turnedEffects: [],
		passiveEffects: [
			{ type: "passive_draw_on_hand_empty_once_per_turn", amount: 3 },
		],
	},
	"bear-bones": {
		turnedEffects: [],
		passiveEffects: [
			{ type: "passive_optional_strike_on_successful_challenge" },
		],
	},
	handles: {
		turnedEffects: [
			// only turn back down when other ally is not face-up
			when({ when: "another_ally_is_turned" }, { type: "unturn_self" }, true),
		],
		passiveEffects: [],
	},
	hider: {
		turnedEffects: [
			when(
				{ when: "another_ally_is_turned" },
				{ type: "unturn_other_ally_crew" },
			),
		],
		passiveEffects: [],
	},
	terminal: {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_block_strikes_above_half_hp" }],
	},
	suplex: {
		turnedEffects: [
			when(
				{ when: "has_turned_ally_crew_this_game" },
				{ type: "strike_enemy_crew" },
			),
		],
		passiveEffects: [],
	},
	retro: {
		turnedEffects: [
			{
				type: "search_deck_for_card_add_to_hand",
				cardId: "chronotrix",
				costOverride: 4,
			},
		],
		passiveEffects: [],
	},
	andrew: {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_draw_per_turn", amount: 1 }],
	},
	zednem: {
		turnedEffects: [{ type: "draw_cards", amount: 1 }],
		passiveEffects: [{ type: "passive_reduce_burst_move_costs", reduction: 1 }],
	},
	keeper: {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_increase_enemy_move_costs", amount: 1 }],
	},
	wolfman: {
		turnedEffects: [{ type: "deal_damage", target: "enemy_boss", amount: 50 }],
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
		effects: [{ type: "passive_cash_per_turn", amount: 1 }],
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
			{ type: "passive_bonus_cash_on_first_bluff_per_round", amount: 3 },
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
		effects: [{ type: "passive_shield_per_turn", amount: 5 }],
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
				{ when: "ally_class_is_turned", class: "blocker" },
				{ type: "passive_shield_per_turn", amount: 10 },
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
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 30 }],
	},
	ambush: {
		effects: [{ type: "strike_enemy_crew_blockable" }],
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
		effects: [{ type: "shield_boss", amount: 10 }],
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
				drawAmount: 3,
			},
		],
	},
	"cheap-labor": {
		effects: [
			{ type: "draw_cards", amount: 1 },
			{ type: "gain_cash", amount: 3 },
		],
	},
	"coordinated-strike": {
		effects: [
			when(
				{ when: "ally_class_is_turned", class: "striker" },
				{ type: "deal_damage", target: "enemy_boss", amount: 25 },
			),
			when(
				{ when: "ally_class_is_turned", class: "striker" },
				{ type: "deal_damage", target: "enemy_boss", amount: 15 },
				true,
			),
		],
	},
	ratatatat: {
		effects: [{ type: "deal_damage_ignore_shield", amount: 20 }],
	},
	"dig-deep": {
		effects: [
			{ type: "look_at_top_deck_draw_one", lookCount: 5, drawCount: 2 },
		],
	},
	reinforcements: {
		effects: [
			{ type: "shield_boss", amount: 15 },
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
		effects: [{ type: "give_ally_cash_then_optional_unturn", cashAmount: 2 }],
	},
	"full-moon": {
		effects: [{ type: "transform_andrew_into_wolfman" }],
	},
	"scorched-earth": {
		effects: [{ type: "discard_all_actives_all_players" }],
	},
	"triangle-of-trust": {
		effects: [{ type: "discard_one_draw_three" }],
	},
	"heel-turn": {
		effects: [{ type: "unturn_ally_crew" }],
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
		effects: [{ type: "unturn_then_retrigger_ally" }],
	},
	"cash-out": {
		effects: [
			{ type: "discard_cards_from_hand", amount: 2 },
			{ type: "gain_cash", amount: 2 },
		],
	},
	"switch-up": {
		effects: [{ type: "unturn_one_turn_different_ally" }],
	},
	"tag-out": {
		effects: [{ type: "swap_crew_with_teammate" }],
	},
	"take-it-back": {
		effects: [{ type: "return_one_from_discard_to_hand" }],
	},
	"spare-change": {
		effects: [{ type: "gain_cash", amount: 2 }],
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
				{ when: "ally_class_is_turned", class: "collector" },
				{ type: "strike_enemy_crew", unblockable: true },
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
			{ type: "remove_all_shields", target: "enemy_boss" },
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
			{ type: "redistribute_cash_to_poorest", cashAmount: 5, drawAmount: 1 },
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

export function isDraftable(crew: CrewCard): boolean {
	return crew.draftable !== false;
}

export type MoveTargetScope = "enemy" | "ally" | "none";

// target scope derived from effects so validation is generic
// when effects are mixed, enemy scope takes priority as the stricter default
export function getMoveTargetScope(move: MoveCard): MoveTargetScope {
	const ENEMY_SCOPED_TYPES = new Set<EffectPrimitive["type"]>([
		"deal_damage",
		"deal_damage_per_face_up_ally",
		"deal_damage_percent_current_hp",
		"deal_damage_ignore_shield",
		"deal_damage_per_discarded_variable",
		"deal_damage_per_enemy_hand_discarded",
		"strike_enemy_crew",
		"strike_enemy_crew_unblockable_with_cash_cost",
		"strike_enemy_crew_blockable",
		"turn_enemy_crew",
		"steal_cash",
		"discard_all_enemy_hand",
		"peek_enemy_hand_then_gain_cash",
		"peek_two_random_enemy_cards_discard_one",
		"reveal_enemy_crew_class",
		"remove_all_shields",
		"set_both_cash_zero_then_draw",
		"mutual_discard_hand_then_redraw_same_count",
		"passive_mirror_enemy_collect_cash",
	]);

	const ALLY_SCOPED_TYPES = new Set<EffectPrimitive["type"]>([
		"heal_boss",
		"shield_boss",
		"set_ally_boss_hp_gain_cash_draw",
		"give_ally_cash_then_optional_unturn",
		"swap_crew_with_teammate",
		"passive_life_insurance",
	]);

	let sawEnemy = false;
	let sawAlly = false;

	for (const e of move.effects) {
		const eff = unwrapEffect(e);
		if (ENEMY_SCOPED_TYPES.has(eff.type)) sawEnemy = true;
		if (ALLY_SCOPED_TYPES.has(eff.type)) sawAlly = true;
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
		// strikers
		PEKTUS: "pektus",
		SHRIKE: "shrike",
		G_RONE: "g-rone",
		MONKEY_MAN: "monkey-man",
		BERTO_LOPEZ: "berto-lopez",
		HOT_GIRL: "hot-girl",
		BLACK_FIST: "black-fist",
		WHISPER: "whisper",
		// blockers
		RILLA_GORILLA: "rilla-gorilla",
		FRONTLINE: "frontline",
		MAMA_MERCY: "mama-mercy",
		LIGHTHOUSE: "lighthouse",
		GLOB: "glob",
		SILENCER: "silencer",
		DOCTOR_NORMAN: "doctor-norman",
		LOTUS: "lotus",
		// collectors
		MAYUMI: "mayumi",
		TOO_BIG: "too-big",
		CLAW_MACHINE: "claw-machine",
		CRISTATELLA: "cristatella",
		COOL_GUY: "cool-guy",
		BELLADONNA: "belladonna",
		VANESSA_DE_VERA: "vanessa-de-vera",
		BEAR_BONES: "bear-bones",
		// turners
		HANDLES: "handles",
		HIDER: "hider",
		TERMINAL: "terminal",
		SUPLEX: "suplex",
		RETRO: "retro",
		ANDREW: "andrew",
		ZEDNEM: "zednem",
		KEEPER: "keeper",
		// undraftable
		WOLFMAN: "wolfman",
	},
	MOVE: {
		// active
		POISON_BREATH: "poison-breath",
		SIDE_HUSTLE: "side-hustle",
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
		// burst
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
		// slow
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
	},
} as const;

export const VOID_PIECE_IDS = [
	CARD_IDS.MOVE.VOID_ARMS,
	CARD_IDS.MOVE.VOID_LEGS,
	CARD_IDS.MOVE.VOID_TORSO,
] as const;