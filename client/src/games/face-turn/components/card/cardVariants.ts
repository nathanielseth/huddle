import type { CrewClass, MoveType } from "@shared/games/face-turn/types";

export type CardVariant = CrewClass | MoveType | "boss" | "unknown";

export interface CardVariantTheme {
	readonly label: string;
	readonly accent: string;
	readonly accentSecondary: string;
	readonly cardBg: string;
	readonly badgeCircle: string;
	readonly titleBarBg: string;
	readonly titleBarPattern: string;
	readonly titleBarIconColor: string;
	readonly titleBarText: string;
	readonly textBoxBg: string;
	readonly textBoxText: string;
}

const NUMBER_BADGE = "#000000";
const CREW_BODY = "#EEEEEE";
const TITLE_BAR_DEFAULT = "#000000";
const TEXT_BOX_DEFAULT = "#000000";
const TEXT_ON_DARK = "#ffffff";
const TEXT_ON_LIGHT = "#000000";

function darken(hex: string, amount: number): string {
	const n = Number.parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 0xff;
	const g = (n >> 8) & 0xff;
	const b = n & 0xff;
	const scale = 1 - amount;
	const toHex = (c: number) =>
		Math.round(c * scale)
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const TITLE_BAR_ICON_DARKEN = 0.2;

function theme(
	base: Omit<
		CardVariantTheme,
		"titleBarPattern" | "titleBarIconColor" | "titleBarText" | "textBoxText"
	> & {
		titleBarText?: string;
		textBoxText?: string;
	},
): CardVariantTheme {
	const { titleBarText, textBoxText, ...rest } = base;
	return {
		...rest,
		titleBarPattern: darken(base.titleBarBg, 0.25),
		titleBarIconColor: darken(base.titleBarBg, TITLE_BAR_ICON_DARKEN),
		titleBarText: titleBarText ?? TEXT_ON_DARK,
		textBoxText: textBoxText ?? TEXT_ON_DARK,
	};
}

export const CARD_VARIANT_THEME: Record<CardVariant, CardVariantTheme> = {
	// crew classes
	striker: theme({
		label: "STRIKER",
		accent: "#FF5656",
		accentSecondary: "#FEA82F",
		cardBg: CREW_BODY,
		badgeCircle: "#C62828",
		titleBarBg: "#C62828",
		textBoxBg: TEXT_BOX_DEFAULT,
	}),
	defender: theme({
		label: "DEFENDER",
		accent: "#4C9EFF",
		accentSecondary: "#7FD1FF",
		cardBg: CREW_BODY,
		badgeCircle: "#175A9E",
		titleBarBg: "#175A9E",
		textBoxBg: TEXT_BOX_DEFAULT,
	}),
	collector: theme({
		label: "COLLECTOR",
		accent: "#3ECF8E",
		accentSecondary: "#FFD65C",
		cardBg: CREW_BODY,
		badgeCircle: "#287A4D",
		titleBarBg: "#287A4D",
		textBoxBg: TEXT_BOX_DEFAULT,
	}),
	hider: theme({
		label: "HIDER",
		accent: "#B26CFF",
		accentSecondary: "#FF6CD9",
		cardBg: CREW_BODY,
		badgeCircle: "#713F91",
		titleBarBg: "#713F91",
		textBoxBg: TEXT_BOX_DEFAULT,
	}),

	boss: theme({
		label: "BOSS",
		accent: "#FFC53D",
		accentSecondary: "#FF5656",
		cardBg: "#000000",
		badgeCircle: "#CF0A0A",
		titleBarBg: "#DC5F00",
		textBoxBg: "#EEEEEE",
		textBoxText: TEXT_ON_LIGHT,
	}),

	// move types
	active: theme({
		label: "ONGOING",
		accent: "#9B59B6",
		accentSecondary: "#4C9EFF",
		cardBg: "#9B59B6",
		badgeCircle: NUMBER_BADGE,
		titleBarBg: "#0d0614",
		textBoxBg: "#0d0614",
	}),
	burst: theme({
		label: "BURST",
		accent: "#2196F3",
		accentSecondary: "#FF5656",
		cardBg: "#2196F3",
		badgeCircle: NUMBER_BADGE,
		titleBarBg: "#050b14",
		textBoxBg: "#050b14",
	}),
	slow: theme({
		label: "SLOW",
		accent: "#5ac88b",
		accentSecondary: "#B26CFF",
		cardBg: "#3CB371",
		badgeCircle: NUMBER_BADGE,
		titleBarBg: "#051410",
		textBoxBg: "#051410",
	}),

	unknown: theme({
		label: "?",
		accent: "#5A6472",
		accentSecondary: "#3A4048",
		cardBg: CREW_BODY,
		badgeCircle: "#5A6472",
		titleBarBg: TITLE_BAR_DEFAULT,
		textBoxBg: TEXT_BOX_DEFAULT,
	}),
};