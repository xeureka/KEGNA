import type { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";

export const setupOpenAPI = (app: OpenAPIHono) => {
	app.doc("/openapi.json", {
		openapi: "3.1.0",
		info: {
			version: "1.0.0",
			title: "ZOLA Beer Warehouse Inventory API",
			description: "API documentation for the ZOLA beer warehouse inventory system",
		},
	});

	app.get(
		"/docs",
		apiReference({
			theme: "purple",
			pageTitle: "ZOLA Inventory API Documentation",
			spec: {
				url: "/openapi.json",
			},
		}),
	);
};
