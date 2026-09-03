import {
	BOSS_DISPLAY_MAP,
	CREW_DISPLAY_MAP,
	MOVE_DISPLAY_MAP,
	type BossCardDisplay,
	type CrewCardDisplay,
	type MoveCardDisplay,
} from "@shared/games/face-turn/card-display";
import type { CardAbility, CardProps } from "./Card";
import type { CardVariant } from "./cardVariants";

export function bossToCard(boss: BossCardDisplay): CardProps {
	const abilities: CardAbility[] = [
		{
			id: "command",
			label: "Command",
			description: boss.effectText.command,
			tone: "command",
		},
		{
			id: "passive",
			label: "Passive",
			description: boss.effectText.passive,
			tone: "passive",
		},
	];

	return {
		variant: "boss",
		bossId: boss.id,
		title: boss.name,
		abilities,
		flavorText: boss.flavorText || undefined,
		artSrc: boss.artSrc,
		artAlt: boss.name,
		badgeText: String(boss.maxHp),
	};
}

export function crewToCard(crew: CrewCardDisplay): CardProps {
	const abilities: CardAbility[] = [];
	if (crew.effectText.revealed) {
		abilities.push({
			id: "revealed",
			label: "Revealed",
			description: crew.effectText.revealed,
			tone: "revealed",
		});
	}
	if (crew.effectText.passive) {
		abilities.push({
			id: "passive",
			label: "Passive",
			description: crew.effectText.passive,
			tone: "passive",
		});
	}

	return {
		variant: crew.class,
		title: crew.name,
		abilities,
		flavorText: crew.flavorText || undefined,
		artSrc: crew.artSrc,
		artAlt: crew.name,
	};
}

export const MOVE_TAG_LABEL: Record<MoveCardDisplay["moveType"], string> = {
	active: "Ongoing",
	burst: "Burst",
	slow: "Slow",
};

export function moveToCard(
	move: MoveCardDisplay,
	effectiveCost?: number,
): CardProps {
	const cost = effectiveCost ?? move.baseCost;
	const abilities: CardAbility[] = [
		{
			id: "cost",
			label: MOVE_TAG_LABEL[move.moveType],
			description: move.effectText,
			tone: "primary",
		},
	];

	const variant: CardVariant = move.moveType;

	return {
		variant,
		title: move.name,
		abilities,
		flavorText: move.flavorText || undefined,
		artSrc: move.artSrc,
		artAlt: move.name,
		badgeText: String(cost),
	};
}

export function cardIdToCard(id: string): CardProps | undefined {
	const boss = BOSS_DISPLAY_MAP.get(id);
	if (boss) return bossToCard(boss);
	const crew = CREW_DISPLAY_MAP.get(id);
	if (crew) return crewToCard(crew);
	const move = MOVE_DISPLAY_MAP.get(id);
	if (move) return moveToCard(move);
	return undefined;
}