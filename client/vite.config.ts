import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@huddle/shared": path.resolve(__dirname, "../shared"),
		},
		dedupe: ["react", "react-dom"],
	},
	server: {
		port: 5173,
	},
});
