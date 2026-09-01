import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";

const Home = lazy(() =>
	import("@/pages/Home").then((m) => ({ default: m.Home })),
);
const Room = lazy(() =>
	import("@/pages/Room").then((m) => ({ default: m.Room })),
);
const Join = lazy(() =>
	import("@/pages/Join").then((m) => ({ default: m.Join })),
);

const CardSandbox = lazy(
	() => import("@/games/face-turn/components/card/__sandbox__/CardSandbox"),
);
const ShellSandbox = lazy(
	() => import("@/games/face-turn/components/shell/__sandbox__/ShellSandbox"),
);
const HandSandbox = lazy(
	() => import("@/games/face-turn/components/hand/__sandbox__/HandSandbox"),
);
const MoveChainSandbox = lazy(
	() =>
		import("@/games/face-turn/components/move-chain/__sandbox__/MoveChainSandbox"),
);
const PhaseSceneSandbox = lazy(
	() =>
		import("@/games/face-turn/components/scene/__sandbox__/PhaseSceneSandbox"),
);
const HostBoardSandbox = lazy(
	() => import("@/games/face-turn/__sandbox__/HostBoardSandbox"),
);
const DraftSandbox = lazy(
	() => import("@/games/face-turn/__sandbox__/DraftSandbox"),
);
const SimSandbox = lazy(
	() => import("@/games/face-turn/__sandbox__/SimSandbox"),
);
const RpsSandbox = lazy(
	() => import("@/games/face-turn/phases/rps/__sandbox__/RpsSandbox"),
);

const pageFallback = <div className="min-h-screen bg-bg" />;

const router = createBrowserRouter([
	{
		path: "/",
		element: (
			<Suspense fallback={pageFallback}>
				<Home />
			</Suspense>
		),
	},
	{
		path: "/room/:code",
		element: (
			<Suspense fallback={pageFallback}>
				<Room />
			</Suspense>
		),
	},
	{
		path: "/join/:code",
		element: (
			<Suspense fallback={pageFallback}>
				<Join />
			</Suspense>
		),
	},
	////////
	{
		path: "/sandbox/card",
		element: (
			<Suspense fallback={pageFallback}>
				<CardSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/shell",
		element: (
			<Suspense fallback={pageFallback}>
				<ShellSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/hand",
		element: (
			<Suspense fallback={pageFallback}>
				<HandSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/move-chain",
		element: (
			<Suspense fallback={pageFallback}>
				<MoveChainSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/phase-scene",
		element: (
			<Suspense fallback={pageFallback}>
				<PhaseSceneSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/host-board",
		element: (
			<Suspense fallback={pageFallback}>
				<HostBoardSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/rps",
		element: (
			<Suspense fallback={pageFallback}>
				<RpsSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/draft",
		element: (
			<Suspense fallback={pageFallback}>
				<DraftSandbox />
			</Suspense>
		),
	},
	{
		path: "/sandbox/sim",
		element: (
			<Suspense fallback={pageFallback}>
				<SimSandbox />
			</Suspense>
		),
	},
]);

export function AppRouter() {
	return <RouterProvider router={router} />;
}