// players
export interface PublicPlayer {
	id: string; // stable playerId, NOT socket.id
	name: string;
	score: number;
	isConnected: boolean;
}

// game phases
export type GamePhase = "LOBBY" | "GAME_OVER";

// the one object every client receives
export interface PublicGameState {
	roomCode: string;
	phase: GamePhase;
	players: PublicPlayer[];
	round: number;
	totalRounds: number;
	timeRemaining: number | null;
	// phase-specific payloads (null when not active)
	promptPhase: PromptPhaseData | null;
	votingPhase: VotingPhaseData | null;
	resultsPhase: ResultsPhaseData | null;
}

export interface PromptPhaseData {
	yourPrompt: string; // only sent to the specific player
	submittedPlayerIds: string[];
}

export interface VotingPhaseData {
	prompt: string;
	answers: { playerId: string; text: string }[];
	votedPlayerIds: string[];
}

export interface ResultsPhaseData {
	prompt: string;
	answers: { playerId: string; text: string; votes: number }[];
	winnerPlayerId: string;
}

// scket event payloads (client -> server)
export interface JoinRoomPayload {
	roomCode: string;
	name: string;
	playerId: string | null; // null on first join, stored id on rejoin
}

export interface SubmitAnswerPayload {
	answer: string;
}

export interface SubmitVotePayload {
	votedForPlayerId: string;
}

// socket event map
export interface ServerToClientEvents {
	state_update: (state: PublicGameState) => void;
	player_prompt: (prompt: string) => void; // private, only to that socket
	error: (message: string) => void;
}

export interface ClientToServerEvents {
	"host:create_room": () => void;
	"player:join_room": (payload: JoinRoomPayload) => void;
	"player:submit_answer": (payload: SubmitAnswerPayload) => void;
	"player:submit_vote": (payload: SubmitVotePayload) => void;
	"host:start_game": (roomCode: string) => void;
}
