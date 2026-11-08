import type { Context } from "hono";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

/**
 * Throws a 403 AppError (rendered by the global error handler) when the
 * authenticated user's resolved role lacks the given tenant permission.
 * Call at the top of any handler that needs a finer-grained guard than the
 * router-level `requireTenantAuth()`.
 */
export function assertPermission(c: Context, permission: string): void {
	const permissions = c.get("permissions") ?? [];
	if (!permissions.includes(permission)) {
		throw new AppError(
			`Forbidden: missing required permission '${permission}'`,
			403,
			ErrorCode.FORBIDDEN,
		);
	}
}
