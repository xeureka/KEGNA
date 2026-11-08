import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { auth } from "@/lib/auth";
import { rolePermissions } from "@/utils/permission";

const v1 = new OpenAPIHono<AppEnv>();
const authRoute = new OpenAPIHono<AppEnv>();

const responseSchema = z.object({
	success: z.literal(true),
	data: z.object({
		user: z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.string() }),
		sessionToken: z.string(),
		permissions: z.array(z.string()),
	}),
});

const helloRoute = createRoute({
	method: "get", path: "/hello",
	responses: { 200: { description: "Health response", content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.object({ message: z.string() }) }) } } } },
});
v1.openapi(helloRoute, (c) => c.json({ success: true as const, data: { message: "Hello from ZOLA Inventory API" } }));

const loginRoute = createRoute({
	method: "post", path: "/login",
	request: { body: { content: { "application/json": { schema: z.object({ email: z.string().email(), password: z.string().min(8) }) } } } },
	responses: { 200: { description: "Signed in", content: { "application/json": { schema: responseSchema } } }, 401: { description: "Invalid credentials" } },
});
authRoute.openapi(loginRoute, async (c) => {
	const body = c.req.valid("json");
	const result = await auth.api.signInEmail({ body: { email: body.email, password: body.password } });
	if (!result?.user || !result.token) return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid credentials" } }, 401);
	const role = result.user.role ?? "sales";
	return c.json({ success: true as const, data: { user: { id: result.user.id, name: result.user.name, email: result.user.email, role }, sessionToken: result.token, permissions: [...rolePermissions(role)] } });
});

const meRoute = createRoute({
	method: "get", path: "/me",
	responses: {
		200: { description: "Current session", content: { "application/json": { schema: responseSchema } } },
		401: { description: "Unauthenticated" },
	},
});
authRoute.openapi(meRoute, async (c) => {
	const session = await auth.api.getSession({ headers: c.req.raw.headers });
	if (!session?.user) return c.json({ success: false, error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
	const role = session.user.role ?? "sales";
	return c.json({ success: true as const, data: { user: { id: session.user.id, name: session.user.name, email: session.user.email, role }, sessionToken: session.session.token, permissions: [...rolePermissions(role)] } });
});

const logoutRoute = createRoute({
	method: "post", path: "/logout",
	responses: { 200: { description: "Signed out", content: { "application/json": { schema: z.object({ success: z.literal(true), data: z.object({ ok: z.literal(true) }) }) } } } },
});
authRoute.openapi(logoutRoute, async (c) => {
	await auth.api.signOut({ headers: c.req.raw.headers });
	return c.json({ success: true as const, data: { ok: true as const } });
});

v1.route("/auth", authRoute);
export default v1;
