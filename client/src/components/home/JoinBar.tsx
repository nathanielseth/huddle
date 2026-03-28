import { useRef, useState } from "react";

interface JoinBarProps {
	onFocus: () => void;
}

export function JoinBar({ onFocus }: JoinBarProps) {
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const nameRef = useRef<HTMLInputElement>(null);

	function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
		const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
		setCode(val);
		if (val.length === 6) nameRef.current?.focus();
	}

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="text-sm font-semibold text-white">QUICK JOIN</h2>
			</div>

			<div className="flex flex-col sm:flex-row sm:items-end gap-3">
				<div className="flex flex-col gap-2 w-full sm:w-40 shrink-0">
					<label
						htmlFor="room-code"
						className="text-[11px] font-semibold tracking-[0.15em] text-white/50"
					>
						ROOM CODE
					</label>
					<input
						type="text"
						value={code}
						onChange={handleCodeChange}
						onFocus={onFocus}
						placeholder="Enter Room Code "
						maxLength={4}
						className="h-11 w-full px-4 rounded-lg bg-white/5 border border-border text-sm font-bold uppercase tracking-[0.2em] placeholder:text-white/30 placeholder:normal-case placeholder:tracking-normal placeholder:font-normal outline-none focus:border-white/40 transition-colors"
					/>
				</div>

				<div className="flex flex-col gap-2 w-full sm:w-56 shrink-0">
					<label
						htmlFor="player-name"
						className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50"
					>
						Your Name
					</label>
					<input
						ref={nameRef}
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						onFocus={onFocus}
						placeholder="Enter Your Name"
						maxLength={10}
						className="h-11 w-full px-4 rounded-lg bg-white/5 border border-border text-sm placeholder:text-white/30 outline-none focus:border-white/40 transition-colors"
					/>
				</div>

				<button
					type="button"
					className="h-11 w-full sm:w-auto sm:px-8 mt-4 sm:mt-0 rounded-lg bg-huddle text-white text-sm font-bold uppercase tracking-widest transition-opacity hover:opacity-85 active:opacity-70 cursor-pointer whitespace-nowrap"
				>
					Join Game
				</button>
			</div>
		</div>
	);
}
