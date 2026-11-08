import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, phoneNumber } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { env } from "@/lib/env";
import { smsEthiopiaOtpSender } from "@/services/otp-sender.interface";

import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			users: schema.users,
			accounts: schema.accounts,
			sessions: schema.sessions,
			verifications: schema.verifications,
		},
	}),
	plugins: [
		bearer(),
		expo(),
		phoneNumber({
			otpLength: 6,
			signUpOnVerification: {
				getTempEmail: (phone) =>
					`${phone.replace(/[^0-9]/g, "")}@mobile.nexa.local`,
				getTempName: (phone) => phone,
			},
			sendOTP: async ({ phoneNumber: phone, code }) => {
				await smsEthiopiaOtpSender.sendOtp(phone, code);
			},
			schema: {
				user: {
					fields: {
						phoneNumber: "phone",
						phoneNumberVerified: "phoneVerified",
					},
				},
			},
		}),
	],
	trustedOrigins: [
		env.WEB_APP_URL,
		"nexa-ahadu-dental://",
		"nexa-ahadu-dental://*",
		...(process.env.NODE_ENV === "development"
			? [
					"exp://",
					"exp://**",
					"exp://192.168.*.*:*/**",
					"http://localhost:8081",
					"http://127.0.0.1:8081",
					"http://localhost:5173",
					"http://127.0.0.1:5173",
				]
			: []),
	],
	user: {
		modelName: "users",
		additionalFields: {
			isSuperAdmin: {
				type: "boolean",
				required: false,
				input: false,
			},
		},
		fields: {
			emailVerified: "emailVerified",
			phoneNumber: "phone",
			phoneNumberVerified: "phoneVerified",
		},
	},
	account: {
		modelName: "accounts",
		fields: {
			userId: "userId",
			accountId: "accountId",
			providerId: "providerId",
			accessToken: "accessToken",
			refreshToken: "refreshToken",
			accessTokenExpiresAt: "accessTokenExpiresAt",
			refreshTokenExpiresAt: "refreshTokenExpiresAt",
			password: "password",
		},
	},
	session: {
		modelName: "sessions",
		fields: {
			userId: "userId",
			token: "token",
			expiresAt: "expiresAt",
			ipAddress: "ipAddress",
			userAgent: "userAgent",
		},
	},
	verification: {
		modelName: "verifications",
		fields: {
			identifier: "identifier",
			value: "value",
			expiresAt: "expiresAt",
		},
	},
	advanced: {
		database: {
			generateId: false,
		},
		generateId: false,
	},
	emailAndPassword: {
		enabled: true,
	},
});
