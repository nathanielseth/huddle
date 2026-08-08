import type { FaceturnsAction } from "../../../../../shared/games/face-turn/schemas";
import { unwrapEffect, getMove, type EffectPrimitive } from "../cards";
import type { FaceturnServerState } from "../types";
import { applyAction, applyTimerExpired, isTerminal } from "./simulate";
import { evaluate } from "./evaluate";
import { getLegalActions, type EngineHelpers } from "./legal-actions";

// cheap heuristic action scoring for rollouts avoids the cost of resolving each candidate per ply
// playouts stay fast while still producing sensible-looking play

const ACTION_TYPE_BASE_WEIGHT: Partial<
	Record<FaceturnsAction["type"], number>
> = {
	end_turn: 0.15, // legal at every active_turn decision, must never dominate
	pass_challenge: 0.35,
	chain_pass: 0.35,
	accept_block: 0.3,
};

// "decline_via_timeout" represents the block window timing out; not a submittable action
export type RolloutChoice =
	| { kind: "action"; action: FaceturnsAction }
	| { kind: "decline_via_timeout" }
	| { kind: "none" };

export function sampleRolloutAction(
	state: FaceturnServerState,
	seat: string,
	helpers: EngineHelpers,
	rng: () => number = Math.random,
): RolloutChoice {
	const legal = getLegalActions(state, seat, helpers);

	// mirror ismcts.ts's timeout decline for block_window so rollouts also simulate unblocked strikes
	if (state.phase === "block_window") {
		const blockAction = legal.find((a) => a.type === "block");
		if (!blockAction) return { kind: "none" };
		const blockWeight = Math.exp(
			scoreActionHeuristic(state, seat, blockAction),
		);
		const declineWeight = Math.exp(DECLINE_BLOCK_BASE_SCORE);
		const total = blockWeight + declineWeight;
		return rng() * total < declineWeight
			? { kind: "decline_via_timeout" }
			: { kind: "action", action: blockAction };
	}

	if (legal.length === 0) return { kind: "none" };
	if (legal.length === 1) return { kind: "action", action: legal[0]! };

	const scored = legal.map((action) => ({
		action,
		weight: Math.exp(scoreActionHeuristic(state, seat, action)),
	}));

	const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
	if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
		return { kind: "action", action: legal[Math.floor(rng() * legal.length)]! };
	}

	let roll = rng() * totalWeight;
	for (const s of scored) {
		roll -= s.weight;
		if (roll <= 0) return { kind: "action", action: s.action };
	}
	return { kind: "action", action: scored[scored.length - 1]!.action };
}

// declining saves cash and avoids challenge_block risk; roughly mirrors decideBlock's willingness without importing personality.ts
const DECLINE_BLOCK_BASE_SCORE = 0.4;

// cheap type-driven heuristic score, centered near 0 for stable exp() softmax
function scoreActionHeuristic(
	state: FaceturnServerState,
	seat: string,
	action: FaceturnsAction,
): number {
	let score = ACTION_TYPE_BASE_WEIGHT[action.type] ?? 0.5;

	switch (action.type) {
		case "play_move":
		case "chain_play_burst":
		case "chain_play_slow": {
			const move = getMove(action.moveId);
			score += moveEffectsScore(move.effects.map(unwrapEffect));
			// favor cheaper plays to avoid cash dumping and stalling later
			score -= move.baseCost * 0.03;
			break;
		}

		case "declare_class_action": {
			if (action.action === "strike") score += 0.5;
			if (action.action === "collect") score += 0.3;
			if (action.action === "unturn") score += 0.15;
			break;
		}

		case "use_face_turn":
			score += 0.55;
			break;

		case "use_boss_command":
			score += 0.45;
			break;

		case "challenge":
			score += 0.4;
			break;

		case "block":
			score += 0.3;
			break;

		case "discard_active_move":
			score -= 0.3;
			break;

		default:
			break;
	}

	void state;
	void seat;
	return score;
}

function moveEffectsScore(effects: readonly EffectPrimitive[]): number {
	let score = 0;
	for (const effect of effects) {
		score += singleEffectScore(effect);
	}
	return score;
}

// coarse ranking; unlisted effects default to 0 because the action type weight already carries the signal
function singleEffectScore(effect: EffectPrimitive): number {
	switch (effect.type) {
		case "deal_damage":
		case "deal_damage_ignore_shield":
			return 0.35 + effect.amount * 0.01;
		case "deal_damage_per_face_up_ally":
			return 0.3 + effect.amountPerAlly * 0.01;
		case "deal_damage_percent_current_hp":
			return 0.3 + effect.percent * 0.01;
		case "deal_damage_per_discarded_variable":
		case "deal_damage_per_enemy_hand_discarded":
			return 0.25;
		case "strike_enemy_crew":
		case "strike_enemy_crew_blockable":
		case "strike_enemy_crew_unblockable_with_cash_cost":
			return 0.3;
		case "heal_boss":
			return 0.15 + effect.amount * 0.01;
		case "shield_boss":
			return 0.15 + effect.amount * 0.008;
		case "gain_cash":
			return 0.1 + effect.amount * 0.03;
		case "steal_cash":
			return 0.15 + effect.amount * 0.03;
		case "draw_cards":
			return 0.12 * effect.amount;
		case "discard_cards_from_hand":
			return -0.08 * effect.amount;
		case "discard_all_enemy_hand":
			return 0.25;
		case "turn_ally_crew":
			return 0.2;
		case "unturn_ally_crew":
			return 0.05;
		case "win_if_void_pieces_assembled":
			return 0.6;
		default:
			return 0;
	}
}

export function rollout(
	state: FaceturnServerState,
	rootSeat: string,
	maxDepth: number,
	helpers: EngineHelpers,
	rng: () => number = Math.random,
): number {
	let current = state;

	for (let ply = 0; ply < maxDepth; ply++) {
		if (isTerminal(current)) break;

		const seat = findActingSeat(current, helpers);
		if (!seat) break;

		const choice = sampleRolloutAction(current, seat, helpers, rng);
		if (choice.kind === "none") break;

		current =
			choice.kind === "decline_via_timeout"
				? applyTimerExpired(current)
				: applyAction(current, seat, choice.action);
	}

	return evaluate(current, rootSeat);
}

// probe all living seats because acting authority can differ from activePlayerId during interactions/windows
function findActingSeat(
	state: FaceturnServerState,
	helpers: EngineHelpers,
): string | null {
	for (const seatId of state.players.keys()) {
		if (state.eliminatedPlayers.has(seatId)) continue;
		if (getLegalActions(state, seatId, helpers).length > 0) return seatId;
	}
	return null;
}