export interface HpState {
	[id: string]: number;
}

export type LogLineType = "hit" | "miss" | "crit" | "buff" | "ko" | "timeout";

export interface LogLine {
	id: number;
	text: string;
	type: LogLineType;
}
