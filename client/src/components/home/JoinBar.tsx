import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X, ArrowRight } from "lucide-react";

interface JoinBarProps {
	onFocus: () => void;
}

export function JoinBar({ onFocus }: JoinBarProps) {
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [shakeCode, setShakeCode] = useState(false);
	const [shakeName, setShakeName] = useState(false);
	const nameRef = useRef<HTMLInputElement>(null);

	const isValid = code.length === 4 && name.trim().length > 0;

	function triggerShake(field: "code" | "name") {
		if (field === "code") {
			setShakeCode(true);
			setTimeout(() => setShakeCode(false), 400);
		} else {
			setShakeName(true);
			setTimeout(() => setShakeName(false), 400);
		}
	}

	function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
		const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
		setCode(val);
		if (val.length === 4) nameRef.current?.focus();
	}

	function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
		setName(e.target.value);
	}

	function handleJoin() {
		if (!isValid) {
			if (code.length < 4) triggerShake("code");
			if (name.trim().length === 0) triggerShake("name");
			return;
		}
		// TODO: fire socket event
	}

	const shakeTransition = {
		type: "tween" as const,
		duration: 0.4,
	};

	const shakeKeyframes = [0, -6, 6, -5, 5, -3, 3, 0];

	return (
		<div className="flex flex-col gap-4">
			<h2 className="text-sm font-semibold text-white">QUICK JOIN</h2>

			<div className="flex flex-col sm:flex-row sm:items-end gap-3">
				{/* room code */}
				<div className="flex flex-col gap-2 w-full sm:w-40 shrink-0">
					<label
						htmlFor="room-code"
						className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50"
					>
						Room Code
					</label>
					<motion.div
						className="relative"
						animate={{ x: shakeCode ? shakeKeyframes : 0 }}
						transition={shakeTransition}
					>
						<input
							id="room-code"
							type="text"
							value={code}
							onChange={handleCodeChange}
							onFocus={onFocus}
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
								<motion.button
									type="button"
									initial={{ opacity: 0, scale: 0.7 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.7 }}
									transition={{ duration: 0.12 }}
									onClick={() => setCode("")}
									className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors cursor-pointer"
									tabIndex={-1}
									aria-label="Clear room code"
								>
									<X size={14} strokeWidth={2.5} />
								</motion.button>
							)}
						</AnimatePresence>
					</motion.div>
				</div>

				{/* name */}
				<div className="flex flex-col gap-2 w-full sm:w-56 shrink-0">
					<label
						htmlFor="player-name"
						className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/50"
					>
						Your Name
					</label>
					<motion.div
						className="relative"
						animate={{ x: shakeName ? shakeKeyframes : 0 }}
						transition={shakeTransition}
					>
						<input
							id="player-name"
							ref={nameRef}
							type="text"
							value={name}
							onChange={handleNameChange}
							onFocus={onFocus}
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
								<motion.span
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.15 }}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono tabular-nums pointer-events-none text-white/25"
								>
									{10 - name.length}
								</motion.span>
							)}
						</AnimatePresence>
					</motion.div>
				</div>

				{/* join button */}
				<div className="flex flex-col gap-2 mt-4 sm:mt-0">
					<span className="hidden sm:block text-[11px] opacity-0 select-none">
						&nbsp;
					</span>
					<button
						type="button"
						onClick={handleJoin}
						className={`h-11 w-full sm:w-auto sm:px-7 rounded-lg text-sm font-bold uppercase tracking-widest cursor-pointer whitespace-nowrap flex items-center justify-center gap-2 transition-all duration-150 ${
							isValid
								? "bg-huddle text-white hover:opacity-85 active:opacity-70"
								: "bg-white/8 text-white/30"
						}`}
					>
						Join
					</button>
				</div>
			</div>
		</div>
	);
}
