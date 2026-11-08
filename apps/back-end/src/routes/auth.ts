import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import type { AppEnv } from "@/types/hono";
import { authService } from "@/services/auth.service";
import { requireTenantAuth } from "@/middlewares/tenant-auth.middleware";
import { tenantRepository } from "@/repositories/tenant.repository";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

export const authRouter = new OpenAPIHono<AppEnv>();

const brandingRoute = createRoute({
	method: "get",
	path: "/branding",
	summary: "Get public tenant branding",
	request: { query: z.object({ tenantSlug: z.string().min(2) }) },
	responses: {
		200: {
			description: "Tenant branding",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							name: z.string(),
							slug: z.string(),
							logoUrl: z.string().nullable(),
							brandColor: z.string(),
						}),
					}),
				},
			},
		},
		404: { description: "Tenant not found" },
	},
});

authRouter.openapi(brandingRoute, async (c) => {
	const tenant = await tenantRepository.findBySlug(
		c.req.valid("query").tenantSlug,
	);
	if (!tenant || tenant.status !== "ACTIVE")
		return c.json(
			{
				success: false,
				error: { code: "NOT_FOUND", message: "Tenant not found" },
			},
			404,
		);
	return c.json(
		{
			success: true,
			data: {
				name: tenant.name,
				slug: tenant.slug,
				logoUrl: tenant.logoUrl,
				brandColor: tenant.brandColor,
			},
		},
		200,
	);
});

// 0. REGISTER TENANT (Creates Tenant + Tenant Settings + Owner User + OWNER Membership)
const registerTenantRoute = createRoute({
	method: "post",
	path: "/register-tenant",
	summary: "Register new tenant with owner credentials",
	description:
		"Creates a new clinic tenant, sets up tenant settings, registers the owner account, and assigns the OWNER role.",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						name: z.string().min(2).openapi({ example: "Metro Dental Clinic" }),
						slug: z.string().min(2).openapi({ example: "metro-dental" }),
						timezone: z
							.string()
							.optional()
							.openapi({ example: "America/New_York" }),
						currency: z.string().optional().openapi({ example: "USD" }),
						ownerName: z
							.string()
							.min(2)
							.openapi({ example: "Dr. Alex Rivera" }),
						ownerEmail: z
							.string()
							.email()
							.openapi({ example: "alex@metrodental.com" }),
						ownerPassword: z
							.string()
							.min(8)
							.openapi({ example: "Password123!" }),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Tenant and owner registered successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean().openapi({ example: true }),
						data: z.object({
							user: z.object({
								id: z.string(),
								name: z.string(),
								email: z.string(),
								isSuperAdmin: z.boolean(),
							}),
							sessionToken: z.string(),
							tenant: z
								.object({
									id: z.string(),
									name: z.string(),
									slug: z.string(),
								})
								.optional(),
							membership: z
								.object({
									id: z.string(),
									status: z.string(),
								})
								.optional(),
							role: z
								.object({
									name: z.string(),
								})
								.optional(),
							permissions: z.array(z.string()).optional(),
						}),
					}),
				},
			},
		},
		400: {
			description: "Bad Request / Tenant slug already in use",
		},
	},
});

authRouter.openapi(registerTenantRoute, async (c) => {
	const body = c.req.valid("json");
	const result = await authService.registerTenant(body);

	return c.json(
		{
			success: true,
			data: {
				user: {
					id: result.user.id,
					name: result.user.name,
					email: result.user.email,
					isSuperAdmin: result.user.isSuperAdmin ?? false,
				},
				sessionToken: result.sessionToken,
				tenant: result.tenant
					? {
							id: result.tenant.id,
							name: result.tenant.name,
							slug: result.tenant.slug,
						}
					: undefined,
				membership: result.membership
					? {
							id: result.membership.id,
							status: result.membership.status,
						}
					: undefined,
				role: result.role ? { name: result.role.name } : undefined,
				permissions: result.permissions,
			},
		},
		201,
	);
});

// 1. REGISTER (Dashboard Email + Password + Tenant)
const registerRoute = createRoute({
	method: "post",
	path: "/register",
	summary: "Register new user for a tenant",
	description:
		"Creates a new user account (if not existing) and binds them to the specified tenant with a role in a single coordinated transaction.",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						email: z
							.string()
							.email()
							.openapi({ example: "receptionist@smile-care.com" }),
						password: z.string().min(8).openapi({ example: "Password123!" }),
						name: z.string().min(2).openapi({ example: "Jane Doe" }),
						tenantSlug: z.string().min(2).openapi({ example: "smile-care" }),
						roleName: z
							.enum(["OWNER", "DOCTOR", "RECEPTIONIST", "ACCOUNTANT"])
							.optional()
							.openapi({ example: "RECEPTIONIST" }),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Registration successful",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean().openapi({ example: true }),
						data: z.object({
							user: z.object({
								id: z.string(),
								name: z.string(),
								email: z.string(),
								isSuperAdmin: z.boolean(),
							}),
							sessionToken: z.string(),
							tenant: z
								.object({
									id: z.string(),
									name: z.string(),
									slug: z.string(),
								})
								.optional(),
							membership: z
								.object({
									id: z.string(),
									status: z.string(),
								})
								.optional(),
							role: z
								.object({
									name: z.string(),
								})
								.optional(),
							permissions: z.array(z.string()).optional(),
						}),
					}),
				},
			},
		},
		400: {
			description: "Bad Request",
		},
	},
});

