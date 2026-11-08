import { createRoute, z, type RouteHandler } from "@hono/zod-openapi";
import { successResponse } from "@/utils/api-response";

const HelloResponseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		message: z.string(),
		timestamp: z.string(),
	}),
});

export const helloRoute = createRoute({
	method: "get",
	path: "/hello",
	tags: ["Test"],
	summary: "Test API endpoint",
	description: "A simple endpoint to verify that the API is working correctly",
	responses: {
		200: {
			description: "Successful response",
			content: {
				"application/json": {
					schema: HelloResponseSchema,
				},
			},
		},
	},
});

export const helloHandler: RouteHandler<typeof helloRoute> = (c) => {
	return successResponse(c, {
		message: "Hello from Nexa CRM API!",
		timestamp: new Date().toISOString(),
	});
};
