import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "@/types/hono";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { rolePermissions, type Permission } from "@/utils/permission";

export function requireInventoryAuth(): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		const session = await auth.api.getSession({ headers: c.req.raw.headers });
		if (!session?.user) throw new AppError("Authentication required", 401, ErrorCode.UNAUTHORIZED);
		c.set("user", session.user);
		c.set("session", session.session);
		await next();
	};
}

export function requirePermission(permission: Permission): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		const role = c.get("user")?.role;
		if (!rolePermissions(role).includes(permission)) {
			throw new AppError(`Forbidden: missing required permission '${permission}'`, 403, ErrorCode.FORBIDDEN);
		}
		await next();
	};
}