authRouter.openapi(registerRoute, async (c) => {
	const body = c.req.valid("json");
	const result = await authService.register(body);

	return c.json(
		{
			success: true,
			data: {
				user: {
					id: result.user.id,
					name: result.user.name,
					email: result.user.email,
					isSuperAdmin: result.user.isSuperAdmin ?? false,
				},
				sessionToken: result.sessionToken,
				tenant: result.tenant
					? {
							id: result.tenant.id,
							name: result.tenant.name,
							slug: result.tenant.slug,
						}
					: undefined,
				membership: result.membership
					? {
							id: result.membership.id,
							status: result.membership.status,
						}
					: undefined,
				role: result.role ? { name: result.role.name } : undefined,
				permissions: result.permissions,
			},
		},
		201,
	);
});

// 2. LOGIN (Dashboard Email + Password)
const loginRoute = createRoute({
	method: "post",
	path: "/login",
	summary: "Dashboard Email/Password Login",
	description:
		"Authenticates dashboard users using email and password via Better Auth provider.",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						email: z
							.string()
							.email()
							.openapi({ example: "owner@smilecare.com" }),
						password: z.string().openapi({ example: "Password123!" }),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Login successful",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean().openapi({ example: true }),
						data: z.object({
							user: z.object({
								id: z.string(),
								name: z.string(),
								email: z.string(),
								isSuperAdmin: z.boolean(),
							}),
							sessionToken: z.string(),
							tenant: z
								.object({
									id: z.string(),
									name: z.string(),
									slug: z.string(),
								})
								.optional(),
							role: z
								.object({
									name: z.string(),
								})
								.optional(),
							permissions: z.array(z.string()).optional(),
						}),
					}),
				},
			},
		},
		401: {
			description: "Invalid email or password",
		},
	},
});

authRouter.openapi(loginRoute, async (c) => {
	const body = c.req.valid("json");
	const result = await authService.login(body);

	return c.json(
		{
			success: true,
			data: {
				user: {
					id: result.user.id,
					name: result.user.name,
					email: result.user.email,
					isSuperAdmin: result.user.isSuperAdmin ?? false,
				},
				sessionToken: result.sessionToken,
				tenant: result.tenant
					? {
							id: result.tenant.id,
							name: result.tenant.name,
							slug: result.tenant.slug,
						}
					: undefined,
				membership: result.membership
					? {
							id: result.membership.id,
							status: result.membership.status,
						}
					: undefined,
				role: result.role ? { name: result.role.name } : undefined,
				permissions: result.permissions,
			},
		},
		200,
	);
});

// 3. OTP REQUEST (Mobile)
const phoneExistsRoute = createRoute({
	method: "post",
	path: "/otp/phone-exists",
	summary: "Check whether a phone number has an account in the selected tenant",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({ phone: z.string() }),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Whether the phone number is registered",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({ exists: z.boolean() }),
					}),
				},
			},
		},
	},
});

authRouter.openapi(phoneExistsRoute, async (c) => {
	const { phone } = c.req.valid("json");
	const tenantId = c.req.header("x-nexa-tenant-id");
	if (!tenantId) {
		throw new AppError(
			"Mobile tenant id is required",
			400,
			ErrorCode.BAD_REQUEST,
		);
	}
	const exists = await authService.phoneExists(phone, tenantId);
	return c.json({ success: true, data: { exists } }, 200);
});

const requestOtpRoute = createRoute({
	method: "post",
	path: "/otp/request",
	summary: "Request Phone OTP for Mobile Auth",
	description:
		"Generates a 6-digit OTP and delivers it by SMS to the submitted phone number.",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						phone: z.string().openapi({ example: "+1555000100" }),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "OTP generated and sent",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean().openapi({ example: true }),
						message: z.string().openapi({
							example: "Verification code sent by SMS",
						}),
					}),
				},
			},
		},
		400: {
			description: "Missing or invalid phone number",
		},
	},
});

authRouter.openapi(requestOtpRoute, async (c) => {
	const { phone } = c.req.valid("json");
	const tenantId = c.req.header("x-nexa-tenant-id");
	if (!tenantId) {
		throw new AppError(
			"Mobile tenant id is required",
			400,
			ErrorCode.BAD_REQUEST,
		);
	}
	await authService.requestOtp(phone, tenantId);
	return c.json(
		{
			success: true,
			message: "Verification code sent by SMS",
		},
		200,
	);
});

