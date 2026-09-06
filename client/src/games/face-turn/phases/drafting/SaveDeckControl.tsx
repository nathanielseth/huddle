import { useState } from "react";
import { cn } from "../../../../lib/utils/cn";
import { toast } from "../../../../lib/utils/toast";
import { useSavedDecks } from "../../hooks/useSavedDecks";
import { IconToolbarPopover } from "../../components/ui/ToolbarPopover";
import type { PickedEntry } from "./SidebarRow";

// remount the form fresh each open to reset state
function SaveDeckForm({
	selections,
	pickedEntries,
	bossName,
	canSave,
	onSaved,
	onCancel,
}: {
	selections: {
		bossId: string | null;
		crewIds: readonly string[];
		moveIds: readonly string[];
	};
	pickedEntries: readonly PickedEntry[];
	bossName: string | null;
	canSave: boolean;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const { save } = useSavedDecks();
	const [name, setName] = useState("");
	const [thumbnailArtSrc, setThumbnailArtSrc] = useState(
		() => pickedEntries.find((e) => e.kind === "boss")?.artSrc,
	);

	function handleSave() {
		const saved = save(name, selections, thumbnailArtSrc);
		if (!saved) {
			toast.error("Couldn't save — local storage is full or unavailable.");
			return;
		}
		toast.success(`Saved "${saved.name}"`);
		onSaved();
	}

	return (
		<div className="p-3 flex flex-col gap-3">
			<div>
				<label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">
					Deck name
				</label>
				<input
					autoFocus
					value={name}
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && canSave) handleSave();
						if (e.key === "Escape") onCancel();
					}}
					placeholder={bossName ?? "Deck name…"}
					maxLength={40}
					className="w-full px-2 py-1.5 rounded bg-black/40 border border-white/15 text-xs text-white/90 placeholder:text-white/30 outline-none focus:border-white/40"
				/>
			</div>

			{pickedEntries.length > 0 && (
				<div>
					<label className="block text-[9px] font-black uppercase tracking-widest text-white/30 mb-1.5">
						Thumbnail
					</label>
					<div className="flex flex-wrap gap-1.5">
						{pickedEntries.map((entry) => {
							const artSrc = entry.artSrc;
							if (!artSrc) return null;
							const selected = thumbnailArtSrc === artSrc;
							return (
								<button
									key={`${entry.kind}-${entry.id}`}
									type="button"
									onClick={() => setThumbnailArtSrc(artSrc)}
									title={entry.name}
									className={cn(
										"w-9 h-9 rounded overflow-hidden border-2 transition-colors cursor-pointer",
										selected
											? "border-emerald-400"
											: "border-transparent hover:border-white/30",
									)}
								>
									<img
										src={artSrc}
										alt={entry.name}
										className="w-full h-full object-cover"
									/>
								</button>
							);
						})}
					</div>
				</div>
			)}

			<button
				type="button"
				onClick={handleSave}
				disabled={!canSave}
				className="w-full px-2 py-1.5 rounded bg-emerald-500/80 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-black text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed"
			>
				Save deck
			</button>
		</div>
	);
}

// save control for sidebar, opens upward to avoid viewport bottom
export function SaveDeckControl({
	selections,
	pickedEntries,
	bossName,
	allDone,
	disabled,
}: {
	selections: {
		bossId: string | null;
		crewIds: readonly string[];
		moveIds: readonly string[];
	};
	pickedEntries: readonly PickedEntry[];
	bossName: string | null;
	allDone: boolean;
	disabled: boolean;
}) {
	const [open, setOpen] = useState(false);
	const [openCount, setOpenCount] = useState(0);
	const canSave = allDone && !disabled;

	return (
		<IconToolbarPopover
			label={
				disabled
					? "Save deck"
					: allDone
						? "Save this draft as a deck"
						: "Finish your draft before saving"
			}
			active={false}
			open={open}
			disabled={!canSave}
			onToggle={() => {
				setOpen((v) => {
					const next = !v;
					// bump form key on every open so state resets
					if (next) setOpenCount((c) => c + 1);
					return next;
				});
			}}
			align="right"
			direction="up"
			panelClassName="w-72"
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-4 h-4"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
					<path
						d="M17 21v-8H7v8M7 3v5h8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			}
		>
			<SaveDeckForm
				key={openCount}
				selections={selections}
				pickedEntries={pickedEntries}
				bossName={bossName}
				canSave={canSave}
				onSaved={() => setOpen(false)}
				onCancel={() => setOpen(false)}
			/>
		</IconToolbarPopover>
	);
}