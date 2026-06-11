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
]);

export function AppRouter() {
	return <RouterProvider router={router} />;
}