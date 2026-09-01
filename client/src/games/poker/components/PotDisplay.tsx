// client/src/games/poker/components/PotDisplay.tsx
//
// Shows the total pot and side pots if more than one.
// Shared between host and player views.

import type { PotView } from "@shared/games/poker/index";

interface PotDisplayProps {
	pots: readonly PotView[];
}

export function PotDisplay({ pots }: PotDisplayProps) {
	const total = pots.reduce((s, p) => s + p.amount, 0);
	if (total === 0) return null;

	return (
		<div className="flex items-center gap-2">
			<span className="text-[10px] font-bold tracking-widest uppercase text-white/30">
				Pot
			</span>
			<span className="font-display text-xl font-black text-white tabular-nums">
				₱{total}
			</span>
			{pots.length > 1 && (
				<span className="text-[10px] text-white/30">({pots.length} pots)</span>
			)}
		</div>
	);
}