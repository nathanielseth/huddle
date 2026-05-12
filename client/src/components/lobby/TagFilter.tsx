import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils/cn";

interface TagFilterProps {
	tags: string[];
	selectedTag: string;
	onSelect: (tag: string) => void;
}

export function TagFilter({ tags, selectedTag, onSelect }: TagFilterProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const checkEdges = () => {
			setCanScrollLeft(el.scrollLeft > 2);
			setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
		};

		checkEdges();
		el.addEventListener("scroll", checkEdges, { passive: true });
		const ro = new ResizeObserver(checkEdges);
		ro.observe(el);

		return () => {
			el.removeEventListener("scroll", checkEdges);
			ro.disconnect();
		};
	}, [tags]);

	const scroll = (dir: "left" | "right") => {
		scrollRef.current?.scrollBy({
			left: dir === "left" ? -140 : 140,
			behavior: "smooth",
		});
	};

	const mask =
		canScrollLeft && canScrollRight
			? "linear-gradient(to right, transparent, black 18%, black 82%, transparent)"
			: canScrollLeft
				? "linear-gradient(to right, transparent, black 18%)"
				: canScrollRight
					? "linear-gradient(to right, black 82%, transparent)"
					: "none";

	if (tags.length === 0) return null;

	const allTags = ["all", ...tags];

	return (
		<div className="relative flex items-center">
			<AnimatePresence>
				{canScrollLeft && (
					<motion.button
						type="button"
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.8 }}
						transition={{ duration: 0.12 }}
						onClick={() => scroll("left")}
						className="absolute left-0 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-surface border border-border text-white/40 hover:text-white/80 hover:border-white/20 transition-colors cursor-pointer shrink-0"
						aria-label="Scroll left"
					>
						<ChevronLeft size={18} strokeWidth={2.5} />
					</motion.button>
				)}
			</AnimatePresence>

			<div
				ref={scrollRef}
				className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none w-full"
				style={{ maskImage: mask, WebkitMaskImage: mask }}
			>
				<div className="flex gap-2 w-max px-1 py-0.5">
					{allTags.map((tag) => (
						<button
							key={tag}
							type="button"
							data-selected={selectedTag === tag}
							onClick={(e) => {
								onSelect(tag);
								e.currentTarget.scrollIntoView({
									behavior: "smooth",
									block: "nearest",
									inline: "center",
								});
							}}
							className={cn(
								"shrink-0 px-3 py-1.5 text-[10px] font-bold tracking-[0.15em] uppercase rounded-full transition-all duration-150 cursor-pointer",
								selectedTag === tag
									? "bg-white text-bg"
									: "bg-white/6 text-white/35 hover:bg-white/10 hover:text-white/55",
							)}
						>
							{tag}
						</button>
					))}
				</div>
			</div>

			<AnimatePresence>
				{canScrollRight && (
					<motion.button
						type="button"
						initial={{ opacity: 0, scale: 0.8 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.8 }}
						transition={{ duration: 0.12 }}
						onClick={() => scroll("right")}
						className="absolute right-0 z-10 flex items-center justify-center w-6 h-6 rounded-full bg-surface border border-border text-white/40 hover:text-white/80 hover:border-white/20 transition-colors cursor-pointer shrink-0"
						aria-label="Scroll right"
					>
						<ChevronRight size={18} strokeWidth={2.5} />
					</motion.button>
				)}
			</AnimatePresence>
		</div>
	);
}
