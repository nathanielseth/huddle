import type { BoardTarget } from "./boardTargetRegistry";

// own board
export function crewReactivateTargets(
	eligibleSlots: readonly number[],
	responderId: string,
): BoardTarget[] {
	return eligibleSlots.map((slotIndex) => ({
		kind: "crew",
		playerId: responderId,
		slotIndex,
	}));
}

// target's board
export function chooseCrewToTurnTargets(
	eligibleSlots: readonly number[],
	targetPlayerId: string,
): BoardTarget[] {
	return eligibleSlots.map((slotIndex) => ({
		kind: "crew",
		playerId: targetPlayerId,
		slotIndex,
	}));
}

// target's board
export function tacticalSupportHideTargets(
	eligibleSlots: readonly number[],
	targetPlayerId: string,
): BoardTarget[] {
	return eligibleSlots.map((slotIndex) => ({
		kind: "crew",
		playerId: targetPlayerId,
		slotIndex,
	}));
}

// own board (target reveals own crew)
export function truthSerumRevealTargets(
	eligibleSlots: readonly number[],
	responderId: string,
): BoardTarget[] {
	return eligibleSlots.map((slotIndex) => ({
		kind: "crew",
		playerId: responderId,
		slotIndex,
	}));
}

// target's board
export function backgroundCheckTargets(
	eligibleSlots: readonly number[],
	targetPlayerId: string,
): BoardTarget[] {
	return eligibleSlots.map((slotIndex) => ({
		kind: "crew",
		playerId: targetPlayerId,
		slotIndex,
	}));
}

// both phases on own board
export function switchUpTargets(
	slots: readonly number[],
	responderId: string,
): BoardTarget[] {
	return slots.map((slotIndex) => ({
		kind: "crew",
		playerId: responderId,
		slotIndex,
	}));
}

// phase one on own board
export function tagOutOwnTargets(
	ownEligibleSlots: readonly number[],
	responderId: string,
): BoardTarget[] {
	return ownEligibleSlots.map((slotIndex) => ({
		kind: "crew",
		playerId: responderId,
		slotIndex,
	}));
}
// phase two on teammate's board
export function tagOutTeammateTargets(
	teammateEligibleSlots: readonly number[],
	teammateId: string,
): BoardTarget[] {
	return teammateEligibleSlots.map((slotIndex) => ({
		kind: "crew",
		playerId: teammateId,
		slotIndex,
	}));
}

// cross-player targets already on the wire
export function targetedSlotsToPickerTargets(
	eligibleTargets: readonly { playerId: string; slot: number }[],
): BoardTarget[] {
	return eligibleTargets.map((t) => ({
		kind: "crew",
		playerId: t.playerId,
		slotIndex: t.slot,
	}));
}

// always the fixed 2 slots, server re-validates
export function razorTargets(targetPlayerId: string): BoardTarget[] {
	return [0, 1].map((slotIndex) => ({
		kind: "crew",
		playerId: targetPlayerId,
		slotIndex,
	}));
}

// own face-up slots only
export function dealerTargets(
	faceUpSlotIndexes: readonly number[],
	selfPlayerId: string,
): BoardTarget[] {
	return faceUpSlotIndexes.map((slotIndex) => ({
		kind: "crew",
		playerId: selfPlayerId,
		slotIndex,
	}));
}

// any occupied slot, face-down turns, face-up kills
export function strikeTargets(
	occupiedSlotIndexes: readonly number[],
	targetPlayerId: string,
): BoardTarget[] {
	return occupiedSlotIndexes.map((slotIndex) => ({
		kind: "crew",
		playerId: targetPlayerId,
		slotIndex,
	}));
}

// own face-up crew
export function hideTargets(
	faceUpSlotIndexes: readonly number[],
	hideTargetPlayerId: string,
): BoardTarget[] {
	return faceUpSlotIndexes.map((slotIndex) => ({
		kind: "crew",
		playerId: hideTargetPlayerId,
		slotIndex,
	}));
}

// boss cell as a picker target (TurnActionBar's exposed-boss follow-up)
export function bossTarget(targetPlayerId: string): BoardTarget {
	return { kind: "boss", playerId: targetPlayerId };
}
