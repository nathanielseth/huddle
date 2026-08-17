import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { ServerPendingAction } from "../types";
import { getCrew, getMove, getMoveTargetScope, unwrapEffect } from "../cards";
import {
	effectiveCost,
	computeActorWasBluffing,
	getClassActionCost,
	computeChallengeEligible,
	swapTurn,
	executeMove,
	openMoveChain,
	getBoss,
} from "../game";
import {
	resolveEffects,
	triggerCrewTurnedEffects,
	recomputePassives,
	getEnemies,
	getTeammates,
	firstTurnedSlot,
	firstUnturnedSlot,
	turnCrewAtSlot,
	sellMoveFromHand,
	resolveStrikeOrExecute,
	isStrikeDefendedByTerminal,
	getLivingPlayers,
	moveHasLegalTarget,
} from "../effects";
import { makeResult, afterAction, buildStrikeResolution } from "../index";

export const activeTurnAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	const noOp = () => noOpResult(state, ctx);

	if (playerId !== state.activePlayerId) return noOp();

	switch (action.type) {
		case "play_move": {
			const { moveId } = action;
			if (!player.hand.includes(moveId)) return noOp();

			const move = getMove(moveId);
			const cost = effectiveCost(state, player, moveId);
			if (player.cash < cost) return noOp();

			if (!moveHasLegalTarget(state, playerId, move)) return noOp();

			if (
				move.moveType === "active" &&
				player.activeMoves.findIndex((s) => s === null) === -1
			) {
				return noOp();
			}

			if (action.targetPlayerId) {
				const scope = getMoveTargetScope(move);
				if (scope === "enemy") {
					const targetIsEnemy = getEnemies(state, playerId).some(
						(e) => e.playerId === action.targetPlayerId,
					);
					if (!targetIsEnemy) return noOp();
				} else if (scope === "ally") {
					const isValidAlly =
						action.targetPlayerId === playerId ||
						getTeammates(state, playerId).some(
							(t) => t.playerId === action.targetPlayerId,
						);
					if (!isValidAlly) return noOp();
				} else {
					return noOp();
				}
			}

			const isDefendableStrike = move.effects.some((e) => {
				const eff = unwrapEffect(e);
				return eff.type === "strike_enemy_crew_defendable";
			});

			if (isDefendableStrike) {
				if (!action.targetPlayerId) return noOp();
				const targetIsEnemy = getEnemies(state, playerId).some(
					(e) => e.playerId === action.targetPlayerId,
				);
				if (!targetIsEnemy) return noOp();

				if (action.targetCrewSlot !== undefined) {
					const ambushTarget = state.players.get(action.targetPlayerId)!;
					const slot = action.targetCrewSlot as 0 | 1;
					// either a face-down crew (turns it) or a face-up crew
					// (kills it) is a legal target for a strike
					if (!ambushTarget.crewIds[slot]) {
						return noOp();
					}
				}

				player.hand.splice(player.hand.indexOf(moveId), 1);
				player.cash -= cost;
				player.discardPile.push(moveId);
				player.totalCardsDiscarded++;
				player.totalMovesPlayed++;
				player.playedMoveThisTurn = true;

				state.pendingAction = {
					type: "card_strike",
					actorId: playerId,
					targetCrewSlot: action.targetCrewSlot ?? null,
					targetAllySlot: null,
					moveId,
					cashCost: cost,
					declaredClass: null,
					actorWasBluffing: false,
					targetPlayerId: action.targetPlayerId,
					originalActionType: null,
				};

				state.phase = "defend_window";
				return makeResult(state, C.DEFEND_WINDOW_MS);
			}

			player.hand.splice(player.hand.indexOf(moveId), 1);
			player.cash -= cost;

			if (move.moveType === "slow") {
				const responderId =
					action.targetPlayerId ?? getEnemies(state, playerId)[0]?.playerId;
				if (!responderId) {
					executeMove(state, player, moveId, {
						targetCrewSlot: action.targetCrewSlot,
						targetAllySlot: action.targetAllySlot,
						targetPlayerId: action.targetPlayerId,
					});
					return afterAction(state);
				}
				openMoveChain(state, playerId, responderId, {
					moveId,
					actorId: playerId,
					targetCrewSlot: action.targetCrewSlot ?? null,
					targetAllySlot: action.targetAllySlot ?? null,
					targetPlayerId: action.targetPlayerId ?? null,
				});
				return makeResult(state, C.MOVE_CHAIN_WINDOW_MS);
			}

			executeMove(state, player, moveId, {
				targetCrewSlot: action.targetCrewSlot,
				targetAllySlot: action.targetAllySlot,
				targetPlayerId: action.targetPlayerId,
				targetActiveMoveSlot: action.targetActiveMoveSlot,
			});
			return afterAction(state);
		}

		case "declare_class_action": {
			if ((action.action as string) === "defend") return noOp();
			if (player.classActionUsedThisTurn) return noOp();

			if (action.action === "strike") {
				if (!action.targetPlayerId) return noOp();
				const targetIsEnemy = getEnemies(state, playerId).some(
					(e) => e.playerId === action.targetPlayerId,
				);
				if (!targetIsEnemy) return noOp();
				const strikeTarget = state.players.get(action.targetPlayerId)!;
				if (isStrikeDefendedByTerminal(strikeTarget)) return noOp();
			}

			let unturnTargetPlayer = player;
			if (action.action === "unturn") {
				if (action.targetPlayerId && action.targetPlayerId !== playerId) {
					const isTeammate = getTeammates(state, playerId).some(
						(t) => t.playerId === action.targetPlayerId,
					);
					if (!isTeammate) return noOp();
					unturnTargetPlayer = state.players.get(action.targetPlayerId)!;
				}

				if (action.targetAllySlot !== undefined) {
					const slot = action.targetAllySlot as 0 | 1;
					if (
						!unturnTargetPlayer.crewIds[slot] ||
						!unturnTargetPlayer.crewTurned[slot]
					)
						return noOp();
				} else {
					if (firstTurnedSlot(unturnTargetPlayer) === null) return noOp();
				}
			}

			const wouldBeBluffing = computeActorWasBluffing(player, action.action);
			if (wouldBeBluffing && firstUnturnedSlot(player) === null) {
				return noOp();
			}

			const cost = getClassActionCost(player, action.action);
			if (player.cash < cost) return noOp();

			player.cash -= cost;
			player.classActionUsedThisTurn = true;

			const targetPlayerId =
				action.action === "strike"
					? (action.targetPlayerId ?? null)
					: action.action === "unturn" &&
						  unturnTargetPlayer.playerId !== playerId
						? unturnTargetPlayer.playerId
						: null;

			const actorWasBluffing = wouldBeBluffing;

			state.pendingAction = {
				type: `class_action_${action.action}` as ServerPendingAction["type"],
				actorId: playerId,
				targetCrewSlot: action.targetCrewSlot ?? null,
				targetAllySlot: action.targetAllySlot ?? null,
				moveId: null,
				cashCost: cost,
				declaredClass: action.action,
				actorWasBluffing,
				targetPlayerId,
				originalActionType: null,
			};

			state.challengeEligiblePlayerIds = computeChallengeEligible(
				state,
				playerId,
				targetPlayerId,
			);

			state.phase = "challenge_window";
			return makeResult(state, C.CHALLENGE_WINDOW_MS);
		}

		case "use_boss_command": {
			if (player.bossCommandUsed) return noOp();

			const boss = getBoss(player.bossId);

			if (boss.hasCustomCommandLogic && boss.id === "the-razor") {
				if (!action.guessClass || action.targetCrewSlot === undefined)
					return noOp();
				const targetPlayer = action.targetPlayerId
					? state.players.get(action.targetPlayerId)
					: getEnemies(state, playerId)[0];
				if (!targetPlayer) return noOp();

				const targetIsEnemy = getEnemies(state, playerId).some(
					(e) => e.playerId === targetPlayer.playerId,
				);
				if (!targetIsEnemy) return noOp();

				const slot = action.targetCrewSlot as 0 | 1;
				const targetId = targetPlayer.crewIds[slot];
				if (!targetId || targetPlayer.crewTurned[slot]) return noOp();

				player.bossCommandUsed = true;

				const crew = getCrew(targetId);
				const overrides = targetPlayer.derived.crewClassOverrides.get(slot);
				const matches =
					overrides?.has(action.guessClass) || crew.class === action.guessClass;
				if (matches) {
					turnCrewAtSlot(state, targetPlayer, slot);
					recomputePassives(targetPlayer, state);
					triggerCrewTurnedEffects(state, targetPlayer, slot);
				}

				return afterAction(state);
			}

			if (boss.hasCustomCommandLogic && boss.id === "the-dealer") {
				if (player.reserveCrewId === null) return noOp();

				const foundSlot =
					action.targetAllySlot !== undefined
						? (action.targetAllySlot as 0 | 1)
						: (([0, 1] as const).find(
								(i) => player.crewIds[i] !== null && player.crewTurned[i],
							) ?? null);

				if (foundSlot === null) return noOp();
				const targetSlot = foundSlot;
				if (!player.crewIds[targetSlot] || !player.crewTurned[targetSlot])
					return noOp();

				player.bossCommandUsed = true;
				player.crewIds[targetSlot] = player.reserveCrewId;
				player.crewTurned[targetSlot] = false;
				player.derived.crewClassOverrides.delete(targetSlot);
				player.disabledPassiveSlots.delete(targetSlot);
				player.reserveCrewId = null;
				recomputePassives(player, state);

				return afterAction(state);
			}

			if (boss.hasCustomCommandLogic) {
				throw new Error(
					`[face-turn] boss "${boss.id}" declares hasCustomCommandLogic ` +
						`but engine.ts has no matching use_boss_command branch`,
				);
			}

			if (action.targetPlayerId) {
				const targetIsEnemy = getEnemies(state, playerId).some(
					(e) => e.playerId === action.targetPlayerId,
				);
				if (!targetIsEnemy) return noOp();
			}

			player.bossCommandUsed = true;

			resolveEffects(boss.commandEffects, {
				state,
				actor: player,
				targetCrewSlot: action.targetCrewSlot,
				targetPlayerId: action.targetPlayerId,
			});

			return afterAction(state);
		}

		case "use_face_turn": {
			const cost = C.BOSS_FACE_TURN_COST;
			if (player.cash < cost) return noOp();

			const targetId = action.targetPlayerId;
			const targetPlayer = state.players.get(targetId);
			if (!targetPlayer || state.eliminatedPlayers.has(targetId)) return noOp();

			const targetIsEnemy = getEnemies(state, playerId).some(
				(e) => e.playerId === targetId,
			);
			if (!targetIsEnemy) return noOp();

			player.cash -= cost;

			const outcome = resolveStrikeOrExecute(
				state,
				targetPlayer,
				playerId,
				true,
				action.targetCrewSlot as 0 | 1 | undefined,
			);

			if (outcome.outcome === "negated") {
				player.cash += cost;
			}

			if (outcome.outcome !== "pending") {
				state.lastResolution = buildStrikeResolution(
					outcome,
					playerId,
					targetId,
					"face_turn",
				);
			}

			return afterAction(state);
		}

		case "end_turn": {
			swapTurn(state);
			return afterAction(state, { includePrivatePayloads: true });
		}

		case "discard_active_move": {
			const slot = action.slotIndex as 0 | 1 | 2;
			const moveId = player.activeMoves[slot];
			if (!moveId) return noOp();
			const wasGlobalDisable = getMove(moveId).effects.some((e) => {
				const eff = unwrapEffect(e);
				return eff.type === "passive_disable_all_crew_skills";
			});
			player.activeMoves[slot] = null;
			player.trickleDownTargets.delete(slot);
			player.discardPile.push(moveId);
			player.totalCardsDiscarded++;
			recomputePassives(player, state);
			if (wasGlobalDisable) {
				for (const p of getLivingPlayers(state)) {
					if (p.playerId !== player.playerId) recomputePassives(p, state);
				}
			}
			return makeResult(state, ctx.room.timer?.duration ?? null);
		}

		case "sell_move": {
			if (!player.derived.hasSellCards) return noOp();
			const sold = sellMoveFromHand(state, player, action.moveId);
			if (!sold) return noOp();
			return makeResult(state, ctx.room.timer?.duration ?? null);
		}

		default:
			return noOp();
	}
};