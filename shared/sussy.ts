export type SussyMode = "hangout" | "remote";

export type SussyPhase =
	| "category_select"
	| "role_reveal"
	| "task_perform"
	| "voting"
	| "round_result"
	| "finished";

export type TaskType =
	| "show_of_hands"
	| "finger_pointing"
	| "finger_blast"
	| "thumb_shot"
	| "face_turn"
	| "glitch_in_the_chat";

export type PlayerRole = "crew" | "impostor";

export type SussyResponse =
	| { type: "show_of_hands"; raised: boolean }
	| { type: "finger_pointing"; targetId: string | null }
	| { type: "finger_blast"; count: number }
	| { type: "thumb_shot"; choices: boolean[] }
	| { type: "face_turn"; emoji: string | null }
	| { type: "glitch_in_the_chat"; answers: string[] };

export interface SussyPlayerSecret {
	role: PlayerRole;
	prompt: string | [string, string, string] | null;
	isGlitchRound: boolean;
	taskNumber: 1 | 2 | 3;
}

export interface SussyPlayerView {
	playerId: string;
	score: number;
	sleuthedCount: number;
	survivedCount: number;
	hasResponded: boolean;
	hasVoted: boolean;
	response: SussyResponse | null;
	voteTargetId: string | null;
	isEliminated: boolean;
}

export interface SussyTaskVoteResult {
	taskNumber: 1 | 2 | 3;
	wasCaught: boolean;
	voteBreakdown: Record<string, string | null>;
	scoreDeltas: Record<string, number>;
}

export interface SussyRoundResult {
	roundNumber: number;
	taskType: TaskType;
	impostorId: string;
	taskResults: SussyTaskVoteResult[];
	crewPrompt: string | [string, string, string];
	impostorPrompt: string | [string, string, string] | null;
}

export interface SussyState {
	phase: SussyPhase;
	mode: SussyMode;
	roundNumber: number;
	taskNumber: 1 | 2 | 3;
	taskType: TaskType;
	chooserPlayerId: string | null;
	players: Record<string, SussyPlayerView>;
	lastRoundResult: SussyRoundResult | null;
	allResponded: boolean;
	allVoted: boolean;
	/**
	 * Non-null during voting when a player has reached strict majority.
	 * Client uses this for real-time "consensus reached" feedback.
	 */
	majorityTargetId: string | null;
}

export type SussyAction =
	| { type: "select_category"; category: TaskType }
	| { type: "submit_response"; response: SussyResponse }
	| { type: "cast_vote"; targetId: string };
