import { structuredLogger } from "@hono/structured-logger";
import { requestId } from "hono/request-id";

import { logger } from "@/lib/logger";

export const requestIdMiddleware = requestId();

export const loggingMiddleware = structuredLogger({
	createLogger: (c) => {
		return logger.child({
			requestId: c.var.requestId,
		});
	},

	onRequest: (requestLogger, c) => {
		requestLogger.info(
			{
				method: c.req.method,
				path: c.req.path,
				userAgent: c.req.header("user-agent"),
				client: c.req.header("user-agent")?.includes("Expo") ? "mobile" : "web",
			},
			"incoming request",
		);
	},

	onResponse: (responseLogger, c, elapsedMs) => {
		const status = c.res.status;

		const log = {
			method: c.req.method,
			path: c.req.path,
			status,
			durationMs: Number(elapsedMs.toFixed(2)),
			client: c.req.header("user-agent")?.includes("Expo") ? "mobile" : "web",
		};

		if (status >= 500) {
			responseLogger.error(log, "request completed with server error");
			return;
		}

		if (status >= 400) {
			responseLogger.warn(log, "request completed with client error");
			return;
		}

		responseLogger.info(log, "request completed");
	},

	onError: (errorLogger, error, c, elapsedMs) => {
		errorLogger.error(
			{
				err: error,
				method: c.req.method,
				path: c.req.path,
				durationMs: Number(elapsedMs.toFixed(2)),
				client: c.req.header("user-agent")?.includes("Expo") ? "mobile" : "web",
			},
			"request failed",
		);
	},
});
