import type { MiddlewareHandler } from "hono";
import { auth } from "../lib/auth";
import type { AppEnv } from "../types/hono";

export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
	const result = await auth.api.getSession({ headers: c.req.raw.headers });

	c.set("user", result?.user ?? null);
	c.set("session", result?.session ?? null);

	await next();
};
