import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores(["**/dist/**", "**/node_modules/**"]),

	{
		files: ["**/*.{ts,tsx}"],
		extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ argsIgnorePattern: "^_" },
			],
		},
	},

	{
		files: ["client/**/*.{ts,tsx}"],
		extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
	},

	{
		files: ["server/**/*.ts"],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			"no-console": "off",
		},
	},
]);