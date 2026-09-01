import { useEffect, useRef, useState, type MouseEvent } from "react";
import { cn } from "../../../../lib/utils/cn";
import { toast } from "../../../../lib/utils/toast";
import { useSavedDecks } from "../../hooks/useSavedDecks";
import type { SavedDeck } from "../../savedDecks";
import { decodeDeckCode } from "@shared/games/face-turn/deck-code";

function decodedDeckAsSavedDeck(deck: {
	bossId: string | null;
	crewIds: string[];
	moveIds: string[];
}): SavedDeck {
	return {
		id: `imported-${Date.now()}`,
		name: "Imported deck",
		bossId: deck.bossId,
		crewIds: deck.crewIds,
		moveIds: deck.moveIds,
		savedAt: Date.now(),
	};
}

export function MyDecksMenu({
	currentSelections,
	hasCurrentPicks,
	disabled,
	onLoad,
}: {
	currentSelections: {
		bossId: string | null;
		crewIds: readonly string[];
		moveIds: readonly string[];
	};
	hasCurrentPicks: boolean;
	disabled: boolean;
	onLoad: (deck: SavedDeck) => void;
}) {
	const { decks, save, remove } = useSavedDecks();
	const [open, setOpen] = useState(false);
	const [naming, setNaming] = useState(false);
	const [nameDraft, setNameDraft] = useState("");
	const [importText, setImportText] = useState("");

	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onClickOutside(e: globalThis.MouseEvent) {
			if (!containerRef.current?.contains(e.target as Node)) {
				setOpen(false);
				setNaming(false);
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, [open]);

	function handleSave() {
		const trimmed = nameDraft.trim();
		if (!trimmed) return;
		const saved = save(trimmed, currentSelections);
		if (!saved) {
			toast.error("Couldn't save — local storage is full or unavailable.");
			return;
		}
		setNameDraft("");
		setNaming(false);
	}

	function handleDelete(e: MouseEvent, id: string) {
		e.stopPropagation();
		remove(id);
	}

	function handleImportCode() {
		const result = decodeDeckCode(importText);
		if (!result.ok) {
			toast.error(
				result.error === "empty"
					? "Paste a deck code first."
					: "That code doesn't look right — check for typos.",
			);
			return;
		}
		onLoad(decodedDeckAsSavedDeck(result.deck));
		setImportText("");
		setOpen(false);
	}

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				disabled={disabled}
				onClick={() => setOpen((v) => !v)}
				title="Save this draft, load a saved one, or use a deck code"
				className={cn(
					"flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-black tracking-widest uppercase transition-colors",
					disabled
						? "text-white/20 cursor-not-allowed"
						: "text-white/40 hover:text-white/80 cursor-pointer",
				)}
			>
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
				My decks
			</button>

			{open && (
				<div className="absolute z-20 top-full left-0 mt-1 w-64 rounded-lg border border-white/15 ft-panel-ink shadow-xl overflow-hidden">
					<div className="max-h-56 overflow-y-auto">
						{decks.length === 0 ? (
							<p className="px-3 py-4 text-[11px] text-white/35 text-center leading-relaxed">
								No saved decks yet. Build a draft, then save it here to reuse
								next time.
							</p>
						) : (
							decks.map((deck) => (
								<div
									key={deck.id}
									className="flex items-center border-b border-white/5 last:border-b-0"
								>
									<button
										type="button"
										onClick={() => {
											onLoad(deck);
											setOpen(false);
										}}
										className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 hover:bg-white/10 text-left transition-colors cursor-pointer"
									>
										<span className="min-w-0">
											<span className="block text-xs font-bold text-white/90 truncate">
												{deck.name}
											</span>
											<span className="block text-[10px] text-white/35">
												{deck.bossId ? 1 : 0} boss · {deck.crewIds.length} crew
												· {deck.moveIds.length} moves
											</span>
										</span>
									</button>
									<button
										type="button"
										onClick={(e) => handleDelete(e, deck.id)}
										title="Delete this saved deck"
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
							))
						)}
					</div>

					<div className="border-t border-white/10 p-2">
						<div className="flex items-center gap-1.5">
							<input
								value={importText}
								onChange={(e) => {
									setImportText(e.target.value);
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleImportCode();
									if (e.key === "Escape") setImportText("");
								}}
								placeholder="Paste a deck code…"
								spellCheck={false}
								className="flex-1 min-w-0 px-2 py-1.5 rounded bg-black/40 border border-white/15 text-xs text-white/90 placeholder:text-white/30 outline-none focus:border-white/40 font-mono"
							/>
							<button
								type="button"
								onClick={handleImportCode}
								disabled={!importText.trim()}
								className="shrink-0 px-2.5 py-1.5 rounded bg-emerald-500/80 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-black text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed"
							>
								Load
							</button>
						</div>
					</div>

					<div className="border-t border-white/10 p-2">
						{naming ? (
							<div className="flex flex-col gap-1.5">
								<div className="flex items-center gap-1.5">
									<input
										autoFocus
										value={nameDraft}
										onChange={(e) => {
											setNameDraft(e.target.value);
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleSave();
											if (e.key === "Escape") {
												setNaming(false);
												setNameDraft("");
											}
										}}
										placeholder="Deck name…"
										maxLength={40}
										className="flex-1 min-w-0 px-2 py-1.5 rounded bg-black/40 border border-white/15 text-xs text-white/90 placeholder:text-white/30 outline-none focus:border-white/40"
									/>
									<button
										type="button"
										onClick={handleSave}
										disabled={!nameDraft.trim()}
										className="px-2 py-1.5 rounded bg-emerald-500/80 hover:bg-emerald-500 disabled:bg-white/10 disabled:text-white/30 text-black text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer disabled:cursor-not-allowed"
									>
										Save
									</button>
								</div>
							</div>
						) : (
							<button
								type="button"
								disabled={!hasCurrentPicks}
								onClick={() => setNaming(true)}
								title={
									hasCurrentPicks
										? "Save your current picks as a new preset"
										: "Pick something first"
								}
								className={cn(
									"w-full px-2 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors",
									hasCurrentPicks
										? "bg-white/10 hover:bg-white/20 text-white/80 cursor-pointer"
										: "bg-white/5 text-white/25 cursor-not-allowed",
								)}
							>
								+ Save current draft
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}