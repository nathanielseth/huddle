import { CARD_VARIANT_THEME } from "../../components/card/cardVariants";
import type { CrewClass, MoveType } from "@shared/games/face-turn/types";

export type PickedEntry =
	| { kind: "boss"; id: string; name: string }
	| {
			kind: "crew";
			id: string;
			name: string;
			crewClass: CrewClass;
			isReserve?: boolean;
	  }
	| {
			kind: "move";
			id: string;
			name: string;
			baseCost: number;
			moveType: MoveType;
	  };

// reuse card variant theme for consistent color coding
function PickIcon({ entry }: { entry: PickedEntry }) {
	if (entry.kind === "boss") {
		return (
			<span className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 border border-rose-400/40 bg-rose-400/15 text-rose-300 font-black text-sm">
				B
			</span>
		);
	}
	if (entry.kind === "crew") {
		const theme = CARD_VARIANT_THEME[entry.crewClass];
		return (
			<span
				className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 border font-black text-sm"
				style={{
					borderColor: `${theme.accent}66`,
					backgroundColor: `${theme.accent}26`,
					color: theme.accent,
				}}
			>
				{theme.label.charAt(0)}
			</span>
		);
	}
	const theme = CARD_VARIANT_THEME[entry.moveType];
	return (
		<span
			className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 border font-black text-sm tabular-nums"
			style={{
				borderColor: `${theme.accent}66`,
				backgroundColor: `${theme.accent}26`,
				color: theme.accent,
			}}
		>
			{entry.baseCost}
		</span>
	);
}

// all three kinds clickable to deselect; boss reuses select_boss action, no display-only carve-out
export function SidebarRow({
	entry,
	onDeselect,
}: {
	entry: PickedEntry;
	onDeselect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onDeselect}
			title="Click to remove"
			className="w-full flex items-center gap-3 px-4 py-2.5 bg-white/4 hover:bg-white/10 border-b border-black/20 text-left transition-colors cursor-pointer"
		>
			<PickIcon entry={entry} />
			<span className="text-sm font-bold text-white/90 truncate">
				{entry.name}
			</span>
			{entry.kind === "crew" && entry.isReserve && (
				<span className="shrink-0 ml-auto px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border border-amber-400/40 bg-amber-400/10 text-amber-300">
					Reserve
				</span>
			)}
		</button>
	);
}