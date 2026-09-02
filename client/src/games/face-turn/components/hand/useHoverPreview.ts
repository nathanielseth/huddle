import { useEffect, useRef } from "react";
import type { CardProps } from "../card/Card";
import {
	setCardHoverPreview,
	clearCardHoverPreview,
} from "./cardHoverPreviewStore";

// shared hover preview handlers for board cards
export function useHoverPreview(cardProps: CardProps | null) {
	const tokenRef = useRef<number | null>(null);

	// clears a lingering preview if this card unmounts while still hovered
	useEffect(() => {
		return () => {
			if (tokenRef.current !== null) {
				clearCardHoverPreview(tokenRef.current);
				tokenRef.current = null;
			}
		};
	}, []);

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