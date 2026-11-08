import "dotenv/config";
import { z } from "zod";

const optionalEnvString = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() === "" ? undefined : value,
	z.string().trim().min(1).optional(),
);
const optionalEnvUrl = z.preprocess(
	(value) =>
		typeof value === "string" && value.trim() === "" ? undefined : value,
	z.string().url().optional(),
);

const envSchema = z.object({
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),

	PORT: z.coerce.number().int().positive().max(65535).default(3000),
	HOST: z.string().default("0.0.0.0"),

	DATABASE_URL: z
		.string()
		.startsWith(
			"postgres",
			"DATABASE_URL must be a postgres:// or postgresql:// connection string",
		)
		.url("DATABASE_URL MUST BE A VALID POSTGRES CONNECTION STRING URL"),

	BETTER_AUTH_SECRET: z
		.string()
		.trim()
		.min(32, "BETTER_AUTH_SECRET MUST BE AT LEAST 32 CHARACTERS"),

	BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL MUST BE A VALID URL"),
	WEB_APP_URL: z
		.string()
		.url("WEB_APP_URL MUST BE A VALID URL")
		.default("http://localhost:5173"),
	CORS_ORIGINS: z
		.string()
		.min(1, "CORS_ORIGINS must be a comma-separated list of allowed origins"),

	// Chapa gateway. Optional as a block so the API still boots without payment
	// credentials; `chapaService.assertConfigured()` rejects checkout attempts
	// with a clear 503 when they are missing.
	//
	// The mode decides which key pair is used. `CHAPA_SECRET_KEY` /
	// `CHAPA_PUBLIC_KEY` remain as an explicit override for both modes so an
	// existing deployment keeps working; otherwise the *_TEST_* / *_LIVE_*
	// pair for `CHAPA_MODE` is selected.
	CHAPA_MODE: z.enum(["test", "live"]).default("test"),
	CHAPA_TEST_SECRET_KEY: optionalEnvString,
	CHAPA_TEST_PUBLIC_KEY: optionalEnvString,
	CHAPA_LIVE_SECRET_KEY: optionalEnvString,
	CHAPA_LIVE_PUBLIC_KEY: optionalEnvString,
	CHAPA_SECRET_KEY: optionalEnvString,
	CHAPA_PUBLIC_KEY: optionalEnvString,
	CHAPA_WEBHOOK_SECRET: optionalEnvString,
	CHAPA_BASE_URL: z.string().url().default("https://api.chapa.co/v1"),
	// Where Chapa redirects the payer after they finish checkout. The mobile app
	// passes its own deep link per-transaction; this is the fallback.
	CHAPA_RETURN_URL: optionalEnvUrl,
	// Absolute URL Chapa POSTs the signed webhook to.
	CHAPA_CALLBACK_URL: optionalEnvUrl,
	SERVICE_CHARGE_ETB: z
		.string()
		.regex(/^\d+(?:\.\d{1,2})?$/)
		.default("50"),
	PAYMENT_HOLD_MINUTES: z.coerce
		.number()
		.int()
		.positive()
		.max(1440)
		.default(30),

	// SMSEthiopia OTP delivery (https://smsethiopia.com). Optional so the API
	// still boots without it; `smsEthiopiaService.assertConfigured()` rejects
	// send attempts with a clear 503 when the key is missing.
	SMS_ETHIOPIA: z.string().trim().min(1).optional(),
	SMS_ETHIOPIA_BASE_URL: z
		.string()
		.url()
		.default("https://smsethiopia.com/api"),

	LOG_LEVEL: z
		.enum(["trace", "debug", "info", "warn", "error", "fatal"])
		.default("info"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error("Invalid environment variables:");

	for (const issue of parsedEnv.error.issues) {
		console.error(` - ${issue.path.join(".")}: ${issue.message}`);
	}

	console.error(parsedEnv.error);
	process.exit(1);
}

const rawEnv = parsedEnv.data;

type ChapaKeySource = {
	CHAPA_MODE: "test" | "live";
	CHAPA_TEST_SECRET_KEY?: string;
	CHAPA_TEST_PUBLIC_KEY?: string;
	CHAPA_LIVE_SECRET_KEY?: string;
	CHAPA_LIVE_PUBLIC_KEY?: string;
	CHAPA_SECRET_KEY?: string;
	CHAPA_PUBLIC_KEY?: string;
};

function cleanKey(val?: string) {
	if (!val) return undefined;
	const cleaned = val
		.trim()
		.replace(/^["']|["']$/g, "")
		.trim();
	return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Resolve the key pair for the active mode. The mode-specific key wins; the
 * generic CHAPA_SECRET_KEY/CHAPA_PUBLIC_KEY pair is a fallback so an existing
 * deployment that only sets those two keeps working unchanged.
 * Exported as a pure function so the mode rules are unit-testable.
 */
export function resolveChapaKeys(source: ChapaKeySource) {
	const isLive = source.CHAPA_MODE === "live";
	const rawSecret = isLive
		? (source.CHAPA_LIVE_SECRET_KEY ?? source.CHAPA_SECRET_KEY)
		: (source.CHAPA_TEST_SECRET_KEY ?? source.CHAPA_SECRET_KEY);
	const rawPublic = isLive
		? (source.CHAPA_LIVE_PUBLIC_KEY ?? source.CHAPA_PUBLIC_KEY)
		: (source.CHAPA_TEST_PUBLIC_KEY ?? source.CHAPA_PUBLIC_KEY);

	return {
		secretKey: cleanKey(rawSecret),
		publicKey: cleanKey(rawPublic),
	};
}

const resolvedKeys = resolveChapaKeys(rawEnv);

export const env = {
	...rawEnv,
	CHAPA_SECRET_KEY: resolvedKeys.secretKey,
	CHAPA_PUBLIC_KEY: resolvedKeys.publicKey,
};
export type Env = typeof env;

// Fail fast on a half-configured gateway. A partial setup (key without
// webhook secret, live mode without a live key, ...) otherwise only surfaces
// as a failed checkout or an unsigned webhook much later.
const chapaStartupProblems: string[] = [];
if (
	env.CHAPA_MODE === "live" &&
	!rawEnv.CHAPA_LIVE_SECRET_KEY &&
	!rawEnv.CHAPA_SECRET_KEY
) {
	chapaStartupProblems.push(
		"CHAPA_MODE=live but CHAPA_LIVE_SECRET_KEY/CHAPA_SECRET_KEY is not set; live payments will be rejected",
	);
}
if (env.CHAPA_MODE === "test" && !env.CHAPA_SECRET_KEY) {
	chapaStartupProblems.push(
		"CHAPA_SECRET_KEY/CHAPA_TEST_SECRET_KEY missing; online checkout will return 503",
	);
}
if (env.CHAPA_SECRET_KEY) {
	const prefix = env.CHAPA_SECRET_KEY.slice(0, 12);
	if (
		env.CHAPA_MODE === "test" &&
		!env.CHAPA_SECRET_KEY.startsWith("CHASECK_TEST-")
	) {
		chapaStartupProblems.push(
			`CHAPA_MODE=test but CHAPA_SECRET_KEY (${prefix}...) does not start with 'CHASECK_TEST-'`,
		);
	} else if (
		env.CHAPA_MODE === "live" &&
		!env.CHAPA_SECRET_KEY.startsWith("CHASECK_LIVE-") &&
		!env.CHAPA_SECRET_KEY.startsWith("CHASECK-")
	) {
		chapaStartupProblems.push(
			`CHAPA_MODE=live but CHAPA_SECRET_KEY (${prefix}...) does not start with 'CHASECK_LIVE-' or 'CHASECK-'`,
		);
	} else {
		console.log(
			`[Chapa] Gateway configured (${env.CHAPA_MODE} mode, secret key prefix: ${prefix}..., len: ${env.CHAPA_SECRET_KEY.length})`,
		);
	}
}
if (env.NODE_ENV === "production") {
	if (!env.CHAPA_WEBHOOK_SECRET) {
		chapaStartupProblems.push(
			"CHAPA_WEBHOOK_SECRET missing; every webhook will be rejected with 401",
		);
	}
	if (env.CHAPA_MODE === "test") {
		chapaStartupProblems.push(
			"CHAPA_MODE=test in production; cards and visits will be activated from sandbox payments",
		);
	}
}
for (const problem of chapaStartupProblems) {
	console.error(`Chapa configuration: ${problem}`);
}
if (env.NODE_ENV === "production" && chapaStartupProblems.length > 0) {
	console.error(
		`Startup aborted: refusing to start in production with ${chapaStartupProblems.length} Chapa configuration problem(s).`,
	);
	process.exit(1);
}

/**
 * True when Chapa can actually process a checkout. Kept next to the schema so
 * adding a variable to the Chapa block cannot silently drift from this check.
 */
export const isChapaConfigured = Boolean(env.CHAPA_SECRET_KEY);

export const isSmsEthiopiaConfigured = Boolean(env.SMS_ETHIOPIA);
