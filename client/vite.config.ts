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
			"@shared": path.resolve(import.meta.dirname, "../shared"),
			"@": path.resolve(import.meta.dirname, "src"),
		},
		dedupe: ["react", "react-dom"],
	},
	server: {
		port: 3000,
		host: true,
		strictPort: true,
		allowedHosts: [".trycloudflare.com"],
		proxy: {
			"/api": {
				target: "http://localhost:3001",
				changeOrigin: true,
				configure: (proxy) => {
					proxy.on("error", (err) => {
						if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
							console.error("[vite] /api proxy error:", err);
						}
					});
				},
			},
			"/socket.io": {
				target: "http://localhost:3001",
				changeOrigin: true,
				ws: true,
				configure: (proxy) => {
					proxy.on("error", (err) => {
						if ((err as NodeJS.ErrnoException).code !== "ECONNRESET") {
							console.error("[vite] /socket.io proxy error:", err);
						}
					});
				},
			},
		},
	},
	preview: {
		port: 3000,
		host: true,
		strictPort: true,
	},
});