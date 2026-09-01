import { m } from "motion/react";
import { useCybsecsState } from "../hooks/useCybsecsState";
import { TimerBar } from "../../sabong/components/TimerBar";
import { MissionTrack } from "../components/MissionTrack";
import { cn } from "../../../lib/utils/cn";
import type {
	CybsecsState,
	CybsecsSecret,
	MissionResult,
} from "@shared/games/breachpoint/index";
import type { GameTimer } from "@shared/core/room";

export function MissionResult() {
	const { game, secret, role, timer } = useCybsecsState();
	if (!game) return null;

	// missionResults' last entry is the just-completed mission, missionIndex still points to the upcoming one
	const result = game.missionResults[game.missionResults.length - 1];
	if (!result) return null;

	if (role === "host") {
		return <HostView game={game} timer={timer} result={result} />;
	}
	return (
		<PlayerView game={game} secret={secret} timer={timer} result={result} />
	);
}

function ResultCard({ result }: { result: MissionResult }) {
	if (result.obfuscated) {
		return (
			<div className="flex flex-col items-center gap-3">
				<div className="w-28 h-28 rounded-full bg-amber-400/15 border-2 border-amber-400/40 flex items-center justify-center font-display font-black text-5xl text-amber-400">
					?
				</div>
				<p className="font-display text-5xl font-black uppercase text-amber-400">
					Obfuscated
				</p>
				<p className="text-white/40 text-sm">True result is hidden.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center gap-3">
			<div
				className={cn(
					"w-28 h-28 rounded-full flex items-center justify-center font-display font-black text-5xl border-2",
					result.secured
						? "bg-green-500/15 border-green-500/50 text-green-400"
						: "bg-red-500/15 border-red-500/50 text-red-400",
				)}
			>
				{result.secured ? "✓" : "✗"}
			</div>
			<p
				className={cn(
					"font-display text-5xl font-black uppercase",
					result.secured ? "text-green-400" : "text-red-400",
				)}
			>
				{result.secured ? "Secured" : "Hacked"}
			</p>
			{!result.secured && (
				<p className="text-white/40 text-sm">
					{result.hackCount}/{result.requiredHacks} hacks
				</p>
			)}
		</div>
	);
}

function HostView({
	game,
	timer,
	result,
}: {
	game: CybsecsState;
	timer: GameTimer | null;
	result: MissionResult;
}) {
	return (
		<div className="flex flex-col min-h-screen px-12 py-10 gap-10">
			<MissionTrack
				missionResults={game.missionResults}
				missionIndex={game.missionIndex}
				playerCount={game.playerOrder.length}
			/>

			<div className="flex-1 flex flex-col items-center justify-center gap-8">
				<m.div
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ duration: 0.35, ease: "easeOut" }}
				>
					<ResultCard result={result} />
				</m.div>

				<div className="flex gap-10 text-center">
					<div>
						<p className="font-display text-5xl font-black text-green-400">
							{game.secureds}
						</p>
						<p className="text-xs text-white/30 uppercase tracking-widest mt-1">
							Secured
						</p>
					</div>
					<div className="w-px bg-border" />
					<div>
						<p className="font-display text-5xl font-black text-red-400">
							{game.hacked}
						</p>
						<p className="text-xs text-white/30 uppercase tracking-widest mt-1">
							Hacked
						</p>
					</div>
				</div>
			</div>

			<div className="w-full max-w-xs mx-auto">
				<TimerBar timer={timer} />
			</div>
		</div>
	);
}

function PlayerView({
	game,
	secret,
	timer,
	result,
}: {
	game: CybsecsState;
	secret: CybsecsSecret | null;
	timer: GameTimer | null;
	result: MissionResult;
}) {
	// use dedicated mission-index fields for gating (canonical api over nested missionIndex)
	const obfIntel =
		secret?.obfuscatorIntelMissionIndex === game.missionIndex
			? secret.obfuscatorIntel
			: null;
	const showEhIntel =
		secret?.ehIntel != null && secret.ehIntelMissionIndex === game.missionIndex;

	return (
		<div className="flex flex-col min-h-screen px-5 py-8 gap-6">
			<div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
				<m.div
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ duration: 0.3, ease: "easeOut" }}
				>
					<ResultCard result={result} />
				</m.div>

				<div className="flex gap-8 text-center">
					<div>
						<p className="font-display text-3xl font-black text-green-400">
							{game.secureds}
						</p>
						<p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">
							Secured
						</p>
					</div>
					<div>
						<p className="font-display text-3xl font-black text-red-400">
							{game.hacked}
						</p>
						<p className="text-[10px] text-white/30 uppercase tracking-widest mt-0.5">
							Hacked
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				{obfIntel && (
					<div className="px-4 py-3 rounded-xl bg-amber-400/8 border border-amber-400/20">
						<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70 mb-1">
							Obfuscator Intel (Private)
						</p>
						<p className="text-sm text-amber-400">
							True result:{" "}
							{obfIntel.secured
								? "SECURED"
								: `HACKED (${obfIntel.hackCount}/${obfIntel.requiredHacks} hacks)`}
						</p>
					</div>
				)}
				{showEhIntel && (
					<div className="px-4 py-3 rounded-xl bg-cyan-400/8 border border-cyan-400/20">
						<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/70 mb-1">
							EH Backfire Intel (Private)
						</p>
						<p className="text-sm text-cyan-400">
							{secret.ehIntel === "hacker_detected"
								? "A hacker was detected on the team."
								: "No detectable hacker on the team."}
						</p>
					</div>
				)}
			</div>

			<TimerBar timer={timer} />
		</div>
	);
}