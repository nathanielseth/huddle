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
		port: 3000,
		host: true,
		strictPort: true,
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
			},
			"/socket.io": {
				target: "http://localhost:3001",
				changeOrigin: true,
				ws: true,
			},
		},
	},
	preview: {
		port: 3000,
		host: true,
		strictPort: true,
	},
});