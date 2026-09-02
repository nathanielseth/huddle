import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useReducedMotion } from "../../../../hooks/a11y/useReducedMotion";
import { SidebarRow, type PickedEntry } from "./SidebarRow";

export function PicksDrawer({
	open,
	onClose,
	entries,
	onDeselect,
}: {
	open: boolean;
	onClose: () => void;
	entries: readonly PickedEntry[];
	onDeselect: (entry: PickedEntry) => void;
}) {
	const reducedMotion = useReducedMotion();

	return (
		<AnimatePresence>
			{open && (
				<>
					<m.div
						className="fixed inset-0 z-30 bg-black/70"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: reducedMotion ? 0 : 0.18 }}
						onClick={onClose}
					/>
					<m.div
						className="fixed inset-x-0 bottom-0 z-40 flex flex-col max-h-[70vh] rounded-t-2xl border-t border-white/15 ft-draft-panel shadow-2xl shadow-black/60"
						style={{
							paddingBottom: "env(safe-area-inset-bottom)",
						}}
						initial={reducedMotion ? { opacity: 0 } : { y: "100%" }}
						animate={reducedMotion ? { opacity: 1 } : { y: 0 }}
						exit={reducedMotion ? { opacity: 0 } : { y: "100%" }}
						transition={{
							duration: reducedMotion ? 0 : 0.24,
							ease: [0.4, 0, 0.2, 1],
						}}
					>
						{/* grab handle, purely visual */}
						<div className="flex justify-center pt-2.5 pb-1 shrink-0">
							<div className="w-9 h-1 rounded-full bg-white/20" />
						</div>

						<div className="flex items-center justify-between px-4 py-2 border-b border-white/10 shrink-0">
							<p className="text-[11px] font-black tracking-widest uppercase text-white/50">
								Your draft
							</p>
							<button
								type="button"
								onClick={onClose}
								className="p-1.5 -mr-1.5 rounded-lg text-white/40 hover:text-white active:bg-white/10 transition-colors cursor-pointer"
								aria-label="Close"
							>
								<svg
									viewBox="0 0 24 24"
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									strokeWidth={2.5}
								>
									<path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
								</svg>
							</button>
						</div>

						<div
							className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
							style={{ touchAction: "pan-y" }}
						>
							{entries.length === 0 ? (
								<p className="px-4 py-8 text-xs text-white/30 text-center">
									Nothing drafted yet — pick a boss, crew, and moves below.
								</p>
							) : (
								entries.map((entry) => (
									<SidebarRow
										key={`${entry.kind}-${entry.id}`}
										entry={entry}
										onDeselect={() => {
											onDeselect(entry);
										}}
									/>
								))
							)}
						</div>
					</m.div>
				</>
			)}
		</AnimatePresence>
	);
}