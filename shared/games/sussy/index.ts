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
	| "numbers_game"
	| "thumb_shot"
	| "face_turn"
	| "glitch_in_the_chat";

export type PlayerRole = "crew" | "impostor";

export type SussyResponse =
	| { readonly type: "show_of_hands"; readonly raised: boolean }
	| { readonly type: "finger_pointing"; readonly targetId: string | null }
	| { readonly type: "numbers_game"; readonly count: number }
	| { readonly type: "thumb_shot"; readonly choices: readonly boolean[] }
	| { readonly type: "face_turn"; readonly emoji: string | null }
	| {
			readonly type: "glitch_in_the_chat";
			readonly answers: readonly string[];
	  };

export interface SussyPlayerSecret {
	readonly role: PlayerRole;
	readonly prompt: string | readonly [string, string, string] | null;
	readonly isGlitchRound: boolean;
	readonly taskNumber: 1 | 2 | 3;
}

export interface SussyPlayerView {
	readonly playerId: string;
	readonly score: number;
	readonly sleuthedCount: number;
	readonly survivedCount: number;
	readonly hasResponded: boolean;
	readonly hasVoted: boolean;
	readonly response: SussyResponse | null;
	readonly voteTargetId: string | null;
	readonly isEliminated: boolean;
}

export interface SussyTaskVoteResult {
	readonly taskNumber: 1 | 2 | 3;
	readonly wasCaught: boolean;
	readonly voteBreakdown: Readonly<Record<string, string | null>>;
	readonly scoreDeltas: Readonly<Record<string, number>>;
}

export interface SussyRoundResult {
	readonly roundNumber: number;
	readonly taskType: TaskType;
	readonly impostorId: string;
	readonly taskResults: readonly SussyTaskVoteResult[];
	readonly crewPrompt: string | readonly [string, string, string];
	readonly impostorPrompt: string | readonly [string, string, string] | null;
}

export interface SussyState {
	readonly phase: SussyPhase;
	readonly mode: SussyMode;
	readonly roundNumber: number;
	readonly taskNumber: 1 | 2 | 3;
	readonly taskType: TaskType;
	readonly chooserPlayerId: string | null;
	readonly players: Readonly<Record<string, SussyPlayerView>>;
	readonly lastRoundResult: SussyRoundResult | null;
	readonly allResponded: boolean;
	readonly allVoted: boolean;
	readonly majorityTargetId: string | null;
}

export type SussyAction =
	| { readonly type: "select_category"; readonly category: TaskType }
	| { readonly type: "submit_response"; readonly response: SussyResponse }
	| { readonly type: "cast_vote"; readonly targetId: string };