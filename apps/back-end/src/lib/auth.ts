import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { env } from "@/lib/env";
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
		admin({ defaultRole: "sales", adminRoles: ["admin"] }),
	],
	trustedOrigins: [
		env.WEB_APP_URL,
		"zola://",
		"zola://*",
		...(env.NODE_ENV !== "production"
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
	user: { modelName: "users" },
	account: { modelName: "accounts" },
	session: { modelName: "sessions" },
	verification: { modelName: "verifications" },
	emailAndPassword: { enabled: true },
});
