export type { Line, ActiveLine } from "./strategy/lines";

export interface AIPersonality {
	readonly id: string;
	readonly displayName: string;
	readonly tightness: number;
	readonly aggression: number;
	readonly bluffFrequency: number;
	readonly sizingWeights: readonly [number, number, number, number];
	readonly noise: number;
	readonly thinkTimeMs: readonly [number, number];

	readonly openRangePct: number;
	readonly threeBetRangePct: number;
	readonly coldCallPct: number;
}

export interface AIDecisionContext {
	equity: number;

	readonly potOdds: number;
	readonly pot: number;
	readonly stack: number;
	readonly callAmount: number;
	readonly effectivePot: number;
	readonly betLevel: number;

	readonly minRaiseTo: number;
	readonly maxRaiseTo: number;
	readonly canCheck: boolean;
	readonly canRaise: boolean;
	readonly canCall: boolean;
	readonly streetIndex: number;

	readonly spr: number;

	readonly numOpponents: number;
	readonly activeOpponents: number;

	readonly positionFactor: number;

	readonly bigBlind: number;
	readonly isLimpOpportunity: boolean;

	readonly chipsInvested: number;
}