import { RouterProvider } from "react-router";
import { router } from "@/app/router";
import { Toaster } from "@/components/ui/Toaster";
import { useSocketInit } from "@/hooks/network/useSocket";

export default function App() {
	useSocketInit();
	return (
		<>
			<RouterProvider router={router} />
			<Toaster />
		</>
	);
}
