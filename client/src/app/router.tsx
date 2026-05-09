import { createBrowserRouter } from "react-router";
import { Home } from "@/pages/Home";
import { Room } from "@/pages/Room";
import { Join } from "@/pages/Join";

export const router = createBrowserRouter([
	{ path: "/", element: <Home /> },
	{ path: "/room/:code", element: <Room /> },
	{ path: "/join/:code", element: <Join /> },
]);