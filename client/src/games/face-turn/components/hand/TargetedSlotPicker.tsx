import { SlotButton } from "../interaction-prompts/SimplePrompts";

export interface TargetedSlotPickerTarget {
	playerId: string;
	slot: number;
}

type TargetedSlotPickerSelectionProps =
	| {
			mode: "single";
			selected: TargetedSlotPickerTarget | null;
			onSelectSingle: (target: TargetedSlotPickerTarget) => void;
			onToggleMulti?: never;
	  }
	| {
			mode: "multi";
			selected: readonly TargetedSlotPickerTarget[];
			onToggleMulti: (target: TargetedSlotPickerTarget) => void;
			onSelectSingle?: never;
	  };

export function TargetedSlotPicker({
	eligibleTargets,
	playerMap,
	localPlayerId,
	mode,
	selected,
	onSelectSingle,
	onToggleMulti,
	disabled,
	alwaysOmitOwnerName,
}: {
	eligibleTargets: readonly TargetedSlotPickerTarget[];
	playerMap: Record<string, { id: string; name: string; score: number }>;
	// never show name for self, even if alwaysOmitOwnerName is false
	localPlayerId: string;
	disabled?: boolean;
	alwaysOmitOwnerName?: boolean;
} & TargetedSlotPickerSelectionProps) {
	function isSelected(t: TargetedSlotPickerTarget): boolean {
		if (mode === "single") {
			return (
				selected !== null &&
				selected.playerId === t.playerId &&
				selected.slot === t.slot
			);
		}
		return selected.some((p) => p.playerId === t.playerId && p.slot === t.slot);
	}

	function handleClick(t: TargetedSlotPickerTarget) {
		if (mode === "single") {
			onSelectSingle(t);
		} else {
			onToggleMulti(t);
		}
	}

	return (
		<div className="flex gap-2 flex-wrap items-center">
			{eligibleTargets.map((t) => {
				const showName = !alwaysOmitOwnerName && t.playerId !== localPlayerId;
				const label = showName
					? `${playerMap[t.playerId]?.name ?? t.playerId} · Slot ${t.slot + 1}`
					: `Slot ${t.slot + 1}`;
				return (
					<SlotButton
						key={`${t.playerId}-${t.slot}`}
						label={label}
						selected={isSelected(t)}
						disabled={disabled}
						onClick={() => handleClick(t)}
					/>
				);
			})}
		</div>
	);
}