// 4. OTP VERIFY (Mobile)
const verifyOtpRoute = createRoute({
	method: "post",
	path: "/otp/verify",
	summary: "Verify Mobile Phone OTP",
	description:
		"Verifies the submitted 6-digit OTP code, creates or authenticates the user, and generates a session.",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						phone: z.string().openapi({ example: "+1555000100" }),
						code: z.string().length(6).openapi({ example: "123456" }),
						firstName: z.string().trim().min(1).optional(),
						lastName: z.string().trim().min(1).optional(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "OTP verification and authentication successful",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean().openapi({ example: true }),
						data: z.object({
							user: z.object({
								id: z.string(),
								name: z.string(),
								phone: z.string().nullable(),
							}),
							sessionToken: z.string(),
							tenant: z
								.object({
									id: z.string(),
									name: z.string(),
									slug: z.string(),
								})
								.optional(),
						}),
					}),
				},
			},
		},
		400: {
			description: "Invalid or expired OTP code",
		},
	},
});

authRouter.openapi(verifyOtpRoute, async (c) => {
	const { phone, code, firstName, lastName } = c.req.valid("json");
	const tenantId = c.req.header("x-nexa-tenant-id");
	if (!tenantId) {
		throw new AppError(
			"Mobile tenant id is required",
			400,
			ErrorCode.BAD_REQUEST,
		);
	}
	const result = await authService.verifyOtp(
		phone,
		code,
		tenantId,
		firstName && lastName ? { firstName, lastName } : undefined,
	);

	return c.json(
		{
			success: true,
			data: {
				user: {
					id: result.user.id,
					name: result.user.name,
					phone: result.user.phone,
				},
				sessionToken: result.sessionToken,
				tenant: result.tenant
					? {
							id: result.tenant.id,
							name: result.tenant.name,
							slug: result.tenant.slug,
						}
					: undefined,
			},
		},
		200,
	);
});

// 5. SESSION / ME (Requires Tenant Auth & Session)
const meRoute = createRoute({
	method: "get",
	path: "/me",
	summary: "Get current authenticated user profile & tenant membership context",
	description:
		"Returns the current session user, resolved active tenant, membership details, role, and permissions.",
	responses: {
		200: {
			description: "Active session and tenancy profile",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean().openapi({ example: true }),
						data: z.object({
							user: z.object({
								id: z.string(),
								name: z.string(),
								email: z.string(),
							}),
							tenant: z.object({
								id: z.string(),
								name: z.string(),
								slug: z.string(),
							}),
							membership: z.object({
								id: z.string(),
								status: z.string(),
							}),
							role: z.object({
								name: z.string(),
							}),
							permissions: z.array(z.string()),
						}),
					}),
				},
			},
		},
		401: { description: "Unauthorized" },
		403: { description: "Forbidden / Inactive membership" },
	},
});

authRouter.use("/me", async (c, next) => {
	const sessionResult = await auth.api.getSession({
		headers: c.req.raw.headers,
	});
	if (!sessionResult?.user) {
		throw new AppError("Authentication required", 401, ErrorCode.UNAUTHORIZED);
	}
	if (sessionResult.user.isSuperAdmin) {
		c.set("user", sessionResult.user);
		c.set("session", sessionResult.session);
		await next();
		return;
	}
	await requireTenantAuth()(c, next);
});
authRouter.openapi(meRoute, async (c) => {
	const user = c.get("user");
	const tenant = c.get("tenant");
	const membership = c.get("membership");
	const role = c.get("role");
	const permissions = c.get("permissions") ?? [];

	return c.json(
		{
			success: true,
			data: {
				user: user
					? {
							id: user.id,
							name: user.name,
							email: user.email,
							isSuperAdmin: user.isSuperAdmin ?? false,
						}
					: { id: "", name: "", email: "" },
				tenant: tenant
					? {
							id: tenant.id,
							name: tenant.name,
							slug: tenant.slug,
						}
					: { id: "", name: "", slug: "" },
				membership: membership
					? {
							id: membership.id,
							status: membership.status,
						}
					: { id: "", status: "ACTIVE" },
				role: role
					? {
							name: role.name,
						}
					: { name: user?.isSuperAdmin ? "SUPER_ADMIN" : "" },
				permissions,
			},
		},
		200,
	);
});

// 6. LOGOUT
const logoutRoute = createRoute({
	method: "post",
	path: "/logout",
	summary: "Logout authenticated user session",
	description: "Invalidates the active user session.",
	responses: {
		200: {
			description: "Logged out successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean().openapi({ example: true }),
						message: z.string().openapi({ example: "Logged out successfully" }),
					}),
				},
			},
		},
	},
});

authRouter.openapi(logoutRoute, async (c) => {
	return c.json(
		{
			success: true,
			message: "Logged out successfully",
		},
		200,
	);
});

export default authRouter;
