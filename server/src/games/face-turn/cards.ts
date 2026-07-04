import type { CrewClass, MoveType } from "../../../../shared/games/face-turn";

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

export interface BossCard {
	readonly id: string;
	readonly name: string;
	readonly effectText: {
		readonly faceTurn: string;
		readonly command: string;
		readonly passive: string;
	};
	readonly flavorText: string;
	readonly maxHp: number;
	readonly faceTurnCost: number;
	readonly commandEffects: readonly CardEffect[];
	readonly passiveEffects: readonly CardEffect[];
	readonly draftable?: boolean;
	readonly hasCustomCommandLogic?: true;
}

export interface CrewCard {
	readonly id: string;
	readonly name: string;
	readonly class: CrewClass;
	readonly effectText: {
		readonly turned?: string;
		readonly passive?: string;
	};
	readonly flavorText: string;
	readonly turnedEffects: readonly CardEffect[]; // fires immediately when this crew turns face-up
	readonly passiveEffects: readonly CardEffect[]; // active while this crew is face-up
	readonly draftable?: boolean;
}

export interface MoveCard {
	readonly id: string;
	readonly name: string;
	readonly baseCost: number;
	readonly moveType: MoveType;
	readonly effectText: string;
	readonly flavorText: string;
	readonly effects: readonly CardEffect[];
}

// bosses

export const BOSSES: readonly BossCard[] = [
	{
		id: "the-watcher",
		name: "The Watcher",
		effectText: {
			faceTurn:
				"Pay 7 Cash: unblockable, unchallengeable strike against target enemy Crew. If they have no face-down Crew, executes their Boss instead.",
			command: "Look at target opponent's hand, then gain 2 Cash.",
			passive:
				"Whenever you win a challenge, you may turn one face-up ally Crew face-down.",
		},
		flavorText: "",
		maxHp: 100,
		faceTurnCost: 7,
		commandEffects: [{ type: "peek_enemy_hand_then_gain_cash", cashGain: 2 }],
		passiveEffects: [
			// fires when the watcher's owner successfully defends a class action
			{ type: "passive_watcher_unturn_on_challenge_win" },
		],
	},
	{
		id: "the-dealer",
		name: "The Dealer",
		effectText: {
			faceTurn:
				"Pay 7 Cash: unblockable, unchallengeable strike against target enemy Crew. If they have no face-down Crew, executes their Boss instead.",
			command:
				"Replace one face-up ally Crew with your reserved Crew (drafted alongside your other two). The new Crew enters face-down.",
			passive: "Draw 2 cards at the start of your turn.",
		},
		flavorText: "",
		maxHp: 100,
		faceTurnCost: 7,
		commandEffects: [{ type: "command_replace_crew_from_reserve" }],
		passiveEffects: [{ type: "passive_draw_per_turn", amount: 2 }],
		hasCustomCommandLogic: true,
	},
	{
		id: "the-razor",
		name: "The Razor",
		effectText: {
			faceTurn:
				"Pay 7 Cash: unblockable, unchallengeable strike against target enemy Crew. If they have no face-down Crew, executes their Boss instead.",
			command:
				"Declare the class of one face-down enemy Crew. If correct, turn it face-up.",
			passive: "You deal 30% more damage.",
		},
		flavorText: "",
		maxHp: 100,
		faceTurnCost: 7,
		commandEffects: [{ type: "command_guess_crew_class_turn_if_correct" }],
		passiveEffects: [{ type: "passive_damage_multiplier", multiplier: 1.3 }],
		hasCustomCommandLogic: true,
	},
];

// crew

