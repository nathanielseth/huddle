import { createBrowserRouter, RouterProvider } from "react-router";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";
import { Join } from "./pages/Join";
import { useSocketInit } from "./hooks/useSocketInit";

const router = createBrowserRouter([
	{ path: "/", element: <Home /> },
	{ path: "/room/:code", element: <Room /> },
	{ path: "/join/:code", element: <Join /> },

]);

export default function App() {
	useSocketInit();
	return <RouterProvider router={router} />;
}