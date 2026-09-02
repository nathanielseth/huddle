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

// derive the naive primary kind from effects before overrides.
// enemy scope wins over ally, first effect with a real slot wins within same scope.
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

	// "self" scope means handler reads no client target, so "no_target"
	if (effectsTargeting.some((t) => t.scope === "self")) return "no_target";

	if (effectsTargeting.length > 0) return "no_target";

	return null;
}

// deliberate routing overrides where primary drop is not the real target.
// each entry traces to the actual client flow: armed secondary pick or optional target with pendingInteraction.
export const KNOWN_ROUTING_OVERRIDES: Readonly<Record<string, MoveTargetKind>> =
	{
		// warrant-of-arrest: enemy crew pick via armed secondary pick
		"warrant-of-arrest": "no_target",
		// poison-breath: target optional, auto-resolves or opens pendingInteraction
		"poison-breath": "no_target",
	};

export interface AuditFinding {
	moveId: string;
	message: string;
}

// compare derived kind against actual MOVE_TARGET_KIND, flag mismatches and stale overrides.
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

// post-placement scopes that can never be completed by any tap because no armed picker exists for them.
const UNREACHABLE_POST_PLACEMENT_SCOPES = new Set([
	"enemy_active",
	"enemy_player",
]);

export function findEnemyActivePostPlacementFindings(): AuditFinding[] {
	const findings: AuditFinding[] = [];

	for (const [moveId, target] of Object.entries(MOVE_POST_PLACEMENT_TARGET)) {
		if (target === null) continue;
		if (UNREACHABLE_POST_PLACEMENT_SCOPES.has(target.scope)) {
			findings.push({
				moveId,
				message:
					`MOVE_POST_PLACEMENT_TARGET scope "${target.scope}" can never be ` +
					`completed by any tap (no armed picker exists for this scope) — this ` +
					`card would arm on drop and sit stuck forever. Remove this entry; ` +
					`either the primary drop's own MOVE_TARGET_KIND should carry this ` +
					`scope instead if it's a required target (see sabotage), or, if the ` +
					`target is optional and resolved server-side, this move needs no ` +
					`post-placement entry at all (see poison-breath).`,
			});
		}
	}

	return findings;
}

// every move in MOVE_DISPLAY needs a MOVE_TARGET_KIND entry or getMoveTargetKind throws mid-drag.
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