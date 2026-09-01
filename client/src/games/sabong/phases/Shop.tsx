import { useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { useSabongState } from "../hooks/useSabongState";
import { TimerBar } from "../components/TimerBar";
import { socket } from "../../../lib/network/socket";
import { cn } from "../../../lib/utils/cn";
import type { ManokView, HideableStat } from "@shared/games/sabong/index";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STAT_LABELS: Record<string, string> = {
	health: "HP",
	attack: "ATK",
	defense: "DEF",
	speed: "SPD",
	critRate: "CRIT",
};

function StatRow({
	label,
	value,
	revealed = false,
	debuffed = false,
}: {
	label: string;
	value: number | null;
	revealed?: boolean;
	debuffed?: boolean;
}) {
	return (
		<div className="flex items-center justify-between text-xs">
			<span className="text-white/40 font-semibold uppercase tracking-widest">
				{label}
			</span>
			{value === null ? (
				<span className="text-white/20">???</span>
			) : (
				<span
					className={cn(
						"font-display font-bold tabular-nums",
						debuffed
							? "text-red-400"
							: revealed
								? "text-yellow-400"
								: "text-white",
					)}
				>
					{value}
					{debuffed && (
						<span className="ml-1 text-red-500/60 text-[10px]">▼</span>
					)}
					{revealed && !debuffed && (
						<span className="ml-1 text-yellow-500/60 text-[10px]">👁</span>
					)}
				</span>
			)}
		</div>
	);
}

// ── Manok detail sheet ─────────────────────────────────────────────────────────

function ManokDetail({
	manok,
	balance,
	revealedStats,
	isSabotaged,
	sabotageDebuff,
	spyRemaining,
	sabotageRemaining,
	spyPrice,
	sabotagePrice,
	onClose,
}: {
	manok: ManokView;
	balance: number;
	revealedStats: Partial<Record<HideableStat, number>>;
	isSabotaged: boolean;
	sabotageDebuff: { attack: number; determination: number } | null;
	spyRemaining: number | null;
	sabotageRemaining: number | null;
	spyPrice: number;
	sabotagePrice: number;
	onClose: () => void;
}) {
	const stats: Array<{
		key: string;
		label: string;
		value: number | null;
		revealed: boolean;
		debuffed: boolean;
	}> = [
		{
			key: "health",
			label: "HP",
			value: manok.stats.health ?? revealedStats.health ?? null,
			revealed:
				manok.stats.health === null && revealedStats.health !== undefined,
			debuffed: false,
		},
		{
			key: "attack",
			label: "ATK",
			value:
				isSabotaged && sabotageDebuff
					? sabotageDebuff.attack
					: (manok.stats.attack ?? revealedStats.attack ?? null),
			revealed:
				manok.stats.attack === null && revealedStats.attack !== undefined,
			debuffed: isSabotaged && sabotageDebuff !== null,
		},
		{
			key: "defense",
			label: "DEF",
			value: manok.stats.defense ?? revealedStats.defense ?? null,
			revealed:
				manok.stats.defense === null && revealedStats.defense !== undefined,
			debuffed: false,
		},
		{
			key: "speed",
			label: "SPD",
			value: manok.stats.speed ?? revealedStats.speed ?? null,
			revealed: manok.stats.speed === null && revealedStats.speed !== undefined,
			debuffed: false,
		},
		{
			key: "critRate",
			label: "CRIT",
			value: manok.stats.critRate ?? revealedStats.critRate ?? null,
			revealed:
				manok.stats.critRate === null && revealedStats.critRate !== undefined,
			debuffed: false,
		},
	];

	const hiddenCount = stats.filter((s) => s.value === null).length;
	const canSpy =
		(spyRemaining === null || spyRemaining > 0) &&
		balance >= spyPrice &&
		hiddenCount > 0;
	const canSabotage =
		(sabotageRemaining === null || sabotageRemaining > 0) &&
		balance >= sabotagePrice &&
		!isSabotaged;

	function handleSpy() {
		if (!canSpy) return;
		socket.emit("player_action", { type: "reveal_stat", manokId: manok.id });
	}

	function handleSabotage() {
		if (!canSabotage) return;
		socket.emit("player_action", { type: "sabotage_manok", manokId: manok.id });
	}

	return (
		<m.div
			className="fixed inset-0 z-50 flex items-end bg-black/70"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			onClick={onClose}
		>
			<m.div
				className="w-full rounded-t-3xl bg-surface-raised border-t border-border px-5 pt-5 pb-8 flex flex-col gap-5"
				initial={{ y: "100%" }}
				animate={{ y: 0 }}
				exit={{ y: "100%" }}
				transition={{ type: "spring", stiffness: 340, damping: 32 }}
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				{/* drag handle */}
				<div className="w-10 h-1 rounded-full bg-white/20 mx-auto" />

				{/* name + sabotaged badge */}
				<div className="flex items-center justify-between">
					<h2 className="font-display text-2xl font-black uppercase text-white">
						{manok.name}
					</h2>
					{isSabotaged && (
						<span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-[10px] font-bold text-red-400 uppercase tracking-widest">
							💀 Sabotaged
						</span>
					)}
				</div>

				{/* stats */}
				<div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/3 border border-border">
					{stats.map((s) => (
						<StatRow
							key={s.key}
							label={s.label}
							value={s.value}
							revealed={s.revealed}
							debuffed={s.debuffed}
						/>
					))}
				</div>

				{/* legend */}
				{(stats.some((s) => s.revealed) || isSabotaged) && (
					<div className="flex gap-3 text-[10px] text-white/30">
						{stats.some((s) => s.revealed) && (
							<span className="flex items-center gap-1">
								<span className="text-yellow-400">👁</span> Revealed by you
							</span>
						)}
						{isSabotaged && (
							<span className="flex items-center gap-1">
								<span className="text-red-400">▼</span> Sabotaged by you
							</span>
						)}
					</div>
				)}

				{/* actions */}
				<div className="flex gap-3">
					<button
						type="button"
						onClick={handleSpy}
						disabled={!canSpy}
						className={cn(
							"flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border text-xs font-bold uppercase tracking-widest transition-all duration-150",
							canSpy
								? "border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 cursor-pointer active:scale-[0.97]"
								: "border-border bg-white/3 text-white/20 cursor-not-allowed",
						)}
					>
						<span className="text-lg">👁</span>
						<span>Spy</span>
						<span className="font-normal text-[10px] opacity-70">
							₱{spyPrice}
							{spyRemaining !== null && ` · ${spyRemaining} left`}
							{hiddenCount === 0 && " · nothing hidden"}
						</span>
					</button>

					<button
						type="button"
						onClick={handleSabotage}
						disabled={!canSabotage}
						className={cn(
							"flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl border text-xs font-bold uppercase tracking-widest transition-all duration-150",
							canSabotage
								? "border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 cursor-pointer active:scale-[0.97]"
								: "border-border bg-white/3 text-white/20 cursor-not-allowed",
							isSabotaged && "border-red-900/30 bg-red-900/10 text-red-700",
						)}
					>
						<span className="text-lg">💀</span>
						<span>{isSabotaged ? "Sabotaged" : "Sabotage"}</span>
						<span className="font-normal text-[10px] opacity-70">
							₱{sabotagePrice}
							{sabotageRemaining !== null &&
								!isSabotaged &&
								` · ${sabotageRemaining} left`}
							{isSabotaged && " · already done"}
						</span>
					</button>
				</div>
			</m.div>
		</m.div>
	);
}

// ── Manok list item ────────────────────────────────────────────────────────────

function ManokListItem({
	manok,
	hasReveal,
	isSabotaged,
	onClick,
}: {
	manok: ManokView;
	hasReveal: boolean;
	isSabotaged: boolean;
	onClick: () => void;
}) {
	const hiddenCount = Object.values(manok.stats).filter(
		(v) => v === null,
	).length;

	return (
		<button
			type="button"
			onClick={onClick}
			className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/3 border border-border hover:bg-white/6 active:scale-[0.99] transition-all duration-150 cursor-pointer text-left"
		>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-2">
					<span className="font-display font-bold text-sm text-white truncate">
						{manok.name}
					</span>
					{isSabotaged && <span className="text-[10px] text-red-400">💀</span>}
					{hasReveal && !isSabotaged && (
						<span className="text-[10px] text-yellow-400">👁</span>
					)}
				</div>
				<div className="flex gap-2 mt-0.5">
					{Object.entries(STAT_LABELS).map(([key, label]) => {
						const val = manok.stats[key as keyof typeof manok.stats];
						return (
							<span key={key} className="text-[10px] text-white/30">
								{label} {val === null ? "?" : val}
							</span>
						);
					})}
				</div>
			</div>

			{hiddenCount > 0 && (
				<span className="text-[10px] text-white/20 shrink-0">
					{hiddenCount} hidden
				</span>
			)}

			<span className="text-white/20 text-xs">›</span>
		</button>
	);
}

// ── Player ─────────────────────────────────────────────────────────────────────

export function ShopPlayer() {
	const { sabong, privateData, myPlayer, manokList, timer } = useSabongState();
	const [selectedManokId, setSelectedManokId] = useState<string | null>(null);

	if (!sabong || !myPlayer) return null;

	const { shopConfig } = sabong;
	const selectedManok = selectedManokId ? sabong.manoks[selectedManokId] : null;
	const round = sabong.currentMatchIndex <= 3 ? "Semi-Final" : "Final";

	return (
		<div className="flex flex-col min-h-screen bg-bg">
			{/* header */}
			<div className="flex flex-col gap-3 px-5 pt-6 pb-4 border-b border-border">
				<div className="flex items-center justify-between">
					<span className="font-display text-xs font-bold tracking-[0.25em] uppercase text-white/40">
						Round Break — Before {round}
					</span>
					<span className="font-display text-sm font-black text-white tabular-nums">
						₱{myPlayer.balance}
					</span>
				</div>

				{/* ayuda banner — only shown when the server granted emergency funds */}
				<AnimatePresence>
					{privateData?.receivedAyuda && (
						<m.div
							className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20"
							initial={{ opacity: 0, y: -4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: -4 }}
							transition={{ duration: 0.2 }}
						>
							<span className="text-sm">💸</span>
							<span className="text-xs font-bold text-blue-300">
								Ayuda granted — you were given emergency funds to keep playing.
							</span>
						</m.div>
					)}
				</AnimatePresence>

				<h1 className="font-display text-3xl font-black uppercase leading-none text-white">
					The Bazaar
				</h1>
				<p className="text-xs text-white/30">
					Spy on fighters or sabotage them before the next round. Only you see
					what you do.
				</p>
				<TimerBar timer={timer} />
			</div>

			{/* usage counters */}
			<div className="flex gap-3 px-4 pt-4">
				<div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-border">
					<span className="text-sm">👁</span>
					<div className="flex flex-col">
						<span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
							Spy
						</span>
						<span className="text-xs font-bold text-yellow-400">
							{privateData?.shopSpyRemaining === null
								? "∞"
								: (privateData?.shopSpyRemaining ??
									shopConfig.spyCap ??
									"—")}{" "}
							left · ₱{shopConfig.spyPrice} each
						</span>
					</div>
				</div>
				<div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/3 border border-border">
					<span className="text-sm">💀</span>
					<div className="flex flex-col">
						<span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
							Sabotage
						</span>
						<span className="text-xs font-bold text-red-400">
							{privateData?.shopSabotageRemaining === null
								? "∞"
								: (privateData?.shopSabotageRemaining ??
									shopConfig.sabotageCap ??
									"—")}{" "}
							left · ₱{shopConfig.sabotagePrice} each
						</span>
					</div>
				</div>
			</div>

			{/* manok list */}
			<div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
				{manokList.map((manok) => {
					const revealed = privateData?.revealedStats[manok.id] ?? {};
					const hasReveal = Object.keys(revealed).length > 0;
					const isSabotaged = manok.id in (privateData?.sabotaged ?? {});

					return (
						<ManokListItem
							key={manok.id}
							manok={manok}
							hasReveal={hasReveal}
							isSabotaged={isSabotaged}
							onClick={() => {
								setSelectedManokId(manok.id);
							}}
						/>
					);
				})}
			</div>

			{/* manok detail sheet */}
			<AnimatePresence>
				{selectedManok && (
					<ManokDetail
						manok={selectedManok}
						balance={myPlayer.balance}
						revealedStats={privateData?.revealedStats[selectedManok.id] ?? {}}
						isSabotaged={selectedManok.id in (privateData?.sabotaged ?? {})}
						sabotageDebuff={privateData?.sabotaged[selectedManok.id] ?? null}
						spyRemaining={privateData?.shopSpyRemaining ?? null}
						sabotageRemaining={privateData?.shopSabotageRemaining ?? null}
						spyPrice={shopConfig.spyPrice}
						sabotagePrice={shopConfig.sabotagePrice}
						onClose={() => {
							setSelectedManokId(null);
						}}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

// ── Host ───────────────────────────────────────────────────────────────────────

export function ShopHost() {
	const { sabong, players, timer } = useSabongState();

	if (!sabong) return null;

	const round = sabong.currentMatchIndex <= 3 ? "Semi-Final" : "Final";

	return (
		<div className="flex flex-col min-h-screen bg-bg px-8 py-8 gap-8">
			<div className="flex items-end justify-between">
				<div className="flex flex-col gap-1">
					<span className="font-display text-xs font-bold tracking-[0.3em] uppercase text-white/30">
						Round Break — Before {round}
					</span>
					<h1 className="font-display text-5xl font-black uppercase leading-none text-white">
						The Bazaar
					</h1>
					<p className="text-white/40 text-sm mt-1">
						Players are scouting and scheming on their phones
					</p>
				</div>
			</div>

			<TimerBar timer={timer} />

			{/* bracket progress */}
			<div className="flex flex-col gap-3">
				<p className="text-[10px] font-bold tracking-widest uppercase text-white/30">
					Bracket so far
				</p>
				<div className="flex flex-col gap-2">
					{sabong.bracket.map((slot) => {
						const f1 = slot.fighter1Id ? sabong.manoks[slot.fighter1Id] : null;
						const f2 = slot.fighter2Id ? sabong.manoks[slot.fighter2Id] : null;
						if (!f1 && !f2) return null;

						const isComplete = !!slot.winnerId;
						const winner = slot.winnerId ? sabong.manoks[slot.winnerId] : null;

						const roundLabel =
							slot.matchIndex < 4
								? `QF ${slot.matchIndex + 1}`
								: slot.matchIndex < 6
									? `SF ${slot.matchIndex - 3}`
									: "Final";

						return (
							<div
								key={slot.matchIndex}
								className={cn(
									"flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
									isComplete
										? "border-green-500/20 bg-green-500/5 text-white/60"
										: "border-border bg-white/3 text-white/40",
								)}
							>
								<span className="text-[10px] font-bold uppercase tracking-widest text-white/30 w-8 shrink-0">
									{roundLabel}
								</span>
								<span
									className={cn(
										slot.winnerId === slot.fighter1Id
											? "text-white font-bold"
											: "",
									)}
								>
									{f1?.name ?? "TBD"}
								</span>
								<span className="text-white/20 text-xs">vs</span>
								<span
									className={cn(
										slot.winnerId === slot.fighter2Id
											? "text-white font-bold"
											: "",
									)}
								>
									{f2?.name ?? "TBD"}
								</span>
								{winner && (
									<span className="ml-auto text-green-400 text-xs font-bold">
										→ {winner.name}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* player list */}
			<div className="flex flex-wrap gap-2">
				{players.map((p) => (
					<div
						key={p.id}
						className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-white/3 text-xs font-semibold text-white/50"
					>
						{p.name}
					</div>
				))}
			</div>
		</div>
	);
}