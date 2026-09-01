// ============================================================================
// Pure logic for the target-scope audit — verifies the client-facing
// targeting tables in shared/games/face-turn/card-display.ts
// (MOVE_TARGET_KIND, MOVE_POST_PLACEMENT_TARGET) against the single
// per-effect source of truth in cards.ts (EFFECT_TARGETING,
// EFFECT_REQUIRES_CREW), instead of trusting that two hand-authored tables
// happen to agree.
//
// This module holds ONLY the derivation/comparison logic, with no CLI
// concerns (no console.log, no process.exitCode) so it can be imported both
// by scripts/faceturn-sim/audit-target-scope.ts (human-run, from `server/`)
// and by __tests__/target-scope-audit.test.ts (vitest, runs in CI on every
// push — see that test file for why a CLI script alone isn't enough to keep
// this from silently going stale). Keeping exactly one copy of this logic
// matters here specifically: a second, subtly-different copy of
// deriveExpectedKind/KNOWN_ROUTING_OVERRIDES living in the test file would
// be exactly the kind of two-tables-that-can-drift problem this whole
// migration exists to eliminate.
//
// See audit-target-scope.ts for the full rationale on WHY this audit exists
// and HOW TO READ a failure — that header comment still applies in full;
// only the mechanics moved here.
// ============================================================================

import {
	EFFECT_TARGETING,
	MOVES,
	unwrapEffect,
	type EffectTargeting,
} from "./cards";
import {
	MOVE_TARGET_KIND,
	MOVE_POST_PLACEMENT_TARGET,
	MOVE_DISPLAY,
	type MoveTargetKind,
} from "../../../../shared/games/face-turn/card-display";

// ----------------------------------------------------------------------
// derive the "naive" expected primary-drop kind for a move from its
// effects' EFFECT_TARGETING, before any routing override is applied. A
// move can carry multiple effects; enemy scope wins over ally (mirrors
// getMoveTargetScope's own "enemy takes priority" tie-break), and within
// enemy/ally scope, the FIRST effect that actually has a real slot wins —
// matches how every real multi-effect move in the card database only ever
// has one targetable effect among several (e.g. kamikaze: turn_ally_crew
// (self, no client target) + deal_damage (enemy_boss) -> derives
// enemy_boss, matching its real MOVE_TARGET_KIND).
// ----------------------------------------------------------------------
export function deriveExpectedKind(
	effectsTargeting: readonly EffectTargeting[],
): MoveTargetKind | null {
	const enemy = effectsTargeting.find((t) => t.scope === "enemy");
	if (enemy && enemy.scope === "enemy") {
		switch (enemy.slot) {
			case "boss":
				return "enemy_boss";
			case "crew":
				return "enemy_crew";
			case "active":
				return "enemy_active";
			case "player":
				return "enemy_player";
		}
	}

	const ally = effectsTargeting.find((t) => t.scope === "ally");
	if (ally && ally.scope === "ally") {
		if (ally.strict) return "ally_teammate";
		switch (ally.slot) {
			case "boss":
			case "player":
				return "ally_player";
			case "crew":
				return "ally_crew";
		}
	}

	// EffectTargeting's "self" means the handler reads NO client-suppliable
	// target field at all — always ctx.actor, unconditionally (see
	// EFFECT_TARGETING's own header comment: distinct from "ally" scope
	// with self as merely the default). That's "no_target" at the
	// MoveTargetKind level too: there is nothing for the client to pick,
	// the primary drop just needs to land on the actor's own board. This is
	// NOT the same thing as the MoveTargetKind "ally_self" case (self ONLY,
	// but a real field is still read/validated) — card-display.ts's own
	// history shows both of switch-up and neetos-clock previously had
	// "ally_self" here and it was a live bug, fixed to "no_target" for
	// exactly this reason. So "self" scope always derives "no_target", and
	// "ally_self" is never derived by this function — if some future
	// effect's handler genuinely needs that narrower distinction, it
	// belongs in KNOWN_ROUTING_OVERRIDES with a comment, not as a silent
	// derivation default here.
	if (effectsTargeting.some((t) => t.scope === "self")) return "no_target";

	// every effect on this move is scope "none" -> no client target at all
	if (effectsTargeting.length > 0) return "no_target";

	return null;
}

// ----------------------------------------------------------------------
// known, deliberate routing overrides — moves whose naive derived kind
// does NOT match their real MOVE_TARGET_KIND, because the real pick is
// supplied through a different client flow (armed post-placement pick,
// or an auto-resolve + pendingInteraction fallback) rather than the
// primary drop. Each entry traces exactly why, against the same real files
// cited in card-display.ts's own comments — this audit does not take
// card-display.ts's word for it uncritically; every one of these was
// independently re-verified against useArmedMove.ts / PlayMoveSection.tsx
// / effects/*.ts while writing this module.
// ----------------------------------------------------------------------
export const KNOWN_ROUTING_OVERRIDES: Readonly<Record<string, MoveTargetKind>> =
	{
		// mark_enemy_crew_for_delayed_turn derives "enemy_crew" naively, but the
		// real enemy-crew pick happens entirely through the ARMED secondary
		// pick (MOVE_POST_PLACEMENT_TARGET["warrant-of-arrest"] = required
		// enemy_crew) — the primary drop only needs to land on the actor's own
		// board to open the picker. Verified: useArmedMove.ts's header comment
		// lists warrant-of-arrest as 1 of only 4 moves that ever arm.
		"warrant-of-arrest": "no_target",
		// passive_poison_per_round derives "enemy_player" naively (it reads
		// ctx.targetPlayerId when supplied), but the primary drop for
		// poison-breath is deliberately "no_target": the target is OPTIONAL
		// (MOVE_POST_PLACEMENT_TARGET["poison-breath"] has required: false) —
		// the handler auto-resolves to the sole enemy in a 1v1, or opens
		// poison_target_pick pendingInteraction with 3+ players if no target
		// was supplied. Verified against effects/damage.ts's
		// passive_poison_per_round handler directly, not just card-display.ts's
		// own comment.
		"poison-breath": "no_target",
	};

