import { m } from "motion/react";
import { useWitzoneState } from "../hooks/useWitzoneState";

// Shared waiting screen — answering phases use hasAnswered, voting phases use hasVoted.
export function WaitingView({
	message,
	dotField = "hasAnswered",
}: {
	message: string;
	dotField?: "hasAnswered" | "hasVoted";
}) {
	const { state } = useWitzoneState();
	if (!state) return null;

	return (
		<div className="flex flex-col items-center justify-center min-h-screen px-6 gap-6">
			<m.div
				initial={{ scale: 0.8, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ type: "spring", stiffness: 260, damping: 20 }}
				className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl"
			>
				✓
			</m.div>
			<m.p
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
				className="text-white/60 text-sm"
			>
				{message}
			</m.p>
			<div className="flex gap-2 flex-wrap justify-center">
				{Object.values(state.players).map((p) => (
					<div
						key={p.id}
						className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
							p[dotField] ? "bg-white/80" : "bg-white/20"
						}`}
					/>
				))}
			</div>
		</div>
	);
}