import { useState, type MouseEvent } from "react";
import { useSavedDecks } from "../../hooks/useSavedDecks";
import type { SavedDeck } from "../../savedDecks";
import { ToolbarPopover } from "../../components/ui/ToolbarPopover";

function DeckThumbnail({ deck }: { deck: SavedDeck }) {
	if (!deck.thumbnailArtSrc) {
		return (
			<span className="shrink-0 w-8 h-8 rounded bg-white/5 border border-white/10" />
		);
	}
	return (
		<img
			src={deck.thumbnailArtSrc}
			alt=""
			className="shrink-0 w-8 h-8 rounded object-cover border border-white/10"
		/>
	);
}

function DeckRow({
	deck,
	onLoad,
	onDelete,
	deleteTitle,
}: {
	deck: SavedDeck;
	onLoad: () => void;
	onDelete: (e: MouseEvent) => void;
	deleteTitle: string;
}) {
	return (
		<div className="flex items-center border-b border-white/5 last:border-b-0">
			<button
				type="button"
				onClick={onLoad}
				className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left transition-colors cursor-pointer"
			>
				<DeckThumbnail deck={deck} />
				<span className="min-w-0">
					<span className="block text-xs font-bold text-white/90 truncate">
						{deck.name}
					</span>
					<span className="block text-[10px] text-white/35">
						{deck.bossId ? 1 : 0} boss · {deck.crewIds.length} crew ·{" "}
						{deck.moveIds.length} moves
					</span>
				</span>
			</button>
			<button
				type="button"
				onClick={onDelete}
				title={deleteTitle}
				className="shrink-0 p-2 mr-1 rounded text-white/25 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
			>
				<svg
					viewBox="0 0 24 24"
					className="w-3.5 h-3.5"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path
						d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6h16z"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
		</div>
	);
}

export function MyDecksMenu({
	disabled,
	onLoad,
}: {
	disabled: boolean;
	onLoad: (deck: SavedDeck) => void;
}) {
	const { decks, recentDecks, remove, removeRecent } = useSavedDecks();
	const [open, setOpen] = useState(false);

	function handleDelete(e: MouseEvent, id: string) {
		e.stopPropagation();
		remove(id);
	}

	function handleDeleteRecent(e: MouseEvent, id: string) {
		e.stopPropagation();
		removeRecent(id);
	}

	return (
		<ToolbarPopover
			label="My decks"
			active={false}
			open={open}
			disabled={disabled}
			onToggle={() => setOpen((v) => !v)}
			align="left"
			panelClassName="w-64"
			icon={
				<svg
					viewBox="0 0 24 24"
					className="w-3 h-3"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
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
			<>
				{recentDecks.length > 0 && (
					<div className="border-b border-white/10">
						<p className="px-3 pt-2.5 pb-1 text-[9px] font-black uppercase tracking-widest text-white/30 flex items-center gap-1.5">
							<svg
								viewBox="0 0 24 24"
								className="w-2.5 h-2.5"
								fill="none"
								stroke="currentColor"
								strokeWidth={3}
							>
								<circle cx={12} cy={12} r={9} />
								<path
									d="M12 7v5l3.5 2"
									strokeLinecap="round"
									strokeLinejoin="round"
								/>
							</svg>
							Recently used · auto-saved
						</p>
						<div className="max-h-40 overflow-y-auto">
							{recentDecks.map((deck) => (
								<DeckRow
									key={deck.id}
									deck={deck}
									onLoad={() => {
										onLoad(deck);
										setOpen(false);
									}}
									onDelete={(e) => handleDeleteRecent(e, deck.id)}
									deleteTitle="Remove from recently used"
								/>
							))}
						</div>
					</div>
				)}

				<div>
					<p className="px-3 pt-2.5 pb-1 text-[9px] font-black uppercase tracking-widest text-white/30">
						Saved decks
					</p>
					<div className="max-h-56 overflow-y-auto">
						{decks.length === 0 ? (
							<p className="px-3 pb-3 text-[11px] text-white/35 leading-relaxed">
								No saved decks yet. Finish a draft, then save it from the panel
								next to Done.
							</p>
						) : (
							decks.map((deck) => (
								<DeckRow
									key={deck.id}
									deck={deck}
									onLoad={() => {
										onLoad(deck);
										setOpen(false);
									}}
									onDelete={(e) => handleDelete(e, deck.id)}
									deleteTitle="Delete this saved deck"
								/>
							))
						)}
					</div>
				</div>
			</>
		</ToolbarPopover>
	);
}