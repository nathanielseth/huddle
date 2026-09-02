import { useEffect } from "react";
import { cn } from "../../../lib/utils/cn";
import { sendFaceturnAction } from "../actions";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { useActionLock } from "../../../hooks/network/useActionLock";

function isTypingInField(): boolean {
	const el = document.activeElement;
	if (!el) return false;
	const tag = el.tagName;
	return (
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		(el as HTMLElement).isContentEditable
	);
}

function useSpacebarToPass(onPass: (() => void) | null) {
	useEffect(() => {
		if (!onPass) return;
		function handleKeyDown(e: KeyboardEvent) {
			if (e.code !== "Space" || e.repeat) return;
			if (isTypingInField()) return;
			e.preventDefault();
			onPass?.();
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onPass]);
}

function SpacebarHint() {
	return (
		<kbd
			className={cn(
				"block mx-auto mt-1 w-fit px-2 py-0.5 rounded border text-[9px] font-bold tracking-wide",
				"border-current/30 text-current/70",
			)}
		>
			Space
		</kbd>
	);
}

export function PassButton() {
	const { ft, isMyTurn, isChainParticipant, isChainResponder } =
		useFaceturnState();
	const { locked, runLocked } = useActionLock(ft?.phase);

	const chainOpen = Boolean(
		ft && ft.phase === "move_chain_window" && ft.moveChain,
	);

	const canPassChain = chainOpen && isChainParticipant && isChainResponder;
	const canPassTurn = !chainOpen && isMyTurn;

	const chainPass = () => {
		runLocked(() => {
			sendFaceturnAction({ type: "chain_pass" });
		});
	};
	const endTurn = () => {
		runLocked(() => {
			sendFaceturnAction({ type: "end_turn" });
		});
	};

	useSpacebarToPass(
		locked ? null : canPassChain ? chainPass : canPassTurn ? endTurn : null,
	);

	if (!ft) return null;

	if (chainOpen) {
		if (!isChainParticipant) return null;
		return (
			<button
				type="button"
				disabled={locked || !isChainResponder}
				title={isChainResponder ? undefined : "It's not your turn to pass"}
				onClick={chainPass}
				className={cn(
					"pointer-events-auto px-4 py-2 rounded-lg border text-sm font-bold shadow-lg shadow-black/40 transition-all",
					locked || !isChainResponder
						? "border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
						: "border-amber-400/60 bg-[#0c1730] text-amber-200 cursor-pointer hover:bg-amber-400/10",
				)}
			>
				Pass
				{!locked && isChainResponder && <SpacebarHint />}
			</button>
		);
	}

	if (!isMyTurn) return null;
	return (
		<button
			type="button"
			disabled={locked}
			onClick={endTurn}
			className={cn(
				"pointer-events-auto px-4 py-2 rounded-lg border text-sm font-bold shadow-lg shadow-black/40 transition-all",
				locked
					? "border-white/10 bg-white/5 text-white/20 cursor-not-allowed"
					: "border-amber-400/60 bg-[#0c1730] text-amber-200 cursor-pointer hover:bg-amber-400/10",
			)}
		>
			Pass turn
			{!locked && <SpacebarHint />}
		</button>
	);
}