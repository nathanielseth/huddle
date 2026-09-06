import { AppRouter } from "@/app/router";
import { Modal } from "@/components/ui/Modal";
import { Toaster } from "@/components/ui/Toaster";
// import { SandboxLauncher } from "@/components/dev/SandboxLauncher";
import { useSocketInit } from "@/hooks/network/useSocketInit";
import { LazyMotion, domAnimation } from "motion/react";

export default function App() {
	useSocketInit();
	return (
		<LazyMotion features={domAnimation}>
			<AppRouter />
			<Toaster />
			<Modal />
			{/* <SandboxLauncher /> */}
		</LazyMotion>
	);
}