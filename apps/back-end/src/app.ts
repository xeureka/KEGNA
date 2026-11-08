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
import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { sessions, tenantMemberships } from "@/db/schema";

const app = new OpenAPIHono<AppEnv>();

// Keep previously issued API-host login links usable while new provisioning
// responses point directly at the web app. Only the tenant query parameter is
// forwarded; the destination remains the configured web origin.
app.get("/login", (c) => {
	const target = new URL("/login", env.WEB_APP_URL);
	const tenant = c.req.query("tenant");
	if (tenant) target.searchParams.set("tenant", tenant);
	return c.redirect(target.toString(), 302);
});

app.use("*", secureHeaders());

app.use(
	"*",
	cors({
		origin: (origin) => {
			if (!origin) return origin;
			const configuredOrigins = env.CORS_ORIGINS.split(",").map((value) =>
				value.trim(),
			);
			if (configuredOrigins.includes(origin)) return origin;
			if (
				env.NODE_ENV !== "production" &&
				(origin.startsWith("exp://") ||
					/^nexa-[a-z0-9-]+:\/\//i.test(origin) ||
					/^https?:\/\/(localhost|127\.0\.0\.1|10\.(?:[0-9]{1,3}\.){2}[0-9]{1,3}|192\.168\.(?:[0-9]{1,3}\.)[0-9]{1,3}|172\.(?:1[6-9]|2[0-9]|3[01])\.(?:[0-9]{1,3}\.)[0-9]{1,3})(?::\d+)?$/i.test(
						origin,
					))
			) {
				return origin;
			}
			return undefined;
		},
		credentials: true,
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"Cookie",
			"X-Nexa-Tenant-Id",
			"X-Nexa-Tenant-Slug",
		],
	}),
);

app.use("*", bodyLimit({ maxSize: 5 * 1024 * 1024 }));

app.use("*", requestId());

const getClientIp = (c: any) => {
	try {
		const info = getConnInfo(c);
		return (
			info?.remote?.address ||
			c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
			c.req.header("x-real-ip") ||
			"127.0.0.1"
		);
	} catch {
		return (
			c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
			c.req.header("x-real-ip") ||
			"127.0.0.1"
		);
	}
};

const isDev = env.NODE_ENV === "development" || env.NODE_ENV === "test";

app.use(
	"/api/v1/auth/*",
	rateLimiter({
		windowMs: 15 * 60 * 1000,
		limit: isDev ? 10000 : 30,
		standardHeaders: "draft-6",
		keyGenerator: getClientIp,
		skip: () => isDev,
	}),
);

app.use(
	"*",
	rateLimiter({
		windowMs: 60 * 1000,
		limit: isDev ? 50000 : 100,
		standardHeaders: "draft-6",
		keyGenerator: getClientIp,
		skip: () => isDev,
	}),
);

app.onError(errorHandler);

app.use("*", requestIdMiddleware);
app.use("*", loggingMiddleware);

app.notFound((c) => {
	return errorResponse(c, {
		message: "Route not found",
		status: 404,
		code: ErrorCode.NOT_FOUND,
	});
});

setupOpenAPI(app as unknown as OpenAPIHono);
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
	const response = await auth.handler(c.req.raw);
	const path = new URL(c.req.url).pathname;
	if (
		response.ok &&
		(path.endsWith("/sign-in/email") || path.endsWith("/sign-up/email"))
	) {
		const tenantId = c.req.header("x-nexa-tenant-id");
		const body = (await response
			.clone()
			.json()
			.catch(() => null)) as {
			token?: string;
			user?: { id?: string };
		} | null;
		const userId = body?.user?.id;
		if (tenantId && userId && body?.token) {
			const hasMembership = await db.transaction(async (tx) => {
				await tx.execute(
					sql`select set_config('app.user_id', ${userId}, true)`,
				);
				const [membership] = await tx
					.select({ id: tenantMemberships.id })
					.from(tenantMemberships)
					.where(
						and(
							eq(tenantMemberships.tenantId, tenantId),
							eq(tenantMemberships.userId, userId),
							eq(tenantMemberships.status, "ACTIVE"),
						),
					)
					.limit(1);
				return Boolean(membership);
			});
			if (hasMembership) {
				await db
					.update(sessions)
					.set({ activeTenantId: tenantId })
					.where(eq(sessions.token, body.token));
			}
		}
	}
	return response;
});
app.route("/", routes);

export default app;