export const CREW: readonly CrewCard[] = [
	// strikers
	{
		id: "pektus",
		name: "Pektus",
		class: "striker",
		effectText: { turned: "Deal 25 damage to target enemy Boss." },
		flavorText: "",
		turnedEffects: [{ type: "deal_damage", target: "enemy_boss", amount: 25 }],
		passiveEffects: [],
	},
	{
		id: "shrike",
		name: "Shrike",
		class: "striker",
		effectText: {
			turned:
				"Pay 3 Cash to strike target enemy Crew (unblockable). If they have no face-down Crew, this executes their Boss instead.",
		},
		flavorText: "",
		turnedEffects: [
			// cash cost deducted before strike; fizzles if <3 cash
			{ type: "strike_enemy_crew_unblockable_with_cash_cost", cashCost: 3 },
		],
		passiveEffects: [],
	},
	{
		id: "g-rone",
		name: "G-Rone",
		class: "striker",
		effectText: {
			passive: "At the end of each round, deal 10 damage to target enemy Boss.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [{ type: "passive_poison_per_round", damagePerRound: 10 }],
	},
	{
		id: "monkey-man",
		name: "Monkey-Man",
		class: "striker",
		effectText: {
			turned:
				"Target opponent discards their entire hand. Deal 5 damage to target enemy Boss for each card discarded this way.",
		},
		flavorText: "",
		turnedEffects: [
			{ type: "discard_all_enemy_hand" },
			{ type: "deal_damage_per_enemy_hand_discarded", damagePerCard: 5 },
		],
		passiveEffects: [],
	},
	{
		id: "berto-lopez",
		name: "Berto Lopez",
		class: "striker",
		effectText: {
			turned: "Deal 15 damage to target enemy Boss for each face-up ally Crew.",
		},
		flavorText: "",
		turnedEffects: [
			// counts all face-up ally crew at resolution (includes self if already turned)
			{
				type: "deal_damage_per_face_up_ally",
				target: "enemy_boss",
				amountPerAlly: 15,
			},
		],
		passiveEffects: [],
	},
	{
		id: "hot-girl",
		name: "Hot Girl",
		class: "striker",
		effectText: {
			turned: "Deal damage equal to 30% of target enemy Boss's current HP.",
		},
		flavorText: "",
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
	{
		id: "black-fist",
		name: "Black Fist",
		class: "striker",
		effectText: {
			turned:
				"Discard 3 cards from your hand. If you do, deal 35 damage to target enemy Boss.",
		},
		flavorText: "",
		turnedEffects: [
			// only deals damage if 3 cards were actually discarded
			{ type: "discard_cards_from_hand", amount: 3 },
			{ type: "deal_damage", target: "enemy_boss", amount: 35 },
		],
		passiveEffects: [],
	},
	{
		id: "whisper",
		name: "Whisper",
		class: "striker",
		effectText: {
			turned:
				"Discard 5 cards from your hand, then strike target enemy Crew (unblockable; executes their Boss if they have no face-down Crew). If you have successfully called a bluff this game, discard 1 card instead.",
		},
		flavorText: "",
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

	// blockers

	{
		id: "rilla-gorilla",
		name: "Rilla Gorilla",
		class: "blocker",
		effectText: { turned: "Give 40 Shield to target ally Boss." },
		flavorText: "",
		turnedEffects: [{ type: "shield_boss", amount: 40 }],
		passiveEffects: [],
	},
	{
		id: "frontline",
		name: "Frontline",
		class: "blocker",
		effectText: {
			turned:
				"Target ally Boss is immune to damage until the start of your next 2 turns.",
		},
		flavorText: "",
		turnedEffects: [{ type: "immunity_until_next_turn", turns: 2 }],
		passiveEffects: [],
	},
	{
		id: "mama-mercy",
		name: "Mama Mercy",
		class: "blocker",
		effectText: {
			passive:
				"Whenever an enemy Striker turns face-up, give 50 Shield to target ally Boss.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [
			// event-based: fires when any striker turns face-up
			{ type: "passive_shield_on_enemy_striker_turned", amount: 50 },
		],
	},
	{
		id: "lighthouse",
		name: "Lighthouse",
		class: "blocker",
		effectText: {
			turned: "Disable 2 target Crew's Passives until each turns face-down.",
		},
		flavorText: "",
		turnedEffects: [{ type: "disable_target_crew_passive" }],
		passiveEffects: [],
	},
	{
		id: "glob",
		name: "Glob",
		class: "blocker",
		effectText: {
			turned: "If target ally Boss has any Shield, give it 50 more Shield.",
		},
		flavorText: "",
		turnedEffects: [
			when({ when: "has_shielded_boss" }, { type: "shield_boss", amount: 50 }),
		],
		passiveEffects: [],
	},
	{
		id: "silencer",
		name: "Silencer",
		class: "blocker",
		effectText: {
			passive:
				"Reduce all incoming damage to target ally Boss from enemy Moves by 40%.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [
			// applies to all damage sources; move-only scoping is a known approximation
			{ type: "passive_negate_damage_percent", percent: 40 },
		],
	},
	{
		id: "doctor-norman",
		name: "Doctor Norman",
		class: "blocker",
		effectText: {
			passive:
				"Whenever you discard your 4th card, heal target ally Boss to full HP.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [{ type: "passive_full_heal_on_sixth_discard_once" }],
	},
	{
		id: "lotus",
		name: "Lotus",
		class: "blocker",
		effectText: { turned: "This Crew is also treated as a Striker." },
		flavorText: "",
		turnedEffects: [{ type: "become_also_striker" }],
		passiveEffects: [],
	},

	// collectors

	{
		id: "mayumi",
		name: "Mayumi",
		class: "collector",
		effectText: { turned: "Gain 2 Cash and draw 1 card." },
		flavorText: "",
		turnedEffects: [
			{ type: "gain_cash", amount: 2 },
			{ type: "draw_cards", amount: 1 },
		],
		passiveEffects: [],
	},
	{
		id: "too-big",
		name: "Too Big",
		class: "collector",
		effectText: {
			turned: "Steal 1 Cash from target opponent.",
			passive:
				"Once per game, whenever you successfully call a bluff, you may turn this Crew face-down.",
		},
		flavorText: "",
		turnedEffects: [{ type: "steal_cash", amount: 1 }],
		passiveEffects: [
			// successfully call a bluff = hasCalledBluffSuccessfully (you challenged and they were bluffing)
			{ type: "passive_unturn_self_on_first_successful_challenge_call" },
		],
	},
	{
		id: "claw-machine",
		name: "Claw Machine",
		class: "collector",
		effectText: { turned: "Draw 2 cards." },
		flavorText: "",
		turnedEffects: [{ type: "draw_cards", amount: 2 }],
		passiveEffects: [],
	},
	{
		id: "cristatella",
		name: "Cristatella",
		class: "collector",
		effectText: { turned: "This Crew is also treated as a Turner." },
		flavorText: "",
		turnedEffects: [{ type: "become_also_turner" }],
		passiveEffects: [],
	},
	{
		id: "cool-guy",
		name: "Cool Guy",
		class: "collector",
		effectText: {
			passive: "Whenever you play a Move, heal target ally Boss for 5 HP.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [{ type: "passive_heal_on_move_played", amount: 5 }],
	},
	{
		id: "belladonna",
		name: "Belladonna",
		class: "collector",
		effectText: {
			turned: "Heal target ally Boss for 10 HP, gain 1 Cash, and draw 1 card.",
		},
		flavorText: "",
		turnedEffects: [
			{ type: "heal_boss", amount: 10 },
			{ type: "gain_cash", amount: 1 },
			{ type: "draw_cards", amount: 1 },
		],
		passiveEffects: [],
	},
	{
		id: "vanessa-de-vera",
		name: "Vanessa De Vera",
		class: "collector",
		effectText: {
			passive:
				"The first time your hand becomes empty each turn, draw 3 cards.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [
			// mid-turn trigger; flag resets at startTurn
			{ type: "passive_draw_on_hand_empty_once_per_turn", amount: 3 },
		],
	},
	{
		id: "bear-bones",
		name: "Bear Bones",
		class: "collector",
		effectText: {
			passive:
				"Whenever you successfully challenge an opponent, you may pay 1 Cash to strike one face-down enemy Crew.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [
			{ type: "passive_optional_strike_on_successful_challenge" },
		],
	},

	// turners

	{
		id: "handles",
		name: "Handles",
		class: "turner",
		effectText: {
			turned:
				"If your other ally Crew is face-up, you may turn one face-up ally Crew face-down.",
		},
		flavorText: "",
		turnedEffects: [
			// optional; opens a real handles_unturn_offer interaction
			// only fires when another ally crew is face-up
			when(
				{ when: "another_ally_is_turned" },
				{ type: "offer_optional_ally_unturn_choice" },
			),
		],
		passiveEffects: [],
	},
	{
		id: "hider",
		name: "Hider",
		class: "turner",
		effectText: {
			turned: "If your other ally Crew is face-up, turn that Crew face-down.",
		},
		flavorText: "",
		turnedEffects: [
			// mandatory; forces the other slot face-down
			when(
				{ when: "another_ally_is_turned" },
				{ type: "unturn_other_ally_crew" },
			),
		],
		passiveEffects: [],
	},
	{
		id: "terminal",
		name: "Terminal",
		class: "turner",
		effectText: {
			passive:
				"Your Boss cannot be Striked (by Strike or Face Turn) while its HP is above 50.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [
			// full gate on strike/execute attempts; negates the whole action
			// attempt, not a damage-pipeline primitive
			{ type: "passive_block_strikes_above_half_hp" },
		],
	},
	{
		id: "suplex",
		name: "Suplex",
		class: "turner",
		effectText: {
			turned:
				"If you have turned an ally Crew face-up this game, strike target enemy Crew (executes their Boss if they have no face-down Crew).",
		},
		flavorText: "",
		turnedEffects: [
			// permanent "this game" flag, survives unturns
			when(
				{ when: "has_turned_ally_crew_this_game" },
				{ type: "strike_enemy_crew" },
			),
		],
		passiveEffects: [],
	},
	{
		id: "wolfman",
		name: "Wolfman",
		class: "turner",
		effectText: {
			turned:
				"Full Moon costs 0. Search your deck for Full Moon, then shuffle your deck.",
		},
		flavorText: "",
		turnedEffects: [
			{ type: "search_deck_for_card_add_to_hand", cardId: "full-moon" },
		],
		passiveEffects: [],
	},
	{
		id: "jeremy",
		name: "Jeremy",
		class: "turner",
		effectText: {
			passive:
				"If this Crew transforms into The Berserker, the transformation is permanent.",
		},
		flavorText: "",
		turnedEffects: [],
		passiveEffects: [],
	},
	{
		id: "berserker",
		name: "The Berserker",
		class: "striker",
		effectText: { turned: "Deal 50 damage to target enemy Boss." },
		flavorText: "",
		turnedEffects: [{ type: "deal_damage", target: "enemy_boss", amount: 50 }],
		passiveEffects: [],
		draftable: false,
	},
];

// moves
// active: occupy one of 3 active slots, persistent until discarded
// burst: play and resolve immediately, then discard
// slow: enter the move chain (lifo), both players may respond with burst or another slow

export const MOVES: readonly MoveCard[] = [
	// active moves

	{
		id: "poison-breath",
		name: "Poison Breath",
		baseCost: 2,
		moveType: "active",
		effectText:
			"At the end of each round, deal 10 damage to target enemy Boss.",
		flavorText: "",
		effects: [{ type: "passive_poison_per_round", damagePerRound: 10 }],
	},
	{
		id: "side-hustle",
		name: "Side Hustle",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of each of your future turns, gain 1 Cash.",
		flavorText: "",
		effects: [{ type: "passive_cash_per_turn", amount: 1 }],
	},
	{
		id: "dataminer",
		name: "Dataminer",
		baseCost: 1,
		moveType: "active",
		effectText: "At the start of each of your future turns, draw 1 card.",
		flavorText: "",
		effects: [{ type: "passive_draw_per_turn", amount: 1 }],
	},
	{
		id: "blood-money",
		name: "Blood Money",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an opponent plays a Move or performs a strike, gain 1 Cash.",
		flavorText: "",
		effects: [{ type: "passive_cash_on_enemy_move_or_strike", amount: 1 }],
	},
	{
		id: "background-check",
		name: "Background Check",
		baseCost: 2,
		moveType: "active",
		effectText:
			"Whenever an opponent challenges you, before the challenge resolves, they must declare the class of one of your face-down Crew. If their guess is wrong, turn one of their Crew face-up.",
		flavorText: "",
		effects: [{ type: "passive_background_check" }],
	},
	{
		id: "prank-call",
		name: "Prank Call",
		baseCost: 1,
		moveType: "active",
		effectText:
			"The first time each round you bluff a Class Action, gain 2 Cash.",
		flavorText: "",
		effects: [
			{ type: "passive_bonus_cash_on_first_bluff_per_round", amount: 2 },
		],
	},
	{
		id: "void-arms",
		name: "The Iterated Void's Arms",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever an opponent would choose which of your face-down Crew to turn face-up, you make that choice instead.",
		flavorText: "",
		effects: [{ type: "passive_defender_chooses_crew_to_turn" }],
	},
	{
		id: "void-legs",
		name: "The Iterated Void's Legs",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of each of your turns, you may discard 1 card to deal 5 damage to target enemy Boss.",
		flavorText: "",
		effects: [
			{
				type: "passive_optional_discard_for_damage_per_turn",
				discardCost: 1,
				damage: 5,
			},
		],
	},
	{
		id: "void-torso",
		name: "The Iterated Void's Torso",
		baseCost: 1,
		moveType: "active",
		effectText:
			"At the start of each of your turns, give 5 Shield to target ally Boss.",
		flavorText: "",
		effects: [{ type: "passive_shield_per_turn", amount: 5 }],
	},
	{
		id: "big-voucher",
		name: "Big Voucher",
		baseCost: 2,
		moveType: "active",
		effectText: "Your Move costs are each reduced by 1.",
		flavorText: "",
		effects: [
			// reduces base cost of all moves by 1 (min 0) while active
			{ type: "passive_reduce_all_move_costs", reduction: 1 },
		],
	},
	{
		id: "command-center",
		name: "Command Center",
		baseCost: 3,
		moveType: "active",
		effectText:
			"At the start of each of your turns, draw 1 card and gain 1 Cash.",
		flavorText: "",
		effects: [
			{ type: "passive_draw_per_turn", amount: 1 },
			{ type: "passive_cash_per_turn", amount: 1 },
		],
	},
	{
		id: "blackmail",
		name: "Blackmail",
		baseCost: 3,
		moveType: "active",
		effectText: "All Crew Passives are disabled.",
		flavorText: "",
		effects: [{ type: "passive_disable_all_crew_skills" }],
	},
	{
		id: "supply-drop",
		name: "Supply Drop",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever a Collector action resolves, your team gains 1 additional Cash.",
		flavorText: "",
		effects: [{ type: "passive_team_cash_on_ally_collect", amount: 1 }],
	},
	{
		id: "life-insurance",
		name: "Life Insurance",
		baseCost: 3,
		moveType: "active",
		effectText:
			"Whenever target ally Boss would be reduced to 0 HP for the first time, it survives with 1 HP instead. Then discard this Move.",
		flavorText: "",
		effects: [
			// targets own boss, no choice; self-removes from active zone
			{ type: "passive_life_insurance" },
		],
	},
	{
		id: "false-flag-operation",
		name: "False Flag Operation",
		baseCost: 1,
		moveType: "active",
		effectText:
			"Whenever you would turn a Crew face-up from failing a challenge, prevent that effect and discard this Move instead.",
		flavorText: "",
		effects: [
			// challenger still gets credit; only the crew-turning consequence is prevented
			{ type: "passive_false_flag" },
		],
	},
	{
		id: "bamboo-wall",
		name: "Bamboo Wall",
		baseCost: 1,
		moveType: "active",
		effectText:
			"If you have a face-up Blocker, at the start of each of your turns, give 15 Shield to target ally Boss.",
		flavorText: "",
		effects: [
			when(
				{ when: "ally_class_is_turned", class: "blocker" },
				{ type: "passive_shield_per_turn", amount: 15 },
			),
		],
	},
	{
		id: "trickle-down-economics",
		name: "Trickle-Down Economics",
		baseCost: 3,
		moveType: "active",
		effectText:
			"Whenever target opponent's Collector action resolves, gain the same amount of Cash they gained.",
		flavorText: "",
		effects: [{ type: "passive_mirror_enemy_collect_cash" }],
	},

	// burst moves

	{
		id: "deleb-i",
		name: "Deleb-i, The Iterated Void",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"If The Iterated Void's Arms, Legs, and Torso are all in your active zone, you win the game.",
		flavorText: "",
		effects: [
			{
				type: "win_if_void_pieces_assembled",
				requiredPieceIds: ["void-arms", "void-legs", "void-torso"],
			},
		],
	},
	{
		id: "reload",
		name: "Reload",
		baseCost: 1,
		moveType: "burst",
		effectText: "Draw 2 cards.",
		flavorText: "",
		effects: [{ type: "draw_cards", amount: 2 }],
	},
	{
		id: "drive-by",
		name: "Drive-By",
		baseCost: 3,
		moveType: "burst",
		effectText: "Deal 30 damage to target enemy Boss.",
		flavorText: "",
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 30 }],
	},
	{
		id: "claim-the-bounty",
		name: "Claim The Bounty",
		baseCost: 4,
		moveType: "slow",
		effectText:
			"Deal 30 damage to target enemy Boss. If you have successfully called a bluff this game, this costs 0 Cash instead.",
		flavorText: "",
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 30 }],
	},
	{
		id: "ambush",
		name: "Ambush",
		baseCost: 3,
		moveType: "slow",
		effectText:
			"Strike target enemy Crew — or execute their Boss if they have no face-down Crew. This strike can be blocked.",
		flavorText: "",
		effects: [
			// opens a block window (not a challenge window) after play
			{ type: "strike_enemy_crew_blockable" },
		],
	},
	{
		id: "devastate",
		name: "Devastate",
		baseCost: 6,
		moveType: "burst",
		effectText: "Deal damage equal to 50% of target enemy Boss's current HP.",
		flavorText: "",
		effects: [
			{
				type: "deal_damage_percent_current_hp",
				target: "enemy_boss",
				percent: 50,
				cannotBeMultiplied: true,
			},
		],
	},
	{
		id: "bulletproof-vest",
		name: "Bulletproof Vest",
		baseCost: 1,
		moveType: "burst",
		effectText: "Give 10 Shield to target ally Boss.",
		flavorText: "",
		effects: [{ type: "shield_boss", amount: 10 }],
	},
	{
		id: "job-application",
		name: "Job Application",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Set your Cash and target opponent's Cash to 0. Then draw 3 cards.",
		flavorText: "",
		effects: [{ type: "set_both_cash_zero_then_draw", drawAmount: 3 }],
	},
	{
		id: "full-moon",
		name: "Full Moon",
		baseCost: 10,
		moveType: "burst",
		effectText:
			"Return cards from your discard pile to your hand until your hand is full. Gain 10 Cash.",
		flavorText: "",
		effects: [
			{ type: "return_discards_to_hand_until_full" },
			{ type: "gain_cash", amount: 10 },
		],
	},
	{
		id: "all-in",
		name: "All-In",
		baseCost: 4,
		moveType: "burst",
		effectText: "Set target ally Boss's HP to 1. Gain 7 Cash and draw 3 cards.",
		flavorText: "",
		effects: [
			{
				type: "set_ally_boss_hp_gain_cash_draw",
				hpAmount: 1,
				cashGain: 7,
				drawAmount: 3,
			},
		],
	},
	{
		id: "cheap-labor",
		name: "Cheap Labor",
		baseCost: 1,
		moveType: "burst",
		effectText: "Draw 1 card and gain 3 Cash.",
		flavorText: "",
		effects: [
			{ type: "draw_cards", amount: 1 },
			{ type: "gain_cash", amount: 3 },
		],
	},
	{
		id: "coordinated-strike",
		name: "Coordinated Strike",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Deal 15 damage to target enemy Boss. If you have a face-up Striker, deal 25 damage instead.",
		flavorText: "",
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
	{
		id: "ratatatat",
		name: "Ratatatat!",
		baseCost: 2,
		moveType: "slow",
		effectText:
			"Deal 20 damage to target enemy Boss. This damage ignores Shield.",
		flavorText: "",
		effects: [{ type: "deal_damage_ignore_shield", amount: 20 }],
	},
	{
		id: "dig-deep",
		name: "Dig Deep",
		baseCost: 2,
		moveType: "burst",
		effectText:
			"Look at the top 5 cards of your deck. Draw 2, then shuffle your deck.",
		flavorText: "",
		effects: [
			{ type: "look_at_top_deck_draw_one", lookCount: 5, drawCount: 2 },
		],
	},
	{
		id: "reinforcements",
		name: "Reinforcements",
		baseCost: 2,
		moveType: "burst",
		effectText: "Give 20 Shield to target ally Boss and draw 1 card.",
		flavorText: "",
		effects: [
			{ type: "shield_boss", amount: 20 },
			{ type: "draw_cards", amount: 1 },
		],
	},
	{
		id: "empty-the-clip",
		name: "Empty The Clip",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Discard any number of cards from your hand. Deal 10 damage to target enemy Boss for each card discarded this way.",
		flavorText: "",
		effects: [
			{ type: "deal_damage_per_discarded_variable", damagePerCard: 10 },
		],
	},
	{
		id: "fresh-start",
		name: "Fresh Start",
		baseCost: 1,
		moveType: "burst",
		effectText:
			"Draw 1 card. If you had no other cards in hand when you played this, draw 3 cards instead.",
		flavorText: "",
		effects: [
			// hand length checked at resolution time, after removing this card
			{
				type: "draw_cards_or_more_if_hand_was_empty",
				baseAmount: 1,
				bonusAmount: 3,
			},
		],
	},
	{
		id: "tactical-support",
		name: "Tactical Support",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Target ally gains 2 Cash. You may then turn one of their face-up Crew face-down.",
		flavorText: "",
		effects: [
			// in duel/ffa targets self; in teams targets a teammate. unturn is optional
			{ type: "give_ally_cash_then_optional_unturn", cashAmount: 2 },
		],
	},
	{
		id: "rage-serum",
		name: "Rage Serum",
		baseCost: 1,
		moveType: "burst",
		effectText: "Transform Jeremy into The Berserker.",
		flavorText: "",
		effects: [{ type: "transform_jeremy_into_berserker" }],
	},
	{
		id: "scorched-earth",
		name: "Scorched Earth",
		baseCost: 3,
		moveType: "burst",
		effectText: "Discard all Active Moves from all players' active zones.",
		flavorText: "",
		effects: [{ type: "discard_all_actives_all_players" }],
	},
	{
		id: "triangle-of-trust",
		name: "Triangle of Trust",
		baseCost: 2,
		moveType: "burst",
		effectText: "Discard 1 card from your hand. If you do, draw 3 cards.",
		flavorText: "",
		effects: [{ type: "discard_one_draw_three" }],
	},
	{
		id: "heel-turn",
		name: "Heel Turn",
		baseCost: 4,
		moveType: "burst",
		effectText: "Turn one ally Crew face-down.",
		flavorText: "",
		effects: [{ type: "unturn_ally_crew" }],
	},
	{
		id: "first-aid",
		name: "First Aid",
		baseCost: 1,
		moveType: "burst",
		effectText: "Heal target ally Boss for 20 HP.",
		flavorText: "",
		effects: [{ type: "heal_boss", amount: 20 }],
	},
	{
		id: "neetos-clock",
		name: "Neeto's Clock",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Discard 2 cards from your hand. If you do, reactivate a face-up ally Crew's Turned effect.",
		flavorText: "",
		effects: [
			{ type: "discard_then_reactivate_ally_turned_effect", discardCost: 2 },
		],
	},
	{
		id: "bailout",
		name: "Bailout",
		baseCost: 2,
		moveType: "burst",
		effectText: "Heal target ally Boss for 20 HP and gain 2 Cash.",
		flavorText: "",
		effects: [
			{ type: "heal_boss", amount: 20 },
			{ type: "gain_cash", amount: 2 },
		],
	},
	{
		id: "pull-counter",
		name: "Pull Counter",
		baseCost: 3,
		moveType: "burst",
		effectText:
			"Turn one face-up ally Crew face-down, then turn it face-up again.",
		flavorText: "",
		effects: [{ type: "unturn_then_retrigger_ally" }],
	},
	{
		id: "cash-out",
		name: "Cash Out",
		baseCost: 0,
		moveType: "burst",
		effectText: "Discard 2 cards from your hand. If you do, gain 2 Cash.",
		flavorText: "",
		effects: [
			// only gain cash if 2 cards were actually discarded
			{ type: "discard_cards_from_hand", amount: 2 },
			{ type: "gain_cash", amount: 2 },
		],
	},
	{
		id: "switch-up",
		name: "Switch Up",
		baseCost: 4,
		moveType: "burst",
		effectText:
			"Turn one ally Crew face-down and a different ally Crew face-up.",
		flavorText: "",
		effects: [
			// requires at least one face-up and one face-down crew
			{ type: "unturn_one_turn_different_ally" },
		],
	},
	{
		id: "tag-out",
		name: "Tag Out",
		baseCost: 2,
		moveType: "burst",
		effectText: "Swap one of your Crew with one of target ally's Crew.",
		flavorText: "",
		effects: [
			// teams mode only; fizzles in duel/ffa
			{ type: "swap_crew_with_teammate" },
		],
	},
	{
		id: "take-it-back",
		name: "Take It Back",
		baseCost: 1,
		moveType: "burst",
		effectText: "Return 1 card from your discard pile to your hand.",
		flavorText: "",
		effects: [{ type: "return_one_from_discard_to_hand" }],
	},
	{
		id: "spare-change",
		name: "Spare Change",
		baseCost: 1,
		moveType: "burst",
		effectText: "Gain 2 Cash.",
		flavorText: "",
		effects: [{ type: "gain_cash", amount: 2 }],
	},
	{
		id: "paycheck",
		name: "Paycheck",
		baseCost: 2,
		moveType: "burst",
		effectText: "Gain 4 Cash.",
		flavorText: "",
		effects: [{ type: "gain_cash", amount: 4 }],
	},
	{
		id: "sucker-punch",
		name: "Sucker Punch",
		baseCost: 1,
		moveType: "burst",
		effectText: "Deal 15 damage to target enemy Boss.",
		flavorText: "",
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 15 }],
	},
	{
		id: "wolfblaster",
		name: "Wolfblaster",
		baseCost: 5,
		moveType: "burst",
		effectText: "Deal 40 damage to target enemy Boss.",
		flavorText: "",
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 40 }],
	},
	{
		id: "dead-drop-retrieval",
		name: "Dead Drop Retrieval",
		baseCost: 2,
		moveType: "burst",
		effectText: "Draw 3 cards.",
		flavorText: "",
		effects: [{ type: "draw_cards", amount: 3 }],
	},

	// slow moves

	{
		id: "cheap-shot",
		name: "Cheap Shot",
		baseCost: 1,
		moveType: "slow",
		effectText: "Deal 20 damage to target enemy Boss.",
		flavorText: "",
		effects: [{ type: "deal_damage", target: "enemy_boss", amount: 20 }],
	},
	{
		id: "unfinished-business",
		name: "Unfinished Business",
		baseCost: 3,
		moveType: "slow",
		effectText:
			"If you or an ally has a face-up Collector, strike target enemy Crew (unblockable; executes their Boss if they have no face-down Crew).",
		flavorText: "",
		effects: [
			when(
				{ when: "ally_class_is_turned", class: "collector" },
				{ type: "strike_enemy_crew", unblockable: true },
			),
		],
	},
	{
		id: "kamikaze",
		name: "Kamikaze",
		baseCost: 0,
		moveType: "slow",
		effectText:
			"Turn one ally Crew face-up. If you do, deal 30 damage to target enemy Boss.",
		flavorText: "",
		effects: [
			// damage is conditional on successfully turning a crew
			{ type: "turn_ally_crew" },
			{ type: "deal_damage", target: "enemy_boss", amount: 30 },
		],
	},
	{
		id: "nope",
		name: "Nope!",
		baseCost: 1,
		moveType: "slow",
		effectText: "Stop an enemy Slow Move.",
		flavorText: "",
		effects: [{ type: "negate_enemy_slow_move" }],
	},
	{
		id: "interrogation",
		name: "Interrogation",
		baseCost: 1,
		moveType: "slow",
		effectText:
			"Look at 2 random cards from target opponent's hand. You may discard 1 of them.",
		flavorText: "",
		effects: [{ type: "peek_two_random_enemy_cards_discard_one" }],
	},
	{
		id: "reverse-card",
		name: "Reverse Card",
		baseCost: 2,
		moveType: "slow",
		effectText:
			"Counter target enemy Slow Move that deals damage. That Move's damage is dealt to its controller instead.",
		flavorText: "",
		effects: [
			// reflects base damage; reverse card itself is a slow move and can be nope!'d
			{ type: "reflect_slow_move_base_damage" },
		],
	},
	{
		id: "pickpocket",
		name: "Pickpocket",
		baseCost: 0,
		moveType: "slow",
		effectText: "Steal 2 Cash from target opponent.",
		flavorText: "",
		effects: [{ type: "steal_cash", amount: 2 }],
	},
	{
		id: "strip-em-down",
		name: "Strip 'Em Down",
		baseCost: 1,
		moveType: "slow",
		effectText: "Remove all Shield from target enemy Boss. Draw 1 card.",
		flavorText: "",
		effects: [
			{ type: "remove_all_shields", target: "enemy_boss" },
			{ type: "draw_cards", amount: 1 },
		],
	},
	{
		id: "wheel-of-fortune",
		name: "Wheel Of Fortune",
		baseCost: 1,
		moveType: "slow",
		effectText:
			"You and target opponent each discard your hands, then each draw that many cards.",
		flavorText: "",
		effects: [{ type: "mutual_discard_hand_then_redraw_same_count" }],
	},
	{
		id: "truth-serum",
		name: "Truth Serum",
		baseCost: 4,
		moveType: "slow",
		effectText:
			"Target opponent reveals the class of one of their face-down Crew.",
		flavorText: "",
		effects: [{ type: "reveal_enemy_crew_class" }],
	},
];

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