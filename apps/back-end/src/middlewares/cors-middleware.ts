import { cors } from "hono/cors";

export const corsMiddleware = cors({
	origin: (origin: string | undefined) => origin || "http://localhost:3001",
	allowHeaders: [
		"Content-Type",
		"Authorization",
		"Cookie",
		"x-host",
		"x-tenant-id",
	],
	allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE", "PATCH"],
	exposeHeaders: ["Content-Length", "Set-Cookie", "set-auth-token"],
	credentials: true,
	maxAge: 600,
});
