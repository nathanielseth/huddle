import type { DeathvaultServerState, DeathvaultServerPlayer } from "./types";
import type {
	DeathvaultState,
	DeathvaultPlayerView,
	DeathvaultQuestion,
	DeathvaultPlayerSecret,
	DeathvaultQuestionResult,
} from "../../../../shared/games/deathvault";
import { projectMinigamePublic } from "./minigames";

const QUESTION_VISIBLE_PHASES = new Set<DeathvaultServerState["phase"]>([
	"question_wager",
	"question_answer",
	"question_result",
	"final_wager",
	"final_answer",
	"final_result",
]);

const RESULT_VISIBLE_PHASES = new Set<DeathvaultServerState["phase"]>([
	"question_result",
	"final_result",
	"round_end",
	"podium",
]);

const MINIGAME_VISIBLE_PHASES = new Set<DeathvaultServerState["phase"]>([
	"minigame_intro",
	"minigame_active",
	"minigame_result",
]);

function projectPlayer(
	p: DeathvaultServerPlayer,
	revealSecrets: boolean,
): DeathvaultPlayerView {
	return {
		playerId: p.playerId,
		cash: p.cash,
		status: p.status,
		hasWagered: p.wager !== null,
		hasActed: p.answer !== null,
		revealedAnswer: revealSecrets ? p.answer : null,
		wager: revealSecrets ? p.wager : null,
		lastDelta: p.lastDelta,
	};
}

function projectQuestion(
	q: DeathvaultServerState["currentQuestion"],
): DeathvaultQuestion | null {
	if (!q) return null;
	return {
		id: q.id,
		category: q.category,
		difficulty: q.difficulty,
		prompt: q.prompt,
		choices: q.choices,
	};
}

export function buildPublicState(
	state: DeathvaultServerState,
): DeathvaultState {
	const { phase } = state;
	const revealSecrets = RESULT_VISIBLE_PHASES.has(phase);

	const players: Record<string, DeathvaultPlayerView> = {};
	for (const [id, p] of state.players) {
		players[id] = projectPlayer(p, revealSecrets);
	}

	const question = QUESTION_VISIBLE_PHASES.has(phase)
		? projectQuestion(state.currentQuestion)
		: null;

	const questionResult: DeathvaultQuestionResult | null =
		RESULT_VISIBLE_PHASES.has(phase) ? state.questionResult : null;

	const minigame =
		state.minigame !== null && MINIGAME_VISIBLE_PHASES.has(phase)
			? projectMinigamePublic(state.minigame)
			: null;

	const allWagered = [...state.players.values()].every(
		(p) => p.status === "ghost" || p.wager !== null,
	);
	const allAnswered = [...state.players.values()].every(
		(p) => p.status === "ghost" || p.answer !== null,
	);

	return {
		phase,
		round: state.round,
		totalRounds: state.totalRounds,
		question,
		questionResult,
		players,
		allWagered,
		allAnswered,
		minigame,
		isFinalRound: state.round === state.totalRounds,
	};
}

export function buildPlayerSecret(
	state: DeathvaultServerState,
	playerId: string,
): DeathvaultPlayerSecret {
	const player = state.players.get(playerId);

	let myDilemmaChoice: DeathvaultPlayerSecret["myDilemmaChoice"] = null;
	if (state.minigame?.id === "prisoners_dilemma") {
		const mg = state.minigame;
		if (mg.playerA === playerId) myDilemmaChoice = mg.choiceA;
		else if (mg.playerB === playerId) myDilemmaChoice = mg.choiceB;
	}

	return {
		myWager: player?.wager ?? null,
		myDilemmaChoice,
	};
}