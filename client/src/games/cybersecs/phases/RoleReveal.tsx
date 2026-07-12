import { m } from "motion/react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { ROLE_META, MODE_LABELS } from "../constants";
import { cn } from "../../../lib/utils/cn";
import type { CybsecsState, CybsecsSecret } from "@shared/games/cybersecs";
import type { GameTimer, Player } from "@shared/core/room";

export function RoleReveal() {
	const { game, secret, role, timer, players, getName } = useCybsecsState();
	if (!game) return null;

	if (role === "host") {
		return <HostView game={game} timer={timer} players={players} />;
	}
	if (!secret) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading role…
			</div>
		);
	}
	return (
		<PlayerView game={game} secret={secret} timer={timer} getName={getName} />
	);
}

function HostView({
	game,
	timer,
	players,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	players: Player[];
}) {
	return (
		<div className="flex flex-col items-center justify-center min-h-screen gap-10 px-12">
			<div className="flex flex-col items-center gap-3 text-center">
				<span className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					{MODE_LABELS[game.mode]} Mode · {game.playerOrder.length} Players
				</span>
				<h1 className="font-display text-6xl font-black uppercase text-white">
					Role Reveal
				</h1>
				<p className="text-white/40">Players are reading their roles</p>
			</div>

			<div className="grid grid-cols-4 gap-3 w-full max-w-2xl">
				{players.map((p, i) => (
					<m.div
						key={p.id}
						className="px-4 py-3 rounded-xl bg-surface border border-border text-center"
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: i * 0.05 }}
					>
						<span className="text-sm font-semibold text-white/80">
							{p.name}
						</span>
					</m.div>
				))}
			</div>

			<div className="w-full max-w-xs">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

function PlayerView({
	game,
	secret,
	timer,
	getName,
}: {
	game: CybsecsState;
	secret: CybsecsSecret;
	timer: GameTimer | null;
	getName: (id: string) => string;
}) {
	const meta = ROLE_META[secret.role];
	const isAgent = meta.alignment === "agent";
	const accentCls = isAgent ? "text-cyan-400" : "text-red-400";
	const bgCls = isAgent
		? "bg-cyan-400/8 border-cyan-400/20"
		: "bg-red-400/8 border-red-400/20";

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-5">
			<div className="flex items-center justify-between">
				<span className="text-xs font-bold tracking-[0.25em] uppercase text-white/30">
					{MODE_LABELS[game.mode]}
				</span>
				<span
					className={cn(
						"text-xs font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border",
						bgCls,
						accentCls,
					)}
				>
					{isAgent ? "Agent" : "Hacker"}
				</span>
			</div>

			<m.div
				className={cn(
					"flex-1 flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 text-center",
					bgCls,
				)}
				initial={{ scale: 0.95, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.3, ease: "easeOut" }}
			>
				<p className="text-xs font-bold tracking-[0.3em] uppercase text-white/30">
					Your Role
				</p>
				<h1
					className={cn(
						"font-display text-7xl font-black uppercase leading-none",
						accentCls,
					)}
				>
					{meta.label}
				</h1>
				<p className="text-white/60 text-sm leading-relaxed max-w-xs">
					{meta.desc}
				</p>
			</m.div>

			<div className="flex flex-col gap-2.5">
				{secret.knownHackerIds.length > 0 && (
					<InfoBlock
						title={secret.role === "sysadmin" ? "All Hackers" : "Your Allies"}
						color="red"
						names={secret.knownHackerIds.map(getName)}
					/>
				)}
				{secret.flaggedCandidateIds && (
					<InfoBlock
						title="Suspects (one is the Sysadmin)"
						color="amber"
						names={[...secret.flaggedCandidateIds].map(getName)}
					/>
				)}
				{secret.knownEthicalHackerId && (
					<InfoBlock
						title="Ethical Hacker"
						color="cyan"
						names={[getName(secret.knownEthicalHackerId)]}
					/>
				)}
				{secret.role === "intern" && (
					<InfoBlock
						title="Isolated"
						color="white"
						note="Other hackers don't know you exist. You're on your own."
					/>
				)}
				{secret.obfuscatorUsesLeft > 0 && (
					<InfoBlock
						title="Obfuscate (1 use)"
						color="amber"
						note="During Nominating, Voting, or Mission — arm it to hide this mission's true result."
					/>
				)}
				{secret.role === "ethical_hacker" && (
					<InfoBlock
						title={`Ethical Hack (${secret.ethicalHackerUsesLeft} uses)`}
						color="cyan"
						note={`Choose "Hack" on a mission to neutralize all real hacks. ${secret.ethicalHackerUsesLeft} use${secret.ethicalHackerUsesLeft !== 1 ? "s" : ""} remaining.`}
					/>
				)}
			</div>

			<TimerBar timer={timer} />
		</div>
	);
}

function InfoBlock({
	title,
	color,
	names,
	note,
}: {
	title: string;
	color: "red" | "cyan" | "amber" | "white";
	names?: string[];
	note?: string;
}) {
	const cls: Record<string, string> = {
		red: "bg-red-400/8 border-red-400/20 text-red-400",
		cyan: "bg-cyan-400/8 border-cyan-400/20 text-cyan-400",
		amber: "bg-amber-400/8 border-amber-400/20 text-amber-400",
		white: "bg-white/4 border-border text-white/50",
	};
	return (
		<div className={cn("px-4 py-3 rounded-xl border", cls[color])}>
			<p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60 mb-1.5">
				{title}
			</p>
			{names && names.length > 0 && (
				<div className="flex flex-wrap gap-x-3 gap-y-1">
					{names.map((n) => (
						<span key={n} className="font-bold text-sm">
							{n}
						</span>
					))}
				</div>
			)}
			{note && <p className="text-xs opacity-70 leading-relaxed">{note}</p>}
		</div>
	);
}