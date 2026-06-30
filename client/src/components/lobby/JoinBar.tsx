import { useRef, useReducer } from "react";
import { AnimatePresence, m } from "motion/react";
import { X, Loader2 } from "lucide-react";
import { useGameStore } from "../../app/store";

interface JoinBarProps {
	onFocus: () => void;
}

const SHAKE = [0, -6, 6, -5, 5, -3, 3, 0];
const SHAKE_TRANSITION = { type: "tween" as const, duration: 0.4 };
const JOIN_TIMEOUT_MS = 350;

type JoinState = {
	code: string;
	name: string;
	shakeCode: boolean;
	shakeName: boolean;
	isPending: boolean;
};

type JoinAction =
	| { type: "SET_CODE"; value: string }
	| { type: "SET_NAME"; value: string }
	| { type: "SHAKE"; field: "code" | "name" | "both" }
	| { type: "CLEAR_SHAKE" }
	| { type: "SET_PENDING"; value: boolean }
	| { type: "CANCEL" }
	| { type: "CLEAR_CODE" };

const INITIAL_JOIN: JoinState = {
	code: "",
	name: "",
	shakeCode: false,
	shakeName: false,
	isPending: false,
};

function joinReducer(state: JoinState, action: JoinAction): JoinState {
	switch (action.type) {
		case "SET_CODE":
			return { ...state, code: action.value, isPending: false };
		case "SET_NAME":
			return { ...state, name: action.value, isPending: false };
		case "SHAKE":
			return {
				...state,
				shakeCode: action.field === "code" || action.field === "both",
				shakeName: action.field === "name" || action.field === "both",
			};
		case "CLEAR_SHAKE":
			return { ...state, shakeCode: false, shakeName: false };
		case "SET_PENDING":
			return { ...state, isPending: action.value };
		case "CANCEL":
			return { ...state, isPending: false };
		case "CLEAR_CODE":
			return { ...state, code: "", isPending: false };
		default:
			return state;
	}
}

export function JoinBar({ onFocus }: JoinBarProps) {
	const [state, dispatch] = useReducer(joinReducer, INITIAL_JOIN);
	const { code, name, shakeCode, shakeName, isPending } = state;

	const nameRef = useRef<HTMLInputElement>(null);
	const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const joinRoom = useGameStore((s) => s.joinRoom);

	const isValid = code.length === 4 && name.trim().length > 0;
	const buttonActive = isValid && !isPending;

	function shake(field: "code" | "name" | "both") {
		dispatch({ type: "SHAKE", field });
		setTimeout(() => { dispatch({ type: "CLEAR_SHAKE" }); }, 400);
	}

	function cancelPending() {
		dispatch({ type: "CANCEL" });
		if (pendingTimer.current) {
			clearTimeout(pendingTimer.current);
			pendingTimer.current = null;
		}
	}

	function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
		if (isPending) cancelPending();
		const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
		dispatch({ type: "SET_CODE", value: val });
		if (val.length === 4) nameRef.current?.focus();
	}

	function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
		if (isPending) cancelPending();
		dispatch({ type: "SET_NAME", value: e.target.value });
	}

	function handleJoin() {
		if (isPending) return;
		if (!isValid) {
			if (code.length < 4 && name.trim().length === 0) shake("both");
			else if (code.length < 4) shake("code");
			else shake("name");
			return;
		}

		dispatch({ type: "SET_PENDING", value: true });
		joinRoom(code, name.trim());

		if (pendingTimer.current) clearTimeout(pendingTimer.current);
		pendingTimer.current = setTimeout(() => {
			dispatch({ type: "SET_PENDING", value: false });
			pendingTimer.current = null;
			shake("both");
		}, JOIN_TIMEOUT_MS);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") handleJoin();
	}

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-sm font-semibold text-white">QUICK JOIN</h2>

			<div className="flex flex-col sm:flex-row sm:items-end gap-3">
				{/* Room Code Input */}
				<div className="flex flex-col gap-2 w-full sm:w-40 shrink-0">
					<label
						htmlFor="room-code"
						className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50"
					>
						Room Code
					</label>
					<m.div
						className="relative"
						animate={{ x: shakeCode ? SHAKE : 0 }}
						transition={SHAKE_TRANSITION}
					>
						<input
							id="room-code"
							type="text"
							value={code}
							onChange={handleCodeChange}
							onFocus={onFocus}
							onKeyDown={handleKeyDown}
							placeholder="ABCD"
							maxLength={4}
							className={`h-11 w-full px-4 pr-9 rounded-lg bg-white/5 border text-sm font-bold uppercase tracking-[0.2em] placeholder:text-white/20 placeholder:tracking-widest outline-none transition-colors ${
								shakeCode
									? "border-red-500/70"
									: "border-border focus:border-white/40"
							}`}
						/>
						<AnimatePresence>
							{code.length > 0 && (
								<m.button
									type="button"
									initial={{ opacity: 0, scale: 0.7 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.7 }}
									transition={{ duration: 0.12 }}
									onClick={() => {
										dispatch({ type: "CLEAR_CODE" });
										cancelPending();
									}}
									className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
									tabIndex={-1}
									aria-label="Clear room code"
								>
									<X size={14} strokeWidth={2.5} />
								</m.button>
							)}
						</AnimatePresence>
					</m.div>
				</div>

				{/* Player Name Input */}
				<div className="flex flex-col gap-2 w-full sm:w-56 shrink-0">
					<label
						htmlFor="player-name"
						className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50"
					>
						Your Name
					</label>
					<m.div
						className="relative"
						animate={{ x: shakeName ? SHAKE : 0 }}
						transition={SHAKE_TRANSITION}
					>
						<input
							id="player-name"
							ref={nameRef}
							type="text"
							value={name}
							onChange={handleNameChange}
							onFocus={onFocus}
							onKeyDown={handleKeyDown}
							placeholder="Enter your name"
							maxLength={10}
							className={`h-11 w-full px-4 pr-10 rounded-lg bg-white/5 border text-sm placeholder:text-white/30 outline-none transition-colors ${
								shakeName
									? "border-red-500/70"
									: "border-border focus:border-white/40"
							}`}
						/>
						<AnimatePresence>
							{name.length > 0 && (
								<m.span
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono tabular-nums pointer-events-none text-white/25"
								>
									{10 - name.length}
								</m.span>
							)}
						</AnimatePresence>
					</m.div>
				</div>

				{/* Action Button */}
				<div className="flex flex-col gap-2 mt-4 sm:mt-0">
					<span className="hidden sm:block text-[11px] opacity-0 select-none">
						&nbsp;
					</span>
					<button
						type="button"
						onClick={handleJoin}
						disabled={isPending}
						className={`h-11 w-full sm:w-auto sm:px-8 rounded-lg text-sm font-bold uppercase tracking-widest whitespace-nowrap flex items-center justify-center transition-all duration-150 relative ${
							isPending
								? "bg-huddle/50 text-white/50 cursor-not-allowed"
								: buttonActive
									? "bg-huddle text-white cursor-pointer hover:opacity-85 active:opacity-70"
									: "bg-white/8 text-white/30 cursor-not-allowed"
						}`}
					>
						<span className="invisible block px-1">Joining...</span>
						<span className="absolute inset-0 flex items-center justify-center gap-2">
							{isPending ? (
								<>
									<Loader2 size={14} className="animate-spin" />
									Joining...
								</>
							) : (
								"Join Room"
							)}
						</span>
					</button>
				</div>
			</div>
		</div>
	);
}