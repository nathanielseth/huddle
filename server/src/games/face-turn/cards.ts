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
	// damage
	| {
			type: "deal_damage";
			target: "enemy_boss";
			amount: number;
			unblockable?: boolean;
			cannotBeMultiplied?: boolean;
	  }
	// counts all face-up ally crew at resolution, includes self
	| {
			type: "deal_damage_per_face_up_ally";
			target: "enemy_boss";
			amountPerAlly: number;
	  }
	// percent of target boss's current hp
	| {
			type: "deal_damage_percent_current_hp";
			target: "enemy_boss";
			percent: number;
			cannotBeMultiplied?: boolean;
	  }
	// bypasses shield only; still respects immunity and reduction
	| {
			type: "deal_damage_ignore_shield";
			amount: number;
	  }
	// player picks how many cards to discard, no maximum
	// damage = discarded count * damagePerCard
	| {
			type: "deal_damage_per_discarded_variable";
			damagePerCard: number;
	  }
	// monkey-man: damage = (cards just discarded from the enemy's hand by
	// the immediately preceding discard_all_enemy_hand primitive in this
	// same effects array) * damagePerCard
	| {
			type: "deal_damage_per_enemy_hand_discarded";
			damagePerCard: number;
	  }

	// strikes
	// attacker chooses which crew to turn, unless defender has void arms,
	// then defender chooses. enforced in strike resolver.
	// unblockable bypasses block entirely (whisper, unfinished business)
	| {
			type: "strike_enemy_crew";
			unblockable?: boolean;
	  }
	// unblockable strike with a cash gate; fizzles if cash insufficient
	| {
			type: "strike_enemy_crew_unblockable_with_cash_cost";
			cashCost: number;
	  }
	// burst move that opens a block window, not a challenge window
	// no challenge phase. if not blocked, strike resolves normally.
	| {
			type: "strike_enemy_crew_blockable";
	  }

	// crew face-up / face-down manipulation
	| { type: "turn_enemy_crew"; targetSlot?: number }
	| { type: "turn_ally_crew"; targetSlot?: number }
	// used by terminal: turn all other ally crew face-up
	| {
			type: "turn_all_other_ally_crew";
	  }
	| { type: "unturn_ally_crew"; targetSlot?: number }
	// mandatory; targets the slot hider is not in
	// only fires when the other ally slot is face-up
	| {
			type: "unturn_other_ally_crew";
	  }
	// pull counter: unturn an ally crew, then immediately turn it
	// face-up to retrigger its turned effect
	| {
			type: "unturn_then_retrigger_ally";
	  }
	// switch up: turn one ally crew face-down and a different one
	// face-up. requires at least one face-up and one face-down crew
	| {
			type: "unturn_one_turn_different_ally";
	  }
	// handles: if the other ally is face-up, prompts the player to
	// optionally unturn one face-up ally crew. only fires when the
	// condition 'another_ally_is_turned' is true. opens a real
	// handles_unturn_offer interaction
	| {
			type: "offer_optional_ally_unturn_choice";
	  }
	// tag out: swap one of your crew with a teammate's. teams mode
	// only, fizzles in duel/ffa. preserves face-up state; does not
	// trigger turned effects
	| {
			type: "swap_crew_with_teammate";
	  }

	// card draw / discard / return
	| { type: "draw_cards"; amount: number }
	| { type: "discard_cards_from_hand"; amount: number }
	| { type: "discard_all_enemy_hand" }
	| { type: "discard_all_actives_all_players" }
	// fizzles entirely if hand is empty; used by triangle of trust
	| {
			type: "discard_one_draw_three";
	  }
	// whisper: discard amount depends on whether the actor has
	// successfully called a bluff this game
	| {
			type: "discard_variable_by_bluff_flag";
			baseAmount: number;
			reducedAmount: number;
	  }
	// fresh start: checks hand length after this card is removed.
	// if hand was empty, draws bonusAmount instead of baseAmount
	| {
			type: "draw_cards_or_more_if_hand_was_empty";
			baseAmount: number;
			bonusAmount: number;
	  }
	// take it back: return 1 card from discard pile to hand
	| {
			type: "return_one_from_discard_to_hand";
	  }
	// full moon: return discards to hand until at hand_limit; cards at normal cost
	| {
			type: "return_discards_to_hand_until_full";
	  }
	// wolfman: search deck for a specific card, add to hand at 0 cost,
	// shuffle. fizzles if already in hand or not in deck
	| {
			type: "search_deck_for_card_add_to_hand";
			cardId: string;
	  }
	// dig deep: look at top N cards, draw drawCount
	| {
			type: "look_at_top_deck_draw_one";
			lookCount: number;
			drawCount?: number;
	  }

	// cash gain / loss
	| { type: "gain_cash"; amount: number }
	| { type: "steal_cash"; amount: number }
	// mass layoff: set both actor and target cash to 0, then draw
	| {
			type: "set_both_cash_zero_then_draw";
			drawAmount: number;
	  }

	// boss hp / shield / immunity
	| { type: "heal_boss"; amount: number }
	| { type: "shield_boss"; amount: number }
	| { type: "remove_all_shields"; target: "enemy_boss" | "ally_boss" }
	// immunity uses the shared bossImmunityTurns counter, an approximation
	| {
			type: "immunity_until_next_turn";
			turns?: number;
	  }
	// all-in: set ally boss hp to exactly 1, then gain cash and draw.
	// hp is set before draw
	| {
			type: "set_ally_boss_hp_gain_cash_draw";
			hpAmount: number;
			cashGain: number;
			drawAmount: number;
	  }

	// read / peek
	// peek at opponent's hand, then gain cash. implemented as a one-shot
	// reveal via ctx.state.watcherReveal, not a pending_interaction
	| {
			type: "peek_enemy_hand_then_gain_cash";
			cashGain: number;
	  }
	// peek 2 random cards from opponent's hand, discard 1 (actor chooses)
	| {
			type: "peek_two_random_enemy_cards_discard_one";
	  }
	// truth serum: force opponent to reveal class of one face-down crew
	| {
			type: "reveal_enemy_crew_class";
	  }

	// boss commands
	// declare the class of a face-down enemy crew; if correct, turn it face-up
	| {
			type: "command_guess_crew_class_turn_if_correct";
	  }
	// replace a face-up ally crew with the player's reserved (draft-time)
	| {
			type: "command_replace_crew_from_reserve";
	  }

	// negate / reflect
	| {
			type: "negate_enemy_slow_move";
	  }
	// reflect base damage of a slow move back at its caster. reverse card
	// itself is a slow move and can be nope!'d.
	| {
			type: "reflect_slow_move_base_damage";
	  }

	// passives
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
	// void legs: interactive discard choice, not automatic
	| {
			type: "passive_optional_discard_for_damage_per_turn";
			discardCost: number;
			damage: number;
	  }
	// on winning a challenge (opponent challenged and was wrong), may unturn
	// one face-up ally crew
	| {
			type: "passive_watcher_unturn_on_challenge_win";
	  }
	// mama mercy: event-based trigger, not per-round accumulation
	| {
			type: "passive_shield_on_enemy_striker_turned";
			amount: number;
	  }
	// currently applies to all damage sources; scoping to moves only is a
	// known approximation
	| {
			type: "passive_negate_damage_percent";
			percent: number;
	  }
	| {
			type: "passive_damage_multiplier";
			multiplier: number;
	  }
	| {
			type: "passive_block_cost_reduction";
			reduction: number;
	  }
	| {
			type: "passive_disable_all_crew_skills";
	  }
	// void arms: when opponent would pick which of your face-down crew to
	// turn, you choose instead. flips the default
	| {
			type: "passive_defender_chooses_crew_to_turn";
	  }
	// background check: before opponent's challenge resolves, they must
	// guess class of a face-down crew. if wrong, one of their crew turns
	| {
			type: "passive_background_check";
	  }
	// life insurance: first time ally boss would reach 0 hp, stay at 1
	// instead, then discard this active
	| {
			type: "passive_life_insurance";
	  }
	// false flag: when you would turn a crew face-up from failing a
	// challenge, prevent that effect and discard this active instead.
	// challenger still gets credit
	| {
			type: "passive_false_flag";
	  }
	// boss cannot be targeted by a strike (class-action or card-driven) or
	// by face turn while hp is above 50. if active, the entire strike
	// attempt fizzles, no crew turn, no execute. does not affect any other
	// damage source
	| {
			type: "passive_block_strikes_above_half_hp";
	  }
	// doctor norman: one-time trigger on exactly the Nth discard.
	// fires immediately
	| {
			type: "passive_full_heal_on_sixth_discard_once";
	  }
	// vanessa de vera: first time hand becomes empty each turn, draw.
	// per-turn flag resets at startTurn
	| {
			type: "passive_draw_on_hand_empty_once_per_turn";
			amount: number;
	  }
	// too big passive: once per game, when you successfully call a bluff,
	// may turn this crew face-down
	| {
			type: "passive_unturn_self_on_first_successful_challenge_call";
	  }
	// bear bones: whenever you successfully challenge, may strike one
	// face-down enemy crew
	| {
			type: "passive_optional_strike_on_successful_challenge";
	  }

	// win cons
	// deleb-i: win immediately if all three void piece active cards are in
	// the active zone
	| {
			type: "win_if_void_pieces_assembled";
			requiredPieceIds: readonly string[];
	  }

	// class multi-type grants
	| { type: "become_also_striker" }
	| { type: "become_also_turner" }
	| { type: "transform_jeremy_into_berserker" }

	// new required primitives
	// lighthouse turned: disable target crew passive until that crew
	// turns face-down. works on ally or enemy; clears on unturn
	| {
			type: "disable_target_crew_passive";
			targetSlot?: number;
	  }
	| {
			type: "passive_reduce_all_move_costs";
			reduction: number;
	  }
	// tactical support: target ally gains cash, then actor may optionally
	// unturn one of that ally's face-up crew
	| {
			type: "give_ally_cash_then_optional_unturn";
			cashAmount: number;
	  }
	// neeto's clock: discard cards, then retrigger a face-up ally crew's
	// turned effect
	| {
			type: "discard_then_reactivate_ally_turned_effect";
			discardCost: number;
	  }
	// wheel of fortune: both actor and target discard hands, then redraw
	// same count independently
	| {
			type: "mutual_discard_hand_then_redraw_same_count";
	  }
	// prank call: first bluff class action each round grants cash.
	// round-scoped — resets via prankCallBonusUsedThisRound
	| {
			type: "passive_bonus_cash_on_first_bluff_per_round";
			amount: number;
	  }
	// supply drop: whenever any collector class action resolves on the
	// team, every team member gains cash
	| {
			type: "passive_team_cash_on_ally_collect";
			amount: number;
	  }
	// trickle-down economics: whenever a target opponent's Collector class
	// action resolves, gain cash equal to the amount they just gained
	| {
			type: "passive_mirror_enemy_collect_cash";
	  };

