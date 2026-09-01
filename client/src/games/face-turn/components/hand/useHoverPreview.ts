import { useRef } from "react";
import type { CardProps } from "../card/Card";
import {
	setCardHoverPreview,
	clearCardHoverPreview,
} from "./cardHoverPreviewStore";

// shared hover preview handlers for board cards; token based because call sites rebuild props each render
export function useHoverPreview(cardProps: CardProps | null) {
	const tokenRef = useRef<number | null>(null);

	if (!cardProps) return undefined;

	return {
		onPointerEnter: () => {
			tokenRef.current = setCardHoverPreview(cardProps);
		},
		onPointerLeave: () => {
			if (tokenRef.current !== null) {
				clearCardHoverPreview(tokenRef.current);
				tokenRef.current = null;
			}
		},
	};
}