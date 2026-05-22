export type Line =
	| "bet_fold" // single-street bluff; give up if called
	| "bet_call_barrel" // bet flop intending to continue on turn
	| "check_raise" // check and raise when bet into
	| "check_call_float" // call down with showdown value / float IP
	| "slowplay_trap" // check strong hand to allow catch-up / extract later
	| "bluff_2barrel" // fire two streets as a bluff (flop + turn)
	| "overbet_polar" // large/overbet sizing with strong made hands
	| "give_up"; // check/fold to any aggression

export type Archetype =
	| "Nit"
	| "Rock"
	| "TAG"
	| "LAG"
	| "Station"
	| "Fish"
	| "Whale"
	| "Maniac";

export interface ActiveLine {
	readonly line: Line;
	// street index where this line was chosen (1–3)
	readonly streetSelected: number;
	// false once the plan has been spent or overridden by equity
	readonly active: boolean;
}

// additive score deltas applied after scoreActions() but before noise
type ActionKey = "fold" | "check" | "call" | "raise" | "all_in";

const LINE_BIAS: Record<Line, Partial<Record<ActionKey, number>>> = {
	// single-street bluff: fire once, then abandon if called
	bet_fold: { raise: 0.45, check: -0.2 },

	// two-street value/semi-bluff: bet flop, continue on turn
	bet_call_barrel: { raise: 0.5, call: 0.25 },

	// check-raise: invite the bet, then punish
	check_raise: { check: 0.45, raise: 0.35 },

	// float / call down: take free cards, resist aggression
	check_call_float: { check: 0.35, call: 0.45, raise: -0.3 },

	// slowplay: near-hard constraint
	slowplay_trap: { check: 2.5, call: 1.2, raise: -3.0 },

	// two-barrel bluff: fire both streets aggressively
	bluff_2barrel: { raise: 0.55, check: -0.2 },

	// polarised overbet: commit chips with strong made hand or credible bluff
	overbet_polar: { raise: 0.5, all_in: 0.4 },

	// give up: near-hard constraint
	give_up: { fold: 0.5, check: 0.35, raise: -1.5 },
} as const;

// selects narrative line for the current postflop spot
export function selectLine(
	equity: number,
	spr: number,
	positionFactor: number,
	streetIndex: number,
	current: ActiveLine | null,
	bluffFrequency: number = 0.2,
	isPFAggressor: boolean = false,
): ActiveLine | null {
	if (streetIndex === 0) return null;
	if (current?.active) return current;

	const inPosition = positionFactor > 0.55;
	let line: Line;

	if (equity > 0.7) {
		// strong made hand
		if (streetIndex === 3 || spr < 3) {
			line = "overbet_polar";
		} else if (!inPosition && spr > 7 && equity > 0.82 && Math.random() < 0.2) {
			line = "slowplay_trap";
		} else {
			line = inPosition || isPFAggressor ? "bet_call_barrel" : "check_raise";
		}
	} else if (equity > 0.45) {
		// medium hand - top pair, overpair, two pair
		if (!inPosition && spr > 4 && streetIndex <= 2) {
			line = Math.random() < 0.3 ? "check_raise" : "check_call_float";
		} else {
			// IP or preflop aggressor barrels; otherwise OOP floats
			line =
				inPosition || isPFAggressor ? "bet_call_barrel" : "check_call_float";
		}
	} else if (equity > 0.3) {
		// drawing hand, semi-bluff territory
		if (!inPosition && spr > 3 && streetIndex === 1) {
			line = Math.random() < 0.25 ? "check_raise" : "check_call_float";
		} else if (inPosition && streetIndex === 1) {
			line = "bluff_2barrel";
		} else if (inPosition) {
			line = "bet_fold";
		} else {
			line = "check_call_float";
		}
	} else {
		// weak / air — equity < 0.30
		const canSemiBluff = inPosition && spr > 3 && streetIndex <= 2;
		const wantsToBluff = Math.random() < bluffFrequency * 1.4;

		if (canSemiBluff && wantsToBluff) {
			line = streetIndex === 1 ? "bluff_2barrel" : "bet_fold";
		} else if (inPosition && streetIndex === 1) {
			line =
				Math.random() < bluffFrequency * 2
					? "bluff_2barrel"
					: isPFAggressor
						? "give_up"
						: "bet_fold";
		} else {
			line = "give_up";
		}
	}

	return { line, streetSelected: streetIndex, active: true };
}

// returns the score nudge map for an active narrative; empty object when none active
export function lineBias(
	narrative: ActiveLine | null,
): Partial<Record<ActionKey, number>> {
	if (!narrative?.active) return {};
	return LINE_BIAS[narrative.line];
}

// deactivates the narrative when the chosen action diverges from the plan or when specific line-completion conditions are met
export function expireLine(
	narrative: ActiveLine | null,
	chosenAction: string,
	equity: number,
	streetIndex: number,
): ActiveLine | null {
	if (!narrative?.active) return narrative;

	const { line, streetSelected } = narrative;

	// draw bricked, don't fire the second barrel into a calling range
	if (
		line === "bluff_2barrel" &&
		equity < 0.28 &&
		streetIndex > streetSelected
	) {
		return { ...narrative, active: false };
	}

	// single-street bluff: spent as soon as the raise is fired
	if (line === "bet_fold" && chosenAction === "raise") {
		return { ...narrative, active: false };
	}

	// two-barrel: spent after firing the second street (turn)
	if (
		line === "bluff_2barrel" &&
		chosenAction === "raise" &&
		streetIndex > streetSelected
	) {
		return { ...narrative, active: false };
	}

	// hand is over or chosen action is strongly penalised by the plan
	const nudgeForChosen = LINE_BIAS[line][chosenAction as ActionKey] ?? 0;
	if (nudgeForChosen < -0.03 || chosenAction === "fold") {
		return { ...narrative, active: false };
	}

	// abandon slowplay if equity has fallen enough to warrant aggression
	if (line === "slowplay_trap" && equity < 0.55) {
		return { ...narrative, active: false };
	}

	return narrative;
}
