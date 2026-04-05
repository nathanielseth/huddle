import { createBrowserRouter, RouterProvider } from "react-router";
import { Home } from "./pages/Home";
import { Room } from "./pages/Room";

const router = createBrowserRouter([
	{ path: "/", element: <Home /> },
	{ path: "/room/:code", element: <Room /> },
]);

export default function App() {
	return <RouterProvider router={router} />;
}