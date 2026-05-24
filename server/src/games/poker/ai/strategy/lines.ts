import type { HandBucket } from "./handBucket";

export type Line =
	| "bet_fold"
	| "bet_call_barrel"
	| "check_raise"
	| "check_call_float"
	| "slowplay_trap"
	| "bluff_2barrel"
	| "overbet_polar"
	| "give_up";

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
	readonly streetSelected: number;
	readonly active: boolean;
}

type ActionKey = "fold" | "check" | "call" | "raise" | "all_in";

export function lineValidActions(
	line: Line,
	facingBet: boolean,
	canCheck: boolean,
	canRaise: boolean,
): ReadonlySet<ActionKey> {
	switch (line) {
		case "bet_fold":
			if (facingBet) return new Set(["fold", "call"]);
			return canRaise ? new Set(["raise", "all_in"]) : new Set(["check"]);

		case "bet_call_barrel":
			if (facingBet) return new Set(["call", "raise", "all_in", "fold"]);
			return canRaise
				? new Set(["raise", "all_in", "check"])
				: new Set(["check"]);

		case "check_raise":
			if (facingBet) return new Set(["raise", "all_in", "fold"]);
			return new Set(["check"]);

		case "check_call_float":
			return new Set(["check", "call", "fold"]);

		case "slowplay_trap":
			return new Set(["check", "call", "fold"]);

		case "bluff_2barrel":
			if (facingBet) return new Set(["fold", "call"]);
			return canRaise
				? new Set(["raise", "all_in"])
				: new Set(["check", "fold"]);

		case "overbet_polar":
			return canRaise
				? new Set(["raise", "all_in"])
				: new Set(["call", "fold"]);

		case "give_up":
			return new Set(["fold", "check"]);
	}
}

const LINE_BIAS: Record<Line, Partial<Record<ActionKey, number>>> = {
	bet_fold: { raise: 0.15 },
	bet_call_barrel: { raise: 0.2, call: 0.1 },
	check_raise: { raise: 0.25, check: 0.15 },
	check_call_float: { call: 0.15, check: 0.1 },
	slowplay_trap: { check: 0.2, call: 0.1 },
	bluff_2barrel: { raise: 0.2 },
	overbet_polar: { raise: 0.3, all_in: 0.2 },
	give_up: { fold: 0.15, check: 0.1 },
} as const;

export function lineBias(
	narrative: ActiveLine | null,
): Partial<Record<ActionKey, number>> {
	return narrative?.active ? LINE_BIAS[narrative.line] : {};
}

function chooseLine(
	bucket: HandBucket,
	spr: number,
	inPosition: boolean,
	streetIndex: number,
	bluffFrequency: number,
	isPFAggressor: boolean,
): Line {
	const onFlop = streetIndex === 1;

	switch (bucket) {
		case "nuts":
			if (streetIndex === 3 || spr < 3) return "overbet_polar";
			if (!inPosition && spr > 7) {
				return Math.random() < 0.55 ? "slowplay_trap" : "check_raise";
			}
			if (!inPosition && spr > 3) {
				return Math.random() < 0.3 ? "slowplay_trap" : "check_raise";
			}
			return inPosition || isPFAggressor ? "bet_call_barrel" : "check_raise";

		case "strong":
			if (spr < 3) return "overbet_polar";
			if (!inPosition && spr > 6) return "check_call_float";
			if (!inPosition && spr > 3) {
				return Math.random() < 0.45 ? "check_raise" : "check_call_float";
			}
			return inPosition || isPFAggressor ? "bet_call_barrel" : "check_raise";

		case "medium":
			if (!inPosition && spr > 4 && streetIndex <= 2)
				return Math.random() < 0.3 ? "check_raise" : "check_call_float";
			return inPosition || isPFAggressor
				? "bet_call_barrel"
				: "check_call_float";

		case "draw":
			if (inPosition && spr > 3 && onFlop)
				return Math.random() < bluffFrequency
					? "bluff_2barrel"
					: "check_call_float";
			if (!inPosition && spr > 3 && onFlop)
				return Math.random() < 0.25 ? "check_raise" : "check_call_float";
			return "check_call_float";

		case "weak":
			if (inPosition && onFlop && Math.random() < bluffFrequency * 0.5)
				return "bet_fold";
			return inPosition ? "check_call_float" : "give_up";

		case "air":
			if (
				inPosition &&
				spr > 3 &&
				onFlop &&
				Math.random() < bluffFrequency * 0.75
			)
				return "bluff_2barrel";
			if (inPosition && onFlop && Math.random() < bluffFrequency * 0.6)
				return isPFAggressor ? "bet_fold" : "give_up";
			return "give_up";
	}
}

export function selectLine(
	bucket: HandBucket,
	spr: number,
	positionFactor: number,
	streetIndex: number,
	current: ActiveLine | null,
	bluffFrequency = 0.2,
	isPFAggressor = false,
): ActiveLine | null {
	if (streetIndex === 0) return null;
	if (current?.active) return current;

	const line = chooseLine(
		bucket,
		spr,
		positionFactor > 0.55,
		streetIndex,
		bluffFrequency,
		isPFAggressor,
	);
	return { line, streetSelected: streetIndex, active: true };
}

export function expireLine(
	narrative: ActiveLine | null,
	chosenAction: ActionKey,
	equity: number,
	streetIndex: number,
): ActiveLine | null {
	if (!narrative?.active) return narrative;

	const { line, streetSelected } = narrative;
	const isNewStreet = streetIndex > streetSelected;

	switch (line) {
		case "bet_fold":
			return ["raise", "all_in", "fold", "call"].includes(chosenAction)
				? { ...narrative, active: false }
				: narrative;

		case "bet_call_barrel":
			return chosenAction === "fold"
				? { ...narrative, active: false }
				: narrative;

		case "check_raise":
			return ["raise", "all_in", "fold"].includes(chosenAction)
				? { ...narrative, active: false }
				: narrative;

		case "check_call_float":
			return chosenAction === "fold"
				? { ...narrative, active: false }
				: narrative;

		case "slowplay_trap":
			return equity < 0.55 || streetIndex === 3
				? { ...narrative, active: false }
				: narrative;

		case "bluff_2barrel":
			if (equity < 0.28 && isNewStreet) return { ...narrative, active: false };
			if (["raise", "all_in"].includes(chosenAction) && isNewStreet)
				return { ...narrative, active: false };
			return narrative;

		case "overbet_polar":
			return ["raise", "all_in", "fold"].includes(chosenAction)
				? { ...narrative, active: false }
				: narrative;

		case "give_up":
			return ["fold", "check"].includes(chosenAction)
				? { ...narrative, active: false }
				: narrative;
	}
}