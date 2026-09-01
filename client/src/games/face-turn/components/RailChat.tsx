import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../../app/store";
import { useFaceturnState } from "../hooks/useFaceturnState";
import { SectionTitle } from "./SectionTitle";
import { cn } from "../../../lib/utils/cn";
import { MAX_CHAT_MESSAGE_LENGTH } from "@shared/core/chat";
import type { ChatMessage } from "@shared/core/chat";

const CHAT_MAX_HEIGHT_PX = 220;

function useTeamIndexOf(): (playerId: string) => number | null {
	const { ft } = useFaceturnState();
	return (playerId: string) => {
		if (!ft || ft.mode !== "teams") return null;
		const idx = ft.teams.findIndex((team) => team.includes(playerId));
		return idx === -1 ? null : idx;
	};
}

function nameColorClass(
	teamIndex: number | null,
	role: ChatMessage["role"],
): string {
	if (role === "spectator") return "text-white/45";
	if (teamIndex === 0) return "text-sky-400";
	if (teamIndex === 1) return "text-rose-400";
	return "text-white/80";
}

function formatTime(sentAt: number): string {
	return new Date(sentAt).toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

function ChatRow({ message }: { message: ChatMessage }) {
	const teamIndexOf = useTeamIndexOf();
	const teamIndex = teamIndexOf(message.playerId);

	return (
		<div className="flex flex-col gap-0.5">
			<div className="flex items-baseline gap-1.5 min-w-0">
				<span
					className={cn(
						"text-xs font-bold truncate",
						nameColorClass(teamIndex, message.role),
					)}
				>
					{message.name}
					{message.role === "spectator" && (
						<span className="text-white/30 font-normal"> (spectator)</span>
					)}
				</span>
				<span className="text-[10px] text-white/25 tabular-nums shrink-0">
					{formatTime(message.sentAt)}
				</span>
			</div>
			<p className="text-xs text-white/75 wrap-break-word leading-snug">
				{message.text}
			</p>
		</div>
	);
}

export function RailChat() {
	const chatMessages = useGameStore((s) => s.chatMessages);
	const sendChatMessage = useGameStore((s) => s.sendChatMessage);
	const status = useGameStore((s) => s.status);
	const [draft, setDraft] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	// stick to bottom on new messages, same as any live chat feed
	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	}, [chatMessages]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = draft.trim();
		if (!trimmed) return;
		sendChatMessage(trimmed);
		setDraft("");
	}

	return (
		<div className="flex flex-col gap-1.5 px-4 pb-4 pt-1 border-t border-white/10 shrink-0">
			<SectionTitle>Chat</SectionTitle>

			<div
				ref={scrollRef}
				className="flex flex-col gap-2 overflow-y-auto pr-1"
				style={{ maxHeight: CHAT_MAX_HEIGHT_PX, touchAction: "pan-y" }}
			>
				{chatMessages.length === 0 ? (
					<p className="text-xs text-white/25 italic">No messages yet.</p>
				) : (
					chatMessages.map((m) => <ChatRow key={m.id} message={m} />)
				)}
			</div>

			<form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1">
				<input
					type="text"
					value={draft}
					onChange={(e) =>
						setDraft(e.target.value.slice(0, MAX_CHAT_MESSAGE_LENGTH))
					}
					placeholder="Say something…"
					disabled={status !== "connected"}
					maxLength={MAX_CHAT_MESSAGE_LENGTH}
					className={cn(
						"flex-1 min-w-0 rounded-md bg-white/5 border border-white/10",
						"px-2.5 py-1.5 text-xs text-white/90 placeholder:text-white/30",
						"focus:outline-none focus:border-white/30",
						"disabled:opacity-40",
					)}
				/>
				<button
					type="submit"
					disabled={status !== "connected" || draft.trim().length === 0}
					className={cn(
						"ft-eyebrow text-[11px] px-3 py-1.5 rounded-md shrink-0",
						"bg-white/10 text-white/80 hover:bg-white/15",
						"disabled:opacity-30 disabled:hover:bg-white/10",
						"transition-colors",
					)}
				>
					Send
				</button>
			</form>
		</div>
	);
}