// sabotage is NOT in the override list above: its naive derived kind
// (enemy_active, from discard_targeted_enemy_active_move) DOES match its
// real MOVE_TARGET_KIND directly — no routing needed, both target fields
// arrive from the one primary drop. Asserted explicitly by the test suite
// so a future change that accidentally re-adds a MOVE_POST_PLACEMENT_TARGET
// entry for sabotage (the exact historical bug PlayMoveSection.tsx's
// comment describes — an "enemy_active"-scoped post-placement entry that
// could never be completed by any tap) gets caught immediately by
// findEnemyActivePostPlacementFindings below.

export interface AuditFinding {
	moveId: string;
	message: string;
}

// MOVE_TARGET_KIND vs derived-from-EFFECT_TARGETING, plus stale-override
// detection.
export function findMoveTargetKindFindings(): AuditFinding[] {
	const findings: AuditFinding[] = [];

	for (const move of MOVES) {
		const effectsTargeting = move.effects.map(
			(e) => EFFECT_TARGETING[unwrapEffect(e).type],
		);
		const derived = deriveExpectedKind(effectsTargeting);
		const actual = MOVE_TARGET_KIND[move.id];

		if (actual === undefined) {
			findings.push({
				moveId: move.id,
				message: `missing from MOVE_TARGET_KIND entirely (derived: ${derived ?? "no effects"})`,
			});
			continue;
		}

		const override = KNOWN_ROUTING_OVERRIDES[move.id];
		if (override !== undefined) {
			if (actual !== override) {
				findings.push({
					moveId: move.id,
					message:
						`KNOWN_ROUTING_OVERRIDES says "${override}" but MOVE_TARGET_KIND ` +
						`says "${actual}" — override entry is stale, update one or the other`,
				});
			}
			continue;
		}

		if (derived !== null && derived !== actual) {
			findings.push({
				moveId: move.id,
				message:
					`MOVE_TARGET_KIND says "${actual}" but EFFECT_TARGETING derives ` +
					`"${derived}" from its effects — if this move deliberately routes ` +
					`its real target through the armed post-placement flow, add it to ` +
					`KNOWN_ROUTING_OVERRIDES with a comment tracing why (see ` +
					`warrant-of-arrest); otherwise this is a real mismatch`,
			});
		}
	}

	return findings;
}

// MOVE_POST_PLACEMENT_TARGET sanity: every entry's scope should be
// reachable given what MOVE_TARGET_KIND says about the move's primary
// drop, per postPlacementLegality.ts's own documented invariant:
// "enemy_active" scope can never be completed by any tap (no active-slot
// equivalent of the armed crew-slot picker exists), so a post-placement
// entry with that scope is always a bug — this is exactly the sabotage
// regression PlayMoveSection.tsx's comment describes.
export function findEnemyActivePostPlacementFindings(): AuditFinding[] {
	const findings: AuditFinding[] = [];

	for (const [moveId, target] of Object.entries(MOVE_POST_PLACEMENT_TARGET)) {
		if (target === null) continue;
		if (target.scope === "enemy_active") {
			findings.push({
				moveId,
				message:
					`MOVE_POST_PLACEMENT_TARGET scope "enemy_active" can never be ` +
					`completed by any tap (no active-slot armed picker exists) — this ` +
					`card would arm on drop and sit stuck forever. Remove this entry; ` +
					`the primary drop's own MOVE_TARGET_KIND should be "enemy_active" ` +
					`instead if that's the real target (see sabotage).`,
			});
		}
	}

	return findings;
}

// coverage: every move in MOVE_DISPLAY needs a MOVE_TARGET_KIND entry, or
// getMoveTargetKind throws mid-drag at runtime the first time a real
// player picks up that card.
export function findMoveTargetKindCoverageFindings(): AuditFinding[] {
	const findings: AuditFinding[] = [];

	for (const display of MOVE_DISPLAY) {
		if (MOVE_TARGET_KIND[display.id] === undefined) {
			findings.push({
				moveId: display.id,
				message: "in MOVE_DISPLAY but missing from MOVE_TARGET_KIND",
			});
		}
	}

	return findings;
}

export function runTargetScopeAudit(): AuditFinding[] {
	return [
		...findMoveTargetKindFindings(),
		...findEnemyActivePostPlacementFindings(),
		...findMoveTargetKindCoverageFindings(),
	];
}