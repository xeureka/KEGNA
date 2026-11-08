import { tenantRepository } from "@/repositories/tenant.repository";
import { membershipRepository } from "@/repositories/membership.repository";
import { rbacRepository } from "@/repositories/rbac.repository";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import type { Tenant, TenantMembership, Role } from "@/db/schema";
import { auth } from "@/lib/auth";
import { userRepository } from "@/repositories/user.repository";

export interface ResolvedTenantContext {
	tenant: Tenant;
	membership: TenantMembership;
	role: Role;
	permissions: string[];
}

export class TenantService {
	async onboardTenant(input: {
		name: string;
		slug: string;
		brandColor: string;
		logoUrl?: string | null;
		adminName: string;
		adminEmail: string;
		adminPassword: string;
	}) {
		if (await tenantRepository.findBySlug(input.slug)) {
			throw new AppError("Tenant slug already in use", 409, ErrorCode.CONFLICT);
		}
		if (await userRepository.findByEmail(input.adminEmail)) {
			throw new AppError(
				"Initial admin email is already in use",
				409,
				ErrorCode.CONFLICT,
			);
		}
		const tenant = await tenantRepository.createTenant({
			name: input.name,
			slug: input.slug,
			brandColor: input.brandColor,
			logoUrl: input.logoUrl ?? null,
			status: "ACTIVE",
		});
		await tenantRepository.createTenantSettings({
			tenantId: tenant.id,
			timezone: "UTC",
			currency: "USD",
		});
		const signup = await auth.api.signUpEmail({
			body: {
				email: input.adminEmail,
				password: input.adminPassword,
				name: input.adminName,
			},
		});
		if (!signup?.user)
			throw new AppError(
				"Failed to create initial admin",
				500,
				ErrorCode.INTERNAL_SERVER_ERROR,
			);
		const admin = await userRepository.findById(signup.user.id);
		if (!admin)
			throw new AppError(
				"Initial admin was not persisted",
				500,
				ErrorCode.INTERNAL_SERVER_ERROR,
			);
		const role =
			(await rbacRepository.findRoleByName("OWNER")) ??
			(await rbacRepository.createRole({
				name: "OWNER",
				description: "Full tenant administration access",
			}));
		const membership = await membershipRepository.createMembership(tenant.id, {
			userId: admin.id,
			roleId: role.id,
			status: "ACTIVE",
			joinedAt: new Date(),
		});
		return { tenant, admin, membership, role };
	}
	async resolveTenant(tenantIdentifier: string): Promise<Tenant> {
		const isUuid =
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				tenantIdentifier,
			);
		const tenant = isUuid
			? await tenantRepository.findById(tenantIdentifier)
			: await tenantRepository.findBySlug(tenantIdentifier);

		if (!tenant || tenant.status !== "ACTIVE") {
			throw new AppError(
				"Tenant not found or inactive",
				403,
				ErrorCode.FORBIDDEN,
			);
		}

		return tenant;
	}

	async validateUserMembership(
		tenantId: string,
		userId: string,
	): Promise<ResolvedTenantContext> {
		const tenant = await tenantRepository.findById(tenantId);
		if (!tenant || tenant.status !== "ACTIVE") {
			throw new AppError(
				"Tenant not found or inactive",
				403,
				ErrorCode.FORBIDDEN,
			);
		}

		const membership = await membershipRepository.findActiveMembership(
			tenantId,
			userId,
		);
		if (!membership) {
			throw new AppError(
				"User does not have an active membership for this tenant",
				403,
				ErrorCode.FORBIDDEN,
			);
		}

		const role = await rbacRepository.findRoleById(membership.roleId);
		if (!role) {
			throw new AppError(
				"User membership role not found",
				403,
				ErrorCode.FORBIDDEN,
			);
		}

		const perms = await rbacRepository.getPermissionsForRole(role.id);
		const permissions = perms.map((p) => p.name);

		return {
			tenant,
			membership,
			role,
			permissions,
		};
	}
}

export const tenantService = new TenantService();
