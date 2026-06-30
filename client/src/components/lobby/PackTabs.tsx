import { m } from "motion/react";
import type { Pack } from "../../types/game";
import { cn } from "../../lib/utils/cn";

interface PackTabsProps {
	packs: Pack[];
	selectedPackId: string;
	onSelect: (id: string) => void;
}

export function PackTabs({ packs, selectedPackId, onSelect }: PackTabsProps) {
	const activeAccent =
		packs.find((p) => p.id === selectedPackId)?.accentColor ??
		"rgba(255,255,255,0.7)";

	return (
		<div className="flex gap-0 border-b border-white/8">
			{/* ALL tab */}
			<button
				type="button"
				onClick={() => { onSelect("all"); }}
				className={cn(
					"relative flex items-center pr-7 pb-3 cursor-pointer transition-colors duration-200",
					selectedPackId === "all"
						? "text-white"
						: "text-white/30 hover:text-white/55",
				)}
			>
				<span className="text-sm font-bold tracking-[0.22em] uppercase">
					All
				</span>
				{selectedPackId === "all" && (
					<m.div
						layoutId="pack-underline"
						className="absolute bottom-0 left-0 right-7 h-0.5 rounded-full bg-white/70"
						transition={{ type: "spring", stiffness: 420, damping: 38 }}
					/>
				)}
			</button>

			{/* Named pack tabs */}
			{packs.map((pack) => {
				const isSelected = pack.id === selectedPackId;
				return (
					<button
						key={pack.id}
						type="button"
						onClick={() => { onSelect(pack.id); }}
						className={cn(
							"relative flex flex-col items-start pr-7 pb-3 cursor-pointer transition-colors duration-200",
							isSelected ? "text-white" : "text-white/30 hover:text-white/55",
						)}
					>
						<span className="text-sm font-bold tracking-[0.22em] uppercase leading-none mb-0.5">
							Pack {pack.number}
						</span>
						<span
							className="text-[10px] font-semibold tracking-wider leading-none transition-colors duration-200"
							style={{
								color: isSelected ? pack.accentColor : "rgba(255,255,255,0.18)",
							}}
						>
							{pack.name}
						</span>
						{isSelected && (
							<m.div
								layoutId="pack-underline"
								className="absolute bottom-0 left-0 right-7 h-0.5 rounded-full"
								style={{ backgroundColor: activeAccent }}
								transition={{ type: "spring", stiffness: 420, damping: 38 }}
							/>
						)}
					</button>
				);
			})}
		</div>
	);
}
