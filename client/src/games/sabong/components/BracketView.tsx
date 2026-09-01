import { m } from "motion/react";
import { cn } from "../../../lib/utils/cn";
import type { BracketSlot, ManokView } from "@shared/games/sabong/index";

interface BracketViewProps {
	bracket: readonly BracketSlot[];
	manoks: Record<string, ManokView>;
	currentMatchIndex: number;
	nextMatchIndex?: number;
}

type SlotStatus = "completed" | "active" | "next" | "future";

function getSlotStatus(
	matchIndex: number,
	currentMatchIndex: number,
	nextMatchIndex: number | undefined,
	bracket: readonly BracketSlot[],
): SlotStatus {
	if (
		bracket[matchIndex]?.winnerId !== null &&
		bracket[matchIndex]?.winnerId !== undefined
	)
		return "completed";
	if (matchIndex === currentMatchIndex) return "active";
	if (matchIndex === nextMatchIndex) return "next";
	return "future";
}

// ─── Fighter row inside a slot card ──────────────────────────────────────────

function FighterRow({
	name,
	isWinner,
	isLoser,
	isEmpty,
}: {
	name: string | null;
	isWinner: boolean;
	isLoser: boolean;
	isEmpty: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-2 transition-opacity",
				isLoser && "opacity-25",
				isEmpty && "opacity-20",
			)}
		>
			<span
				className={cn(
					"w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
					isWinner ? "bg-green-400" : "bg-white/15",
				)}
			/>
			<span
				className={cn(
					"font-display font-bold uppercase leading-none text-sm truncate",
					isWinner && "text-white",
					!isWinner && !isEmpty && "text-white/60",
					isEmpty && "text-white/25",
				)}
			>
				{name ?? "TBD"}
			</span>
		</div>
	);
}

// ─── Individual slot card ─────────────────────────────────────────────────────

interface SlotCardProps {
	slot: BracketSlot;
	manoks: Record<string, ManokView>;
	status: SlotStatus;
	layoutId?: string;
}

function SlotCard({ slot, manoks, status, layoutId }: SlotCardProps) {
	const f1 = slot.fighter1Id ? manoks[slot.fighter1Id] : null;
	const f2 = slot.fighter2Id ? manoks[slot.fighter2Id] : null;
	const winnerId = slot.winnerId;
	const isDone = winnerId !== null;

	return (
		<m.div
			layoutId={layoutId}
			layout
			className={cn(
				"rounded-xl border p-2.5 flex flex-col gap-1.5",
				status === "completed" && "border-border bg-surface-raised",
				status === "active" && "border-orange-400/60 bg-orange-500/8",
				status === "next" && "border-orange-400/30 bg-orange-500/5",
				status === "future" && "border-border/40 bg-surface-raised/40",
			)}
			animate={
				status === "next"
					? {
							borderColor: [
								"oklch(0.75 0.15 50 / 0.2)",
								"oklch(0.75 0.15 50 / 0.55)",
								"oklch(0.75 0.15 50 / 0.2)",
							],
						}
					: {}
			}
			transition={
				status === "next"
					? { repeat: Infinity, duration: 2, ease: "easeInOut" }
					: { type: "spring", stiffness: 300, damping: 30 }
			}
		>
			<FighterRow
				name={f1?.name ?? null}
				isWinner={isDone && winnerId === slot.fighter1Id}
				isLoser={isDone && winnerId !== slot.fighter1Id && !!slot.fighter1Id}
				isEmpty={!f1}
			/>
			<div className="h-px bg-white/6" />
			<FighterRow
				name={f2?.name ?? null}
				isWinner={isDone && winnerId === slot.fighter2Id}
				isLoser={isDone && winnerId !== slot.fighter2Id && !!slot.fighter2Id}
				isEmpty={!f2}
			/>
			{status === "next" && (
				<p className="text-[9px] font-bold tracking-widest uppercase text-orange-400/50 text-center pt-0.5">
					Up Next
				</p>
			)}
		</m.div>
	);
}

// full bracket on host TV 
export function BracketViewFull({
	bracket,
	manoks,
	currentMatchIndex,
	nextMatchIndex,
}: BracketViewProps) {
	const qf = bracket.slice(0, 4);
	const sf = bracket.slice(4, 6);
	const final = bracket[6];

	return (
		<div className="flex items-stretch gap-2 h-72">
			{/* QF */}
			<div className="flex flex-col justify-around flex-1 gap-2">
				{qf.map((slot) => {
					const status = getSlotStatus(
						slot.matchIndex,
						currentMatchIndex,
						nextMatchIndex,
						bracket,
					);
					return (
						<SlotCard
							key={slot.matchIndex}
							slot={slot}
							manoks={manoks}
							status={status}
							layoutId={
								slot.matchIndex === nextMatchIndex
									? "active-match-slot"
									: undefined
							}
						/>
					);
				})}
			</div>

			{/* Q->SF connector dots */}
			<div className="flex flex-col justify-around py-8 gap-2">
				{[0, 1].map((i) => (
					<div key={i} className="flex flex-col justify-around h-full">
						<span className="w-1 h-1 rounded-full bg-white/15" />
						<span className="w-1 h-1 rounded-full bg-white/15" />
					</div>
				))}
			</div>

			{/* SF */}
			<div className="flex flex-col justify-around flex-1 gap-2">
				{sf.map((slot) => {
					const status = getSlotStatus(
						slot.matchIndex,
						currentMatchIndex,
						nextMatchIndex,
						bracket,
					);
					return (
						<SlotCard
							key={slot.matchIndex}
							slot={slot}
							manoks={manoks}
							status={status}
							layoutId={
								slot.matchIndex === nextMatchIndex
									? "active-match-slot"
									: undefined
							}
						/>
					);
				})}
			</div>

			{/* SF→Final connector dots */}
			<div className="flex flex-col justify-center">
				<span className="w-1 h-1 rounded-full bg-white/15" />
			</div>

			{/* Final */}
			<div className="flex flex-col justify-center flex-1">
				{final && (
					<SlotCard
						slot={final}
						manoks={manoks}
						status={getSlotStatus(
							final.matchIndex,
							currentMatchIndex,
							nextMatchIndex,
							bracket,
						)}
						layoutId={
							final.matchIndex === nextMatchIndex
								? "active-match-slot"
								: undefined
						}
					/>
				)}
			</div>
		</div>
	);
}

// QF-only bracket on player phones
export function BracketViewQF({
	bracket,
	manoks,
	currentMatchIndex,
	nextMatchIndex,
}: BracketViewProps) {
	const qf = bracket.slice(0, 4);

	return (
		<div className="grid grid-cols-2 gap-2">
			{qf.map((slot) => {
				const status = getSlotStatus(
					slot.matchIndex,
					currentMatchIndex,
					nextMatchIndex,
					bracket,
				);
				return (
					<SlotCard
						key={slot.matchIndex}
						slot={slot}
						manoks={manoks}
						status={status}
						layoutId={
							slot.matchIndex === nextMatchIndex
								? "active-match-slot"
								: undefined
						}
					/>
				);
			})}
		</div>
	);
}
