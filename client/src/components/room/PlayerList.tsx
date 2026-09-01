import { m, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import type { Player } from "@shared/core/room";

interface Props {
	players: Player[];
	playerId: string | null;
	onKick?: (playerId: string) => void;
	onRemoveCpu?: (playerId: string) => void;
}

export function PlayerList({ players, playerId, onKick, onRemoveCpu }: Props) {
	return (
		<m.div
			className="flex flex-col min-h-0 gap-3 w-full"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: 0.1, duration: 0.3 }}
		>
			<p className="text-xs font-semibold tracking-[0.2em] uppercase text-white/40 shrink-0">
				Players{" "}
				<span className="text-white/20">
					{players.filter((p) => p.isConnected).length}/{players.length}
				</span>
			</p>

			<div className="flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
				<AnimatePresence>
					{players.length === 0 ? (
						<m.p
							key="empty"
							className="text-sm text-white/25 py-4 text-center"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						>
							No players yet
						</m.p>
					) : (
						players.map((player, index) => (
							<m.div
								key={player.id}
								className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white/4 border border-border"
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: 10 }}
								transition={{ duration: 0.2 }}
							>
								<div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/8 text-xs font-bold text-white/60 shrink-0 uppercase">
									{index === 0 ? "👑" : player.name.slice(0, 2)}
								</div>
								<span className="flex-1 text-sm font-medium text-white truncate">
									{player.name}
									{player.id === playerId && (
										<span className="ml-2 text-xs text-white/30">(you)</span>
									)}
									{player.isCpu && (
										<span className="ml-2 text-xs text-white/30 uppercase tracking-widest">
											CPU
										</span>
									)}
								</span>
								<span
									className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
										player.isConnected ? "bg-green-400" : "bg-white/20"
									}`}
								/>
								{player.isCpu && onRemoveCpu ? (
									<button
										type="button"
										onClick={() => {
											onRemoveCpu(player.id);
										}}
										aria-label={`Remove CPU ${player.name}`}
										className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"
									>
										<X size={12} />
									</button>
								) : (
									onKick &&
									index !== 0 &&
									!player.isCpu && (
										<button
											type="button"
											onClick={() => {
												onKick(player.id);
											}}
											aria-label={`Kick ${player.name}`}
											className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all cursor-pointer"
										>
											<X size={12} />
										</button>
									)
								)}
							</m.div>
						))
				)}
				</AnimatePresence>
			</div>
		</m.div>
	);
}