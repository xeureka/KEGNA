import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	PORT: z.coerce.number().int().positive().max(65535).default(3001),
	HOST: z.string().default("0.0.0.0"),
	DATABASE_URL: z.string().startsWith("postgres", "DATABASE_URL must be a Postgres connection string").url(),
	BETTER_AUTH_SECRET: z.string().trim().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
	BETTER_AUTH_URL: z.string().url(),
	WEB_APP_URL: z.string().url().default("http://localhost:5173"),
	CORS_ORIGINS: z.string().min(1).default("http://localhost:5173"),
	STORAGE_DIR: z.string().trim().min(1).default("./storage"),
	LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	console.error("Invalid environment variables:");
	for (const issue of parsed.error.issues) console.error(` - ${issue.path.join(".")}: ${issue.message}`);
	process.exit(1);
}
export const env = parsed.data;
export type Env = typeof env;
