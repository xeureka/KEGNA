import { z } from "@hono/zod-openapi";

export const errorObjectSchema = z.object({
	code: z.string(),
	message: z.string(),
});

export const errorResponseSchema = z.object({
	success: z.boolean(),
	error: errorObjectSchema,
});

export const notFoundResponse = {
	description: "Not found",
	content: { "application/json": { schema: errorResponseSchema } },
};

export const messageSchema = z.object({
	success: z.boolean(),
	data: z.object({ message: z.string() }),
});