// effect conditions - gate whether a primitive fires
// a ConditionalEffect wraps a condition, an effect, and an optional
// negated flag (condition must be false to fire)

export type EffectCondition =
	| { when: "always" }
	| { when: "another_ally_is_turned" } // other ally slot is face-up
	| { when: "has_turned_ally_crew_this_game" } // permanent flag set in turnCrewAtSlot
	| { when: "ally_class_is_turned"; class: CrewClass } // any ally of `class` face-up (self or teammate)
	| { when: "has_shielded_boss" } // boss has shield > 0
	| { when: "void_pieces_assembled" }; // all three void active cards present

export interface ConditionalEffect {
	readonly condition: EffectCondition;
	readonly effect: EffectPrimitive;
	// when true, the condition must be FALSE for the effect to fire
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

// card interfaces

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

// bosses

const BOSS_MECHANICS: Record<
	string,
	Pick<BossCard, "commandEffects" | "passiveEffects">
> = {
	"the-watcher": {
		commandEffects: [{ type: "peek_enemy_hand_then_gain_cash", cashGain: 2 }],
		passiveEffects: [{ type: "passive_watcher_unturn_on_challenge_win" }],
	},
	"the-dealer": {
		commandEffects: [{ type: "command_replace_crew_from_reserve" }],
		passiveEffects: [{ type: "passive_draw_per_turn", amount: 2 }],
	},
	"the-razor": {
		commandEffects: [{ type: "command_guess_crew_class_turn_if_correct" }],
		passiveEffects: [{ type: "passive_damage_multiplier", multiplier: 1.3 }],
	},
};

export const BOSSES: readonly BossCard[] = BOSS_DISPLAY.map((display) => ({
	...display,
	...BOSS_MECHANICS[display.id]!,
}));

// crew

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
			{ type: "discard_cards_from_hand", amount: 3 },
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
		turnedEffects: [{ type: "shield_boss", amount: 40 }],
		passiveEffects: [],
	},
	frontline: {
		turnedEffects: [{ type: "immunity_until_next_turn", turns: 2 }],
		passiveEffects: [],
	},
	"mama-mercy": {
		turnedEffects: [],
		passiveEffects: [
			{ type: "passive_shield_on_enemy_striker_turned", amount: 50 },
		],
	},
	lighthouse: {
		turnedEffects: [{ type: "disable_target_crew_passive" }],
		passiveEffects: [],
	},
	glob: {
		turnedEffects: [
			when({ when: "has_shielded_boss" }, { type: "shield_boss", amount: 50 }),
		],
		passiveEffects: [],
	},
	silencer: {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_negate_damage_percent", percent: 40 }],
	},
	"doctor-norman": {
		turnedEffects: [],
		passiveEffects: [{ type: "passive_full_heal_on_sixth_discard_once" }],
	},
	lotus: {
		turnedEffects: [{ type: "become_also_striker" }],
		passiveEffects: [],
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
		turnedEffects: [{ type: "become_also_turner" }],
		passiveEffects: [],
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
			when(
				{ when: "another_ally_is_turned" },
				{ type: "offer_optional_ally_unturn_choice" },
			),
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
	wolfman: {
		turnedEffects: [
			{ type: "search_deck_for_card_add_to_hand", cardId: "full-moon" },
		],
		passiveEffects: [],
	},
	jeremy: {
		turnedEffects: [],
		passiveEffects: [],
	},
	berserker: {
		turnedEffects: [{ type: "deal_damage", target: "enemy_boss", amount: 50 }],
		passiveEffects: [],
	},
};

