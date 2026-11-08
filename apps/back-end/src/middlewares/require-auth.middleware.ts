import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types/hono";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
	if (!c.get("user")) {
		return c.json({ error: "Unauthorized" }, 401);
	}
	await next();
};
