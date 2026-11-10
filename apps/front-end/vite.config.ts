import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		// Must run before the React plugin so the generated route tree is
		// available when Vite resolves route module imports.
		tanstackRouter({
			target: "react",
			routesDirectory: "./src/routes",
			generatedRouteTree: "./src/routeTree.gen.ts",
			autoCodeSplitting: true,
		}),
		tailwindcss(),
		react(),
	],
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
		// Force a single copy of React so TanStack Router and the app
		// share the same instance (fixes "Invalid hook call").
		dedupe: ["react", "react-dom"],
	},
	server: {
		// Bind both IPv4 and IPv6 so localhost, 127.0.0.1, and LAN browser
		// sessions all reach the same dev server.
		host: "0.0.0.0",
		port: 5173,
		proxy: {
			"/api": "http://127.0.0.1:3001",
			"/uploads": "http://127.0.0.1:3001",
		},
	},
});
