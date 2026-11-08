import { OpenAPIHono } from "@hono/zod-openapi";
import { getConnInfo } from "@hono/node-server/conninfo";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { requestId } from "hono/request-id";
import { rateLimiter } from "hono-rate-limiter";
import { errorHandler } from "@/middlewares/error-handler";
import { setupOpenAPI } from "@/docs/openapi-config";
import { errorResponse } from "./utils/api-response";
import { ErrorCode } from "@/lib/errors/error-codes";
import { env } from "@/lib/env";
import { loggingMiddleware, requestIdMiddleware } from "@/middlewares/logger";
import routes from "@/routes";
import type { AppEnv } from "@/types/hono";
import { auth } from "@/lib/auth";

const app = new OpenAPIHono<AppEnv>();
const isDev = env.NODE_ENV !== "production";

app.get("/login", (c) => c.redirect(new URL("/login", env.WEB_APP_URL).toString(), 302));
app.use("*", secureHeaders());
app.use("*", cors({
	origin: (origin) => {
		if (!origin) return origin;
		const allowed = env.CORS_ORIGINS.split(",").map((value) => value.trim());
		if (allowed.includes(origin)) return origin;
		if (isDev && (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) || origin.startsWith("exp://"))) return origin;
		return undefined;
	},
	credentials: true,
	allowHeaders: ["Content-Type", "Authorization", "Cookie"],
}));
app.use("*", bodyLimit({ maxSize: 5 * 1024 * 1024 }));
app.use("*", requestId());
const getClientIp = (c: any) => {
	try { return getConnInfo(c)?.remote?.address ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"; } catch { return "127.0.0.1"; }
};
app.use("/api/auth/*", rateLimiter({ windowMs: 15 * 60 * 1000, limit: isDev ? 10000 : 30, standardHeaders: "draft-6", keyGenerator: getClientIp, skip: () => isDev }));
app.use("*", rateLimiter({ windowMs: 60 * 1000, limit: isDev ? 50000 : 100, standardHeaders: "draft-6", keyGenerator: getClientIp, skip: () => isDev }));
app.onError(errorHandler);
app.use("*", requestIdMiddleware);
app.use("*", loggingMiddleware);
app.notFound((c) => errorResponse(c, { message: "Route not found", status: 404, code: ErrorCode.NOT_FOUND }));
setupOpenAPI(app as unknown as OpenAPIHono);
app.on(["GET", "POST"], "/api/auth/*", async (c) => auth.handler(c.req.raw));
app.route("/", routes);

export default app;
