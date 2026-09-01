import type { ComponentType } from "react";
import type { CardVariant } from "./cardVariants";
import {
	SwordIcon,
	ShieldIcon,
	CoinIcon,
	SwapIcon,
	CrownIcon,
	LoopIcon,
	BurstIcon,
	HourglassIcon,
	QuestionMarkIcon,
	type IconProps,
} from "./CardIcons";

export const CARD_VARIANT_ICON: Record<
	CardVariant,
	ComponentType<IconProps>
> = {
	striker: SwordIcon,
	defender: ShieldIcon,
	collector: CoinIcon,
	hider: SwapIcon,
	boss: CrownIcon,
	active: LoopIcon,
	burst: BurstIcon,
	slow: HourglassIcon,
	unknown: QuestionMarkIcon,
};