import { useRef, type FC } from "react";
import { useGameStore } from "../../store/useGameStore";
import { useSabongState } from "./hooks/useSabongState";
import { usePhaseWipe } from "./hooks/usePhaseWipe";
import { WipeCanvas, type WipeHandle } from "./components/WipeCanvas";
import { PreTournamentPlayer, PreTournamentHost } from "./phases/PreTournament";
import { BettingPlayer, BettingHost } from "./phases/Betting";
import { FightingPlayer, FightingHost } from "./phases/Fighting";
import { PayoutPlayer, PayoutHost } from "./phases/Payout";
import { FinishedPlayer, FinishedHost } from "./phases/Finished";

type SabongPhase =
	| "pre_tournament"
	| "betting"
	| "fighting"
	| "payout"
	| "finished";
type PhaseMap = Partial<Record<SabongPhase, FC>>;

const PLAYER_PHASES: PhaseMap = {
	pre_tournament: PreTournamentPlayer,
	betting: BettingPlayer,
	fighting: FightingPlayer,
	payout: PayoutPlayer,
	finished: FinishedPlayer,
};

const HOST_PHASES: PhaseMap = {
	pre_tournament: PreTournamentHost,
	betting: BettingHost,
	fighting: FightingHost,
	payout: PayoutHost,
	finished: FinishedHost,
};

const WIPE_COLOR: [number, number, number] = [0.3, 0.04, 0.04];

export function SabongGame() {
	const role = useGameStore((s) => s.role);
	const { sabong } = useSabongState();
	const wipeRef = useRef<WipeHandle>(null);

	const phaseMap = role === "host" ? HOST_PHASES : PLAYER_PHASES;

	const visiblePhase = usePhaseWipe<SabongPhase>({
		source: sabong?.phase as SabongPhase | undefined,
		onWipe: (swap) => wipeRef.current?.wipe(swap),
	});

	if (!sabong) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-bg text-white/40 text-sm">
				Loading…
			</div>
		);
	}

	const PhaseComponent = visiblePhase ? phaseMap[visiblePhase] : null;

	return (
		<div className="relative w-full h-screen overflow-hidden bg-black">
			{PhaseComponent && <PhaseComponent />}
			<WipeCanvas ref={wipeRef} color={WIPE_COLOR} duration={0.7} />
		</div>
	);
}
