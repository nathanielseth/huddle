import "../../board.css";
import { cn } from "../../../../lib/utils/cn";

export type TargetPickerAccent = "amber" | "violet";

const ACCENT_CLASSES: Record<TargetPickerAccent, string> = {
	amber: "border-amber-400 bg-amber-400/10 text-amber-200",
	violet: "border-violet-400 bg-violet-400/10 text-violet-200",
};

export function TargetPicker({
	players,
	selectedId,
	onSelect,
	accent = "amber",
	dense = false,
	registerRef,
}: {
	players: { id: string; name: string }[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	accent?: TargetPickerAccent;
	dense?: boolean;
	registerRef?: (playerId: string, el: HTMLButtonElement | null) => void;
}) {
	return (
		<div className="flex gap-2 flex-wrap">
			{players.map((p) => (
				<button
					key={p.id}
					ref={registerRef ? (el) => registerRef(p.id, el) : undefined}
					type="button"
					onClick={() => onSelect(p.id)}
					className={cn(
						"rounded-lg border font-bold transition-all cursor-pointer",
						dense ? "px-3 py-1 rounded-md text-xs" : "px-3 py-1.5 text-xs",
						selectedId === p.id
							? ACCENT_CLASSES[accent]
							: "ft-panel-ink border-white/15 text-white/60 hover:border-white/30",
					)}
				>
					{p.name}
				</button>
			))}
		</div>
	);
}