import { RouterProvider } from "react-router";
import { router } from "@/app/router";
import { Toaster } from "@/components/ui/Toaster";
import { useSocketInit } from "@/hooks/network/useSocketInit";
import { LazyMotion, domAnimation } from "motion/react";

export default function App() {
	useSocketInit();
	return (
		<LazyMotion features={domAnimation}>
			<RouterProvider router={router} />
			<Toaster />
		</LazyMotion>
	);
}