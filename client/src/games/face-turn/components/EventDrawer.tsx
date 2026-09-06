import { useState } from "react";
import { cn } from "../../../lib/utils/cn";
import type { PendingInteractionView } from "@shared/games/face-turn/types";
import type { LogEntry } from "@shared/games/face-turn/log";
import {
	describePendingInteraction,
	describeLogEntry,
	describeChainResolutionLog,
} from "../lib/describeEvent";

export function LogRow({
	entry,
	playerMap,
	dim,
	showBreakdown,
}: {
	entry: LogEntry;
	playerMap: Record<
		string,
		{ name: string; bossId?: string; bossName?: string }
	>;
	dim: boolean;
	showBreakdown: boolean;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<p
				className={cn(
					"text-xs",
					dim ? "text-white/40" : "text-white/70",
					!showBreakdown && "truncate",
				)}
			>
				{describeLogEntry(entry, playerMap)}
			</p>
			{showBreakdown && entry.kind === "move_chain_resolved" && (
				<ol className="flex flex-col gap-0.5 border-l border-white/10 pl-2">
					{describeChainResolutionLog(entry, playerMap).map((line, i) => (
						<li
							// steps never reorder, index is stable
							key={i}
							className={cn(
								"text-[11px]",
								dim ? "text-white/25" : "text-white/45",
							)}
						>
							{line}
						</li>
					))}
				</ol>
			)}
		</div>
	);
}

export function LogFeed({
	log,
	playerMap,
	className,
	style,
}: {
	log: readonly LogEntry[];
	playerMap: Record<
		string,
		{ name: string; bossId?: string; bossName?: string }
	>;
	className?: string;
	style?: React.CSSProperties;
}) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1 overflow-y-auto ft-scroll pr-1",
				className,
			)}
			style={{ touchAction: "pan-y", ...style }}
		>
			{log.length === 0 ? (
				<p className="text-xs text-white/25 italic">Nothing yet.</p>
			) : (
				[...log]
					.reverse()
					.map((entry, i) => (
						<LogRow
							key={entry.seq}
							entry={entry}
							playerMap={playerMap}
							dim={i !== 0}
							showBreakdown={true}
						/>
					))
			)}
		</div>
	);
}

// cap expanded list length
const EXPANDED_COUNT = 40;

export function EventDrawer({
	log,
	pendingInteraction,
	playerMap,
}: {
	// oldest first, as received from the server (state.log)
	log: readonly LogEntry[];
	pendingInteraction: PendingInteractionView | null;
	playerMap: Record<
		string,
		{ name: string; bossId?: string; bossName?: string }
	>;
}) {
	const [expanded, setExpanded] = useState(false);

	if (!pendingInteraction && log.length === 0) return null;

	const latest = log.length > 0 ? log[log.length - 1] : null;
	const hasMore = log.length > 1;

	return (
		<div className="ml-auto w-full max-w-xs pointer-events-auto">
			<div className="ft-panel-ink rounded-xl border border-white/10 bg-black/40 px-4 py-2 flex flex-col gap-1.5">
				{pendingInteraction && (
					<div className="flex items-center gap-1.5">
						<span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />
						<p className="ft-eyebrow text-[11px] text-amber-200 truncate">
							{describePendingInteraction(pendingInteraction, playerMap)}
						</p>
					</div>
				)}

				{latest && !expanded && (
					<LogRow
						entry={latest}
						playerMap={playerMap}
						dim={false}
						showBreakdown={false}
					/>
				)}

				{expanded && (
					<div
						className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1"
						style={{ touchAction: "pan-y" }}
					>
						{[...log]
							.reverse()
							.slice(0, EXPANDED_COUNT)
							.map((entry, i) => (
								<LogRow
									key={entry.seq}
									entry={entry}
									playerMap={playerMap}
									dim={i !== 0}
									showBreakdown={true}
								/>
							))}
					</div>
				)}

				{hasMore && (
					<button
						type="button"
						onClick={() => setExpanded((e) => !e)}
						className="ft-eyebrow text-[9px] text-white/30 hover:text-white/60 self-end"
					>
						{expanded ? "Show less ▴" : `${log.length} events ▾`}
					</button>
				)}
			</div>
		</div>
	);
}