import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./vitest.setup.ts"],
		include: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
		exclude: ["node_modules", ".next", "dist"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			exclude: [
				"node_modules",
				".next",
				"**/*.config.*",
				"**/*.d.ts",
				"vitest.setup.ts",
			],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./"),
		},
	},
});
