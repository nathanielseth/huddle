import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
	plugins: [
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		tailwindcss(),
	],
	resolve: {
		alias: {
			"@shared": path.resolve(__dirname, "../shared"),
			"@": path.resolve(__dirname, "src"),
		},
		dedupe: ["react", "react-dom"],
	},
	server: {
		port: 5173,
	},
});
