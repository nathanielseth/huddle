import { createBrowserRouter, RouterProvider } from "react-router";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { Join } from "./pages/Join";
import { useSocketInit } from "./hooks/useSocketInit";
import { useGameStore } from "./store/useGameStore";

function ConnectionBanner() {
	const status = useGameStore((s) => s.status);

	const visible =
		status === "connecting" || status === "disconnected" || status === "error";
	if (!visible) return null;

	const isReconnecting = status === "connecting" || status === "disconnected";

	return (
		<div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border text-xs font-semibold tracking-widest uppercase whitespace-nowrap">
			<span
				className={`w-1.5 h-1.5 rounded-full shrink-0 ${isReconnecting ? "bg-amber-400 animate-pulse" : "bg-red-500"}`}
			/>
			<span className="text-white/50">
				{isReconnecting ? "Reconnecting" : "No connection"}
			</span>
			{!isReconnecting && (
				<>
					<span className="w-px h-3 bg-border" />
					<button
						onClick={() => useGameStore.getState().connect()}
						className="text-huddle cursor-pointer hover:opacity-80 transition-opacity"
					>
						Retry
					</button>
				</>
			)}
		</div>
	);
}

const router = createBrowserRouter([
	{ path: "/", element: <Home /> },
	{ path: "/room/:code", element: <Room /> },
	{ path: "/join/:code", element: <Join /> },
]);

export default function App() {
	useSocketInit();
	return (
		<>
			<ConnectionBanner />
			<RouterProvider router={router} />
		</>
	);
}
