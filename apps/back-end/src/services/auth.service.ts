import { auth } from "@/lib/auth";
import { db } from "@/db";
import { patients, sessions } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { withDatabase } from "@/db/request-context";
import { userRepository } from "@/repositories/user.repository";
import { tenantRepository } from "@/repositories/tenant.repository";
import { membershipRepository } from "@/repositories/membership.repository";
import { rbacRepository } from "@/repositories/rbac.repository";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { normalizePhoneNumber } from "@/utils/phone";
import type { User, TenantMembership, Role, Tenant } from "@/db/schema";

export interface RegisterInput {
	email: string;
	password: string;
	name: string;
	tenantSlug: string;
	roleName?: string;
}

export interface RegisterTenantInput {
	name: string;
	slug: string;
	timezone?: string;
	currency?: string;
	ownerName: string;
	ownerEmail: string;
	ownerPassword: string;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface AuthResult {
	user: User;
	sessionToken: string;
	tenant?: Tenant;
	membership?: TenantMembership;
	role?: Role;
	permissions?: string[];
}

export class AuthService {
	async registerTenant(input: RegisterTenantInput): Promise<AuthResult> {
		const existingTenant = await tenantRepository.findBySlug(input.slug);
		if (existingTenant) {
			throw new AppError(
				"Tenant slug already in use",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		const tenant = await tenantRepository.createTenant({
			name: input.name,
			slug: input.slug,
			status: "ACTIVE",
		});

		await tenantRepository.createTenantSettings({
			tenantId: tenant.id,
			timezone: input.timezone || "UTC",
			currency: input.currency || "USD",
		});

		let ownerRole = await rbacRepository.findRoleByName("OWNER");
		if (!ownerRole) {
			ownerRole = await rbacRepository.createRole({
				name: "OWNER",
				description: "Full tenant administration access",
			});
		}

		const existingUser = await userRepository.findByEmail(input.ownerEmail);
		let user: User;

		if (existingUser) {
			user = existingUser;
		} else {
			const res = await auth.api.signUpEmail({
				body: {
					email: input.ownerEmail,
					password: input.ownerPassword,
					name: input.ownerName,
				},
			});

			if (!res?.user) {
				throw new AppError(
					"Failed to register owner user",
					500,
					ErrorCode.INTERNAL_SERVER_ERROR,
				);
			}

			user = (await userRepository.findById(res.user.id))!;
		}

		const membership = await membershipRepository.createMembership(tenant.id, {
			userId: user.id,
			roleId: ownerRole.id,
			status: "ACTIVE",
			joinedAt: new Date(),
		});

		const signInRes = await auth.api.signInEmail({
			body: {
				email: input.ownerEmail,
				password: input.ownerPassword,
			},
		});

		const perms = await rbacRepository.getPermissionsForRole(ownerRole.id);
		await db
			.update(sessions)
			.set({ activeTenantId: tenant.id })
			.where(eq(sessions.token, signInRes?.token ?? ""));

		return {
			user,
			sessionToken: signInRes?.token ?? "",
			tenant,
			membership,
			role: ownerRole,
			permissions: perms.map((p) => p.name),
		};
	}

	async register(input: RegisterInput): Promise<AuthResult> {
		const tenant = await tenantRepository.findBySlug(input.tenantSlug);
		if (!tenant || tenant.status !== "ACTIVE") {
			throw new AppError(
				"Tenant not found or inactive",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}

		const existingUser = await userRepository.findByEmail(input.email);
		let user: User;

		if (existingUser) {
			user = existingUser;
		} else {
			const res = await auth.api.signUpEmail({
				body: {
					email: input.email,
					password: input.password,
					name: input.name,
				},
			});

			if (!res?.user) {
				throw new AppError(
					"Failed to register user",
					500,
					ErrorCode.INTERNAL_SERVER_ERROR,
				);
			}

			user = (await userRepository.findById(res.user.id))!;
		}

		const existingMembership = await membershipRepository.findMembership(
			tenant.id,
			user.id,
		);
		let membership: TenantMembership;
		let role: Role;

		if (existingMembership) {
			membership = existingMembership;
			role = (await rbacRepository.findRoleById(membership.roleId))!;
		} else {
			const targetRoleName = input.roleName ?? "RECEPTIONIST";
			const foundRole = await rbacRepository.findRoleByName(targetRoleName);
			if (!foundRole) {
				throw new AppError(
					`Role '${targetRoleName}' does not exist`,
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			role = foundRole;

			membership = await membershipRepository.createMembership(tenant.id, {
				userId: user.id,
				roleId: role.id,
				status: "ACTIVE",
				joinedAt: new Date(),
			});
		}

		const signInRes = await auth.api.signInEmail({
			body: {
				email: input.email,
				password: input.password,
			},
		});

		const perms = await rbacRepository.getPermissionsForRole(role.id);
		await db
			.update(sessions)
			.set({ activeTenantId: tenant.id })
			.where(eq(sessions.token, signInRes?.token ?? ""));

		return {
			user,
			sessionToken: signInRes?.token ?? "",
			tenant,
			membership,
			role,
			permissions: perms.map((p) => p.name),
		};
	}

	async login(input: LoginInput): Promise<AuthResult> {
		const attempts = 3;
		let lastErr: Error | null = null;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				const res = await auth.api.signInEmail({
					body: {
						email: input.email,
						password: input.password,
					},
				});

				if (!res?.user || !res?.token) {
					throw new AppError(
						"Invalid email or password",
						401,
						ErrorCode.UNAUTHORIZED,
					);
				}

				const user = (await userRepository.findById(res.user.id))!;
				const membershipContext = await db.transaction(async (tx) => {
					// Membership discovery is intentionally allowed by RLS only for the
					// authenticated user. Keep this context on the same transaction as
					// every follow-up tenant/role lookup.
					await tx.execute(
						sql`select set_config('app.user_id', ${user.id}, true)`,
					);
					await tx.execute(
						sql`select set_config('app.is_super_admin', 'false', true)`,
					);
					await tx.execute(sql`select set_config('app.tenant_id', '', true)`);

					return withDatabase(tx, async () => {
						const memberships =
							await membershipRepository.listMembershipsByUser(user.id);
						const activeMembership = memberships.find(
							(m) => m.status === "ACTIVE",
						);

						let tenant: Tenant | undefined;
						let role: Role | undefined;
						let permissions: string[] | undefined;

						if (activeMembership) {
							tenant =
								(await tenantRepository.findById(activeMembership.tenantId)) ??
								undefined;
							role =
								(await rbacRepository.findRoleById(activeMembership.roleId)) ??
								undefined;
							if (role) {
								const perms = await rbacRepository.getPermissionsForRole(
									role.id,
								);
								permissions = perms.map((p) => p.name);
							}
						}

						return { tenant, membership: activeMembership, role, permissions };
					});
				});

				const result = {
					user,
					sessionToken: res.token,
					...membershipContext,
				};
				if (result.tenant) {
					await db
						.update(sessions)
						.set({ activeTenantId: result.tenant.id })
						.where(eq(sessions.token, res.token));
				}
				return result;
			} catch (err) {
				lastErr = err instanceof Error ? err : new Error(String(err));
				if (attempt < attempts) {
					await new Promise((r) => setTimeout(r, 200 * attempt));
				}
			}
		}

		throw new AppError(
			lastErr?.message ?? "Invalid email or password",
			401,
			ErrorCode.UNAUTHORIZED,
		);
	}

	async requestOtp(phone: string, tenantId: string): Promise<{ name: string }> {
		let normalizedPhone: string;
		try {
			normalizedPhone = normalizePhoneNumber(phone);
		} catch (error) {
			throw new AppError(
				error instanceof Error ? error.message : "Invalid phone number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		if (!normalizedPhone) {
			throw new AppError(
				"Phone number is required",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		const tenant = await tenantRepository.findById(tenantId);
		if (!tenant || tenant.status !== "ACTIVE") {
			throw new AppError(
				"Tenant not found or inactive",
				403,
				ErrorCode.FORBIDDEN,
			);
		}
		const { otpRequestContext } = await import("@/services/otp-context");
		try {
			await otpRequestContext.run({ tenantName: tenant.name }, () =>
				auth.api.sendPhoneNumberOTP({
					body: { phoneNumber: normalizedPhone },
				}),
			);
		} catch (error) {
			if (error instanceof AppError) throw error;
			const cause =
				error instanceof Error && "cause" in error ? error.cause : undefined;
			if (cause instanceof AppError) throw cause;
			throw new AppError(
				error instanceof Error
					? error.message
					: "Unable to send verification SMS",
				502,
				ErrorCode.BAD_GATEWAY,
			);
		}
		return { name: tenant.name };
	}

	async phoneExists(phone: string, tenantId: string): Promise<boolean> {
		let normalizedPhone: string;
		try {
			normalizedPhone = normalizePhoneNumber(phone);
		} catch (error) {
			throw new AppError(
				error instanceof Error ? error.message : "Invalid phone number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		const tenant = await tenantRepository.findById(tenantId);
		if (!tenant || tenant.status !== "ACTIVE") {
			throw new AppError(
				"Tenant not found or inactive",
				403,
				ErrorCode.FORBIDDEN,
			);
		}
		const [patient] = await db.transaction(async (tx) => {
			await tx.execute(
				sql`select set_config('app.tenant_id', ${tenant.id}, true)`,
			);
			await tx.execute(sql`select set_config('app.user_id', '', true)`);
			await tx.execute(
				sql`select set_config('app.is_super_admin', 'false', true)`,
			);
			return withDatabase(tx, () =>
				db
					.select({ id: patients.id })
					.from(patients)
					.where(
						and(
							eq(patients.tenantId, tenant.id),
							eq(patients.phone, normalizedPhone),
							isNull(patients.deletedAt),
						),
					)
					.limit(1),
			);
		});
		return Boolean(patient);
	}

	async verifyOtp(
		phone: string,
		code: string,
		tenantId: string,
		profile?: { firstName: string; lastName: string },
	): Promise<AuthResult> {
		let normalizedPhone: string;
		try {
			normalizedPhone = normalizePhoneNumber(phone);
		} catch (error) {
			throw new AppError(
				error instanceof Error ? error.message : "Invalid phone number",
				400,
				ErrorCode.BAD_REQUEST,
			);
		}
		const tenant = await tenantRepository.findById(tenantId);
		if (!tenant || tenant.status !== "ACTIVE") {
			throw new AppError(
				"Tenant not found or inactive",
				403,
				ErrorCode.FORBIDDEN,
			);
		}
		if (profile?.firstName && profile.lastName) {
			const existingPhone = await db
				.select({ id: patients.id })
				.from(patients)
				.where(
					and(
						eq(patients.tenantId, tenant.id),
						eq(patients.phone, normalizedPhone),
						isNull(patients.deletedAt),
					),
				)
				.limit(1);
			if (existingPhone[0]) {
				throw new AppError(
					"Phone number already registered",
					409,
					ErrorCode.CONFLICT,
				);
			}
			const existingName = await db
				.select({ id: patients.id })
				.from(patients)
				.where(
					and(
						eq(patients.tenantId, tenant.id),
						sql`lower(${patients.firstName}) = lower(${profile.firstName.trim()})`,
						sql`lower(${patients.lastName}) = lower(${profile.lastName.trim()})`,
						isNull(patients.deletedAt),
					),
				)
				.limit(1);
			if (existingName[0]) {
				throw new AppError(
					"A patient with this name already exists",
					409,
					ErrorCode.CONFLICT,
				);
			}
		}
		try {
			await auth.api.consumePhoneNumberOTP({
				body: { phoneNumber: normalizedPhone, code },
			});
		} catch (error) {
			const apiError = error as {
				body?: { code?: string };
			};
			if (apiError.body?.code === "INVALID_OTP") {
				throw new AppError(
					"The verification code is invalid or expired. Enter the latest 6-digit code.",
					400,
					ErrorCode.BAD_REQUEST,
				);
			}
			throw error;
		}

		let [patient] = await db.transaction(async (tx) => {
			await tx.execute(
				sql`select set_config('app.tenant_id', ${tenant.id}, true)`,
			);
			await tx.execute(sql`select set_config('app.user_id', '', true)`);
			await tx.execute(
				sql`select set_config('app.is_super_admin', 'false', true)`,
			);
			return withDatabase(tx, () =>
				db
					.select({ id: patients.id })
					.from(patients)
					.where(
						and(
							eq(patients.tenantId, tenant.id),
							eq(patients.phone, normalizedPhone),
							isNull(patients.deletedAt),
						),
					)
					.limit(1),
			);
		});
		if (!patient) {
			if (!profile?.firstName || !profile.lastName) {
				throw new AppError(
					"This phone number is not registered. Use Create account to register it.",
					403,
					ErrorCode.FORBIDDEN,
				);
			}
		}

		let user = await userRepository.findByPhone(normalizedPhone);
		if (!user) {
			const email = `user_${normalizedPhone.replace(/\D/g, "")}@mobile.nexa.internal`;
			user = await userRepository.createUser({
				name: profile
					? `${profile.firstName} ${profile.lastName}`
					: `Mobile User ${phone.slice(-4)}`,
				email,
				phone: normalizedPhone,
				status: "ACTIVE",
				emailVerified: true,
			});
		}

		if (!patient) {
			const patientRole = await rbacRepository.findRoleByName("PATIENT");
			if (!patientRole) {
				throw new AppError(
					"Patient role is not configured",
					500,
					ErrorCode.INTERNAL_SERVER_ERROR,
				);
			}
			[patient] = await db.transaction(async (tx) => {
				await tx.execute(
					sql`select set_config('app.tenant_id', ${tenant.id}, true)`,
				);
				await tx.execute(
					sql`select set_config('app.user_id', ${user.id}, true)`,
				);
				await tx.execute(
					sql`select set_config('app.is_super_admin', 'false', true)`,
				);
				return withDatabase(tx, () =>
					tx
						.insert(patients)
						.values({
							tenantId: tenant.id,
							patientNumber: `PAT-${tenant.slug.toUpperCase()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
							firstName: profile!.firstName.trim(),
							lastName: profile!.lastName.trim(),
							phone: normalizedPhone,
						})
						.returning({ id: patients.id }),
				);
			});
		}

		const sessionToken = crypto.randomUUID();
		const { membership, role, permissions } = await db.transaction(
			async (tx) => {
				await tx.execute(
					sql`select set_config('app.tenant_id', ${tenant.id}, true)`,
				);
				await tx.execute(
					sql`select set_config('app.user_id', ${user.id}, true)`,
				);
				await tx.execute(
					sql`select set_config('app.is_super_admin', 'false', true)`,
				);
				return withDatabase(tx, async () => {
					let existingMembership = await membershipRepository.findMembership(
						tenant.id,
						user.id,
					);
					if (!existingMembership) {
						const patientRole = await rbacRepository.findRoleByName("PATIENT");
						if (!patientRole) {
							throw new AppError(
								"Patient role is not configured",
								500,
								ErrorCode.INTERNAL_SERVER_ERROR,
							);
						}
						existingMembership = await membershipRepository.createMembership(
							tenant.id,
							{
								userId: user.id,
								roleId: patientRole.id,
								status: "ACTIVE",
								joinedAt: new Date(),
							},
						);
					}
					if (existingMembership.status !== "ACTIVE") {
						throw new AppError(
							"Patient membership is inactive",
							403,
							ErrorCode.FORBIDDEN,
						);
					}
					const membershipRole =
						(await rbacRepository.findRoleById(existingMembership.roleId)) ??
						undefined;
					const membershipPermissions = membershipRole
						? (
								await rbacRepository.getPermissionsForRole(membershipRole.id)
							).map((permission) => permission.name)
						: [];
					return {
						membership: existingMembership,
						role: membershipRole,
						permissions: membershipPermissions,
					};
				});
			},
		);
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		await db.insert(sessions).values({
			userId: user.id,
			token: sessionToken,
			expiresAt,
			activeTenantId: tenant.id,
		});

		return {
			user,
			sessionToken,
			tenant,
			membership,
			role,
			permissions,
		};
	}
}

export const authService = new AuthService();
