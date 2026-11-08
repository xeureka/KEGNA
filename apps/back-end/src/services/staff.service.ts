import { auth } from "@/lib/auth";
import { userRepository } from "@/repositories/user.repository";
import { membershipRepository } from "@/repositories/membership.repository";
import { rbacRepository } from "@/repositories/rbac.repository";
import { doctorRepository } from "@/repositories/doctor.repository";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import type { User, MembershipStatus } from "@/db/schema";

export const DEFAULT_STAFF_PASSWORD = "ChangeMe123!";

export interface CreateStaffInput {
	name: string;
	email: string;
	password?: string;
	roleName: string;
	licenseNumber?: string;
	specialization?: string;
}

export class StaffService {
	async createStaff(tenantId: string, input: CreateStaffInput) {
		const role = await rbacRepository.findRoleByName(input.roleName);
		if (!role) {
			throw new AppError(
				`Role '${input.roleName}' not found`,
				404,
				ErrorCode.NOT_FOUND,
			);
		}

		let user = await userRepository.findByEmail(input.email);
		if (!user) {
			const res = await auth.api.signUpEmail({
				body: {
					email: input.email,
					password: input.password ?? DEFAULT_STAFF_PASSWORD,
					name: input.name,
				},
			});
			user = res.user as unknown as User;
		}

		let membership = await membershipRepository.findMembership(
			tenantId,
			user.id,
		);
		if (membership) {
			membership = await membershipRepository.updateMembership(membership.id, {
				roleId: role.id,
				status: "ACTIVE",
			});
		} else {
			membership = await membershipRepository.createMembership(tenantId, {
				userId: user.id,
				roleId: role.id,
				status: "ACTIVE",
				joinedAt: new Date(),
			});
		}

		if (input.roleName === "DOCTOR" && input.licenseNumber) {
			const existingDoctor = await doctorRepository.findByUserId(
				tenantId,
				user.id,
			);
			if (!existingDoctor) {
				await doctorRepository.createDoctor(tenantId, {
					userId: user.id,
					licenseNumber: input.licenseNumber,
					specialization: input.specialization ?? null,
					isAvailable: true,
				});
			}
		}

		return { user, membership, roleName: role.name };
	}

	async list(tenantId: string) {
		return membershipRepository.listWithDetails(tenantId);
	}

	async changeRole(tenantId: string, membershipId: string, roleName: string) {
		const membership = await membershipRepository.findById(membershipId);
		if (!membership || membership.tenantId !== tenantId) {
			throw new AppError("Membership not found", 404, ErrorCode.NOT_FOUND);
		}
		const currentRole = await rbacRepository.findRoleById(membership.roleId);
		if (currentRole?.name === "OWNER") {
			throw new AppError(
				"The tenant owner role cannot be changed",
				409,
				ErrorCode.CONFLICT,
			);
		}
		const role = await rbacRepository.findRoleByName(roleName);
		if (!role) {
			throw new AppError(
				`Role '${roleName}' not found`,
				404,
				ErrorCode.NOT_FOUND,
			);
		}

		return membershipRepository.updateMembership(membershipId, {
			roleId: role.id,
		});
	}

	async setStatus(
		tenantId: string,
		membershipId: string,
		status: MembershipStatus,
	) {
		const membership = await membershipRepository.findById(membershipId);
		if (!membership || membership.tenantId !== tenantId) {
			throw new AppError("Membership not found", 404, ErrorCode.NOT_FOUND);
		}
		const currentRole = await rbacRepository.findRoleById(membership.roleId);
		if (currentRole?.name === "OWNER" && status !== "ACTIVE") {
			throw new AppError(
				"The tenant owner membership cannot be suspended or deactivated",
				409,
				ErrorCode.CONFLICT,
			);
		}

		return membershipRepository.setStatus(membershipId, status);
	}
}

export const staffService = new StaffService();
