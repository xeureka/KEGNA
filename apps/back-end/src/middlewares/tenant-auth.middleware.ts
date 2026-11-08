import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "@/types/hono";
import { tenantService } from "@/services/tenant.service";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { withDatabase } from "@/db/request-context";
import { doctorRepository } from "@/repositories/doctor.repository";
import { sessions, tenantMemberships } from "@/db/schema";

/**
 * Tenant resolution pattern:
 * Tenant context is bound to the verified session at login. Client-provided
 * tenant headers, query parameters, and hostnames are never trusted.
 *
 * Middleware chain behavior:
 * 1. Ensures user is authenticated via session token.
 * 2. Resolves the tenant from the verified session binding.
 * 3. Validates user has an ACTIVE tenant_memberships row for that tenant (rejecting with 403 if invalid).
 * 4. Resolves role & permissions for that active membership.
 * 5. Checks required permission (if provided).
 * 6. Sets tenant, tenantId, membership, role, permissions on Hono context (c.set).
 */
export function requireTenantAuth(
	requiredPermission?: string,
): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		// 1. Resolve Session User
		let user = c.get("user");
		if (!user) {
			const sessionResult = await auth.api.getSession({
				headers: c.req.raw.headers,
			});
			if (!sessionResult?.user) {
				throw new AppError(
					"Authentication required",
					401,
					ErrorCode.UNAUTHORIZED,
				);
			}
			user = sessionResult.user;
			c.set("user", sessionResult.user);
			c.set("session", sessionResult.session);
		}
		// The v1 tenant API group applies this middleware globally. Route-level
		// declarations remain responsible only for the additional permission check.
		if (c.get("tenantId")) {
			if (
				requiredPermission &&
				!c.get("permissions")?.includes(requiredPermission)
			) {
				throw new AppError(
					`Forbidden: missing required permission '${requiredPermission}'`,
					403,
					ErrorCode.FORBIDDEN,
				);
			}
			await next();
			return;
		}

		// 2. Resolve the tenant from the persisted session binding.
		const sessionToken = (c.get("session") as { token?: string } | null)?.token;
		if (!sessionToken) {
			throw new AppError(
				"Session tenant binding is missing",
				401,
				ErrorCode.UNAUTHORIZED,
			);
		}
		const [boundSession] = await db
			.select({ tenantId: sessions.activeTenantId })
			.from(sessions)
			.where(eq(sessions.token, sessionToken))
			.limit(1);
		let activeTenantId = boundSession?.tenantId;
		if (!boundSession?.tenantId) {
			// Better Auth-created mobile sessions do not know the tenant yet. A
			// user with exactly one active membership can be bound automatically;
			// ambiguous multi-tenant users must use the server-side tenant switch
			// flow instead of accepting a client-provided tenant value.
			//
			// `tenant_memberships` is RLS-protected and its policy also allows a
			// user to read their own rows, which requires `app.user_id`. That
			// value is not set yet on this first-bind path, so the lookup runs
			// in its own transaction-local context.
			const memberships = await db.transaction(async (tx) => {
				await tx.execute(
					sql`select set_config('app.user_id', ${user.id}, true)`,
				);
				return withDatabase(tx, () =>
					db
						.select({ tenantId: tenantMemberships.tenantId })
						.from(tenantMemberships)
						.where(
							and(
								eq(tenantMemberships.userId, user.id),
								eq(tenantMemberships.status, "ACTIVE"),
							),
						),
				);
			});
			if (memberships.length !== 1) {
				throw new AppError(
					"Session has no unambiguous active tenant binding; please sign in again",
					401,
					ErrorCode.UNAUTHORIZED,
				);
			}
			const autoBoundTenantId = memberships[0]?.tenantId;
			if (!autoBoundTenantId) {
				throw new AppError(
					"Active tenant membership is missing",
					401,
					ErrorCode.UNAUTHORIZED,
				);
			}
			await db
				.update(sessions)
				.set({ activeTenantId: autoBoundTenantId })
				.where(eq(sessions.token, sessionToken));
			activeTenantId = autoBoundTenantId;
		}

		// 3. Resolve tenant before entering the request transaction. Membership
		// validation and all tenant data access happen inside that transaction.
		if (!activeTenantId) {
			throw new AppError(
				"Session tenant binding is missing",
				401,
				ErrorCode.UNAUTHORIZED,
			);
		}
		const resolvedTenant = await tenantService.resolveTenant(activeTenantId);
		const declaredTenantId = c.req.header("x-nexa-tenant-id");
		if (declaredTenantId && declaredTenantId !== resolvedTenant.id) {
			throw new AppError(
				"Mobile build tenant does not match the authenticated session tenant",
				403,
				ErrorCode.FORBIDDEN,
			);
		}
		const declaredTenantSlug = c.req.header("x-nexa-tenant-slug");
		if (declaredTenantSlug && declaredTenantSlug !== resolvedTenant.slug) {
			throw new AppError(
				"Mobile build tenant does not match the authenticated session tenant",
				403,
				ErrorCode.FORBIDDEN,
			);
		}

		await db.transaction(async (tx) => {
			await tx.execute(
				sql`select set_config('app.tenant_id', ${resolvedTenant.id}, true)`,
			);
			await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);
			await tx.execute(
				sql`select set_config('app.is_super_admin', 'false', true)`,
			);
			await withDatabase(tx, async () => {
				const resolvedContext = await tenantService.validateUserMembership(
					resolvedTenant.id,
					user.id,
				);
				if (
					requiredPermission &&
					!resolvedContext.permissions.includes(requiredPermission)
				) {
					throw new AppError(
						`Forbidden: missing required permission '${requiredPermission}'`,
						403,
						ErrorCode.FORBIDDEN,
					);
				}
				c.set("tenant", resolvedContext.tenant);
				c.set("tenantId", resolvedContext.tenant.id);
				c.set("membership", resolvedContext.membership);
				c.set("role", resolvedContext.role);
				c.set("permissions", resolvedContext.permissions);
				c.set(
					"doctorId",
					resolvedContext.role.name === "DOCTOR"
						? ((
								await doctorRepository.findByUserId(
									resolvedContext.tenant.id,
									user.id,
								)
							)?.id ?? null)
						: null,
				);
				await next();
			});
		});
	};
}

/** Super Admin is platform-scoped and deliberately does not resolve a tenant membership. */
export function requireSuperAdmin(): MiddlewareHandler<AppEnv> {
	return async (c, next) => {
		let user = c.get("user");
		if (!user) {
			const sessionResult = await auth.api.getSession({
				headers: c.req.raw.headers,
			});
			if (!sessionResult?.user) {
				throw new AppError(
					"Authentication required",
					401,
					ErrorCode.UNAUTHORIZED,
				);
			}
			user = sessionResult.user;
			c.set("user", sessionResult.user);
			c.set("session", sessionResult.session);
		}
		if (!user.isSuperAdmin) {
			throw new AppError(
				"Super Admin access required",
				403,
				ErrorCode.FORBIDDEN,
			);
		}
		await db.transaction(async (tx) => {
			await tx.execute(sql`select set_config('app.tenant_id', '', true)`);
			await tx.execute(
				sql`select set_config('app.is_super_admin', 'true', true)`,
			);
			await withDatabase(tx, next);
		});
	};
}