export const CREW: readonly CrewCard[] = CREW_DISPLAY.map((display) => ({
	...display,
	...CREW_MECHANICS[display.id]!,
}));

// moves

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
			{ type: "passive_bonus_cash_on_first_bluff_per_round", amount: 2 },
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
				{ type: "passive_shield_per_turn", amount: 15 },
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
	"full-moon": {
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
			{ type: "shield_boss", amount: 20 },
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
	"rage-serum": {
		effects: [{ type: "transform_jeremy_into_berserker" }],
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
};

export const MOVES: readonly MoveCard[] = MOVE_DISPLAY.map((display) => ({
	...display,
	...MOVE_MECHANICS[display.id]!,
}));

// lookup maps

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

// target scope derivation

export type MoveTargetScope = "enemy" | "ally" | "none";

// derives a move's target scope from its effect primitives, so the
// targetPlayerId validation can be done generically without a per-card id
// list. a move is "ally" scope if any effect targets an ally (self or
// teammate); "enemy" scope if any effect requires an enemy target; "none"
// otherwise.
//
// a move should never mix enemy-targeting and ally-targeting primitives.
// if one were added by mistake, this function treats "enemy" as taking
// priority, because enemy-only validation is the stricter default.
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
		"remove_all_shields", // only when target: "enemy_boss"
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
		WOLFMAN: "wolfman",
		JEREMY: "jeremy",
		// undraftable
		BERSERKER: "berserker",
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
		FULL_MOON: "full-moon",
		ALL_IN: "all-in",
		CHEAP_LABOR: "cheap-labor",
		COORDINATED_STRIKE: "coordinated-strike",
		RATATATAT: "ratatatat",
		DIG_DEEP: "dig-deep",
		REINFORCEMENTS: "reinforcements",
		EMPTY_THE_CLIP: "empty-the-clip",
		FRESH_START: "fresh-start",
		TACTICAL_SUPPORT: "tactical-support",
		RAGE_SERUM: "rage-serum",
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
	},
} as const;

export const VOID_PIECE_IDS = [
	CARD_IDS.MOVE.VOID_ARMS,
	CARD_IDS.MOVE.VOID_LEGS,
	CARD_IDS.MOVE.VOID_TORSO,
] as const;