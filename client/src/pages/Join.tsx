import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Navigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { useGameStore } from "../store/useGameStore";

const SHAKE = [0, -6, 6, -5, 5, -3, 3, 0];

export function Join() {
	const { code } = useParams<{ code: string }>();
	const navigate = useNavigate();
	const joinRoom = useGameStore((s) => s.joinRoom);
	const roomCode = useGameStore((s) => s.roomCode);
	const error = useGameStore((s) => s.error);
	const clearError = useGameStore((s) => s.clearError);

	const [name, setName] = useState("");
	const [shake, setShake] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		clearError();
		inputRef.current?.focus();
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	if (roomCode) return <Navigate to={`/room/${roomCode}`} replace />;

	function handleJoin() {
		const trimmed = name.trim();
		if (!trimmed || !code) {
			setShake(true);
			setTimeout(() => setShake(false), 400);
			return;
		}
		joinRoom(code.toUpperCase(), trimmed);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") handleJoin();
	}

	const roomCodeDisplay = code?.toUpperCase() ?? "????";

	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-6 bg-bg">
			<motion.div
				className="w-full max-w-sm flex flex-col gap-8"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				<div className="flex justify-center">
					<img
						src="/huddle-logo.svg"
						alt="Huddle!"
						className="w-32 opacity-60"
					/>
				</div>

				<div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface-raised p-6">
					<div className="flex flex-col items-center gap-1">
						<p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/40">
							Joining room
						</p>
						<span className="font-display text-5xl font-black tracking-[0.12em] uppercase text-white leading-none">
							{roomCodeDisplay}
						</span>
					</div>

					<div className="flex flex-col gap-2">
						<label
							htmlFor="join-name"
							className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50"
						>
							Your name
						</label>
						<motion.div
							className="relative"
							animate={{ x: shake ? SHAKE : 0 }}
							transition={{ type: "tween", duration: 0.4 }}
						>
							<input
								id="join-name"
								ref={inputRef}
								type="text"
								value={name}
								onChange={(e) => {
									setName(e.target.value.slice(0, 10));
									if (error) clearError();
								}}
								onKeyDown={handleKeyDown}
								placeholder="Enter your name"
								maxLength={10}
								className={`h-11 w-full px-4 pr-10 rounded-lg bg-white/5 border text-sm placeholder:text-white/30 outline-none transition-colors ${
									shake || error
										? "border-red-500/70"
										: "border-border focus:border-white/40"
								}`}
							/>
							<AnimatePresence>
								{name.length > 0 && (
									<motion.button
										type="button"
										initial={{ opacity: 0, scale: 0.7 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.7 }}
										transition={{ duration: 0.12 }}
										onClick={() => {
											setName("");
											clearError();
										}}
										className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
										tabIndex={-1}
										aria-label="Clear name"
									>
										<X size={14} strokeWidth={2.5} />
									</motion.button>
								)}
							</AnimatePresence>
						</motion.div>

						<AnimatePresence>
							{error && (
								<motion.p
									key="join-error"
									className="text-xs text-red-400/80"
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									transition={{ duration: 0.15 }}
								>
									{error}
								</motion.p>
							)}
						</AnimatePresence>
					</div>

					<button
						type="button"
						onClick={handleJoin}
						className={`h-11 w-full rounded-lg text-sm font-bold tracking-widest uppercase transition-all duration-150 ${
							name.trim().length > 0
								? "bg-huddle text-white cursor-pointer hover:opacity-85 active:opacity-70"
								: "bg-white/8 text-white/30 cursor-default"
						}`}
					>
						Join →
					</button>
				</div>

				<button
					type="button"
					onClick={() => navigate("/")}
					className="text-xs text-white/30 hover:text-white/60 transition-colors mx-auto cursor-pointer"
				>
					Back to home
				</button>
			</motion.div>
		</div>
	);
}
