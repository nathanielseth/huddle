import { getMoveDisplay } from "@shared/games/face-turn/card-display";
import { FACETURN_CONSTANTS } from "@shared/games/face-turn/constants";
import type {
	FaceturnsPlayerView,
	FaceturnsSecret,
} from "@shared/games/face-turn/types";

const CLAIM_THE_BOUNTY_ID = "claim-the-bounty" as const;

// mirrors server getMoveCost/effectiveCost; claim the bounty is free after a successful bluff
export function makeMoveCostEstimator(
	secret: FaceturnsSecret | null,
	hasCalledBluffSuccessfully: boolean,
	myPlayer: FaceturnsPlayerView,
	allPlayers: Readonly<Record<string, FaceturnsPlayerView>>,
): (moveId: string) => number {
	const enemySurcharge = Object.values(allPlayers)
		.filter((p) => !p.isEliminated && p.teamIndex !== myPlayer.teamIndex)
		.reduce((sum, enemy) => sum + enemy.enemyMoveCostSurcharge, 0);

	return (moveId: string): number => {
		if (moveId === CLAIM_THE_BOUNTY_ID && hasCalledBluffSuccessfully) {
			return 0;
		}
		const move = getMoveDisplay(moveId);
		const override = secret?.costOverrides[moveId];
		const base = override ?? move.baseCost;

		let reduction = myPlayer.moveBaseCostReduction;
		if (move.moveType === "burst") {
			reduction += myPlayer.burstMoveCostReduction;
		}

		return Math.max(0, base - reduction + enemySurcharge);
	};
}

// flat base costs from shared constants, use estimator below for actual charged amount
export const CLASS_ACTION_BASE_COST = {
	strike: FACETURN_CONSTANTS.STRIKE_CASH_COST,
	defend: FACETURN_CONSTANTS.DEFEND_CASH_COST,
	collect: FACETURN_CONSTANTS.COLLECT_CASH_COST,
	hide: FACETURN_CONSTANTS.HIDE_CASH_COST,
	steal: FACETURN_CONSTANTS.STEAL_CASH_COST,
} as const;

// mirrors server getClassActionCost: max(0, base - reduction)
export function makeClassActionCostEstimator(
	classActionCostReduction: number,
): (action: keyof typeof CLASS_ACTION_BASE_COST) => number {
	return (action) =>
		Math.max(0, CLASS_ACTION_BASE_COST[action] - classActionCostReduction);
}

export const BOSS_FACE_TURN_COST = FACETURN_CONSTANTS.BOSS_FACE_TURN_COST;