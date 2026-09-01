import type { PhaseActionHandler } from "./types";
import { noOpResult } from "./types";
import { FACETURN_CONSTANTS as C } from "../types";
import type { ServerPendingAction } from "../types";
import { getCrew, getMove, unwrapEffect } from "../cards";
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
	validateMoveTargetScope,
} from "../effects";
import {
	makeResult,
	afterAction,
	buildStrikeResolution,
} from "../action-results";
import { pushLog } from "../log";

export const activeTurnAction: PhaseActionHandler = (
	state,
	player,
	playerId,
	action,
	ctx,
) => {
	const noOp = () => noOpResult(state, ctx);
	// rejectPlay surfaces validation reasons to the acting player, unlike bare noOp which hides them
	const rejectPlay = (reason: string) =>
		noOpResult(state, ctx, { rejectedFor: playerId, reason });

	if (playerId !== state.activePlayerId) return noOp();

	switch (action.type) {
		case "play_move": {
			const { moveId } = action;
			if (!player.hand.includes(moveId))
				return rejectPlay("That card isn't in your hand.");

			const move = getMove(moveId);
			const cost = effectiveCost(state, player, moveId);
			if (player.cash < cost)
				return rejectPlay(
					`Not enough cash — this move costs ₱${cost}, you have ₱${player.cash}.`,
				);

			if (!moveHasLegalTarget(state, playerId, move))
				return rejectPlay("No legal target for this move right now.");

			if (
				move.moveType === "active" &&
				player.activeMoves.findIndex((s) => s === null) === -1
			) {
				return rejectPlay("Your active move slots are full.");
			}

			const scopeCheck = validateMoveTargetScope(
				state,
				playerId,
				move,
				action.targetPlayerId,
			);
			if (!scopeCheck.ok) return rejectPlay(scopeCheck.reason!);

			const isDefendableStrike = move.effects.some((e) => {
				const eff = unwrapEffect(e);
				return eff.type === "strike_enemy_crew_defendable";
			});

			if (isDefendableStrike) {
				if (!action.targetPlayerId)
					return rejectPlay("This strike needs an enemy target.");
				const targetIsEnemy = getEnemies(state, playerId).some(
					(e) => e.playerId === action.targetPlayerId,
				);
				if (!targetIsEnemy)
					return rejectPlay("This strike can only target an enemy.");

				if (action.targetCrewSlot !== undefined) {
					const ambushTarget = state.players.get(action.targetPlayerId)!;
					const slot = action.targetCrewSlot as 0 | 1;
					// face-down turns, face-up kills
					if (!ambushTarget.crewIds[slot]) {
						return rejectPlay("That crew slot is empty.");
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
					cashCost: cost,
				});
				// playing a slow move — even the opening one — hands
				// priority straight to the other participant (see
				// openMoveChain). They now need to actually respond, so
				// this opens a real response window, same as any later
				// push does.
				return makeResult(state, C.MOVE_CHAIN_WINDOW_MS);
			}

			executeMove(state, player, moveId, {
				targetCrewSlot: action.targetCrewSlot,
				targetAllySlot: action.targetAllySlot,
				targetPlayerId: action.targetPlayerId,
				targetActiveMoveSlot: action.targetActiveMoveSlot,
				placeInActiveSlot: action.placeInActiveSlot,
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

			let hideTargetPlayer = player;
			if (action.action === "hide") {
				if (action.targetPlayerId && action.targetPlayerId !== playerId) {
					const isTeammate = getTeammates(state, playerId).some(
						(t) => t.playerId === action.targetPlayerId,
					);
					if (!isTeammate) return noOp();
					hideTargetPlayer = state.players.get(action.targetPlayerId)!;
				}

				if (action.targetAllySlot !== undefined) {
					const slot = action.targetAllySlot as 0 | 1;
					if (
						!hideTargetPlayer.crewIds[slot] ||
						!hideTargetPlayer.crewTurned[slot]
					)
						return noOp();
				} else {
					if (firstTurnedSlot(hideTargetPlayer) === null) return noOp();
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
					: action.action === "hide" && hideTargetPlayer.playerId !== playerId
						? hideTargetPlayer.playerId
						: null;

			const actorWasBluffing = wouldBeBluffing;

			pushLog(state, {
				kind: "class_action_declared",
				actorId: playerId,
				action: action.action,
				targetPlayerId,
			});

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
					turnCrewAtSlot(state, targetPlayer, slot, playerId, {
						reason: "boss_command",
						bossId: boss.id,
					});
					recomputePassives(targetPlayer, state);
					triggerCrewTurnedEffects(state, targetPlayer, slot);
				}

				pushLog(state, {
					kind: "boss_command_used",
					actorId: playerId,
					bossId: boss.id,
					targetPlayerId: targetPlayer.playerId,
					succeeded: matches,
				});

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

				pushLog(state, {
					kind: "boss_command_used",
					actorId: playerId,
					bossId: boss.id,
					targetPlayerId: null,
					succeeded: null,
				});

				// reserveCrewId is secret-only; resync needed to prevent stale view
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

			pushLog(state, {
				kind: "boss_command_used",
				actorId: playerId,
				bossId: boss.id,
				targetPlayerId: action.targetPlayerId ?? null,
				succeeded: null,
			});

			// boss commandEffects may mutate secret fields; always resync to avoid stale view
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
				{ reason: "face_turn" },
				action.targetCrewSlot as 0 | 1 | undefined,
			);

			if (outcome.outcome === "negated") {
				player.cash += cost;
			}

			if (outcome.outcome !== "pending") {
				state.lastResolution = buildStrikeResolution(
					state,
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
			return afterAction(state);
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