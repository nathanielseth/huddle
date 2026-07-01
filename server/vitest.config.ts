import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: false,
		include: ["src/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/games/face-turn/**/*.ts"],
			exclude: ["src/games/face-turn/**/*.test.ts"],
		},
	},
});