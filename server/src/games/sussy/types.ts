import type {
	SussyPhase,
	SussyMode,
	TaskType,
	SussyResponse,
	SussyRoundResult,
	SussyTaskVoteResult,
} from "../../../../shared/sussy";

export interface SussyServerPlayer {
	playerId: string;
	totalSleuthed: number;
	totalSurvived: number;
}

export interface SussyServerState {
	phase: SussyPhase;
	mode: SussyMode;
	roundNumber: number;
	taskNumber: 1 | 2 | 3;
	taskType: TaskType;
	chooserPlayerId: string | null;
	impostorId: string | null;
	crewPrompt: string | [string, string, string];
	impostorPrompt: string | [string, string, string] | null;
	responses: Map<string, SussyResponse>;
	votes: Map<string, string | null>;
	correctVoteCount: Map<string, number>;
	taskResults: SussyTaskVoteResult[];
	roundResults: SussyRoundResult[];
	players: Map<string, SussyServerPlayer>;
}
