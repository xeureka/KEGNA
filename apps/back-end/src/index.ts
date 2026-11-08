import { serve } from "@hono/node-server";
import app from "./app";
import "./lib/env";
import { checkDatabaseConnection } from "./db/health";
import { db } from "./db";
import { ensurePaymentSchema } from "./db/payment-migration";
import { sql } from "drizzle-orm";

const port = process.env.PORT ? Number(process.env.PORT) : 3001;
const hostname = "0.0.0.0";

function logFatalError(label: string, error: unknown) {
	console.error(label, error);
	if (error instanceof Error && error.stack) {
		console.error(error.stack);
	}
}

process.on("uncaughtException", (error) => {
	logFatalError("Uncaught exception:", error);
	process.exit(1);
});

process.on("unhandledRejection", (reason) => {
	logFatalError("Unhandled rejection:", reason);
	process.exit(1);
});

async function main() {
	const server = serve(
		{
			fetch: app.fetch,
			port,
			hostname,
		},
		(info) => {
			console.log(`Nexa CRM API running on http://localhost:${info.port}`);
			console.log(`API Documentation: http://localhost:${info.port}/docs`);
			console.log(`OpenAPI JSON: http://localhost:${info.port}/openapi.json`);
		},
	);

	server.on("error", (err) => {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			(err as any).code === "EADDRINUSE"
		) {
			console.error(
				`Port ${port} is already in use. A previous instance may still be running.\n` +
					`Kill it with:  kill -9 $(pgrep -f "tsx src/index")   then restart.`,
			);
			logFatalError("Server listen error:", err);
			process.exit(1);
		}
		logFatalError("Server error:", err);
	});

	// Listen immediately so the frontend gets a real API response instead of
	// ECONNREFUSED while a remote database connection is warming up. Schema
	// migration is deliberately run once after connectivity is confirmed;
	// running it both here and below creates competing pool work on Neon.
	void checkDatabaseConnection()
		.then(async () => {
			console.log("Database connection established");
			// One lightweight checkout is enough. Multiple concurrent warmup
			// connections can trigger intermittent Neon connection timeouts and
			// make Better Auth's session lookup fail immediately after startup.
			const warmupCount = 1;
			await Promise.allSettled(
				Array.from({ length: warmupCount }, () => db.execute(sql`SELECT 1`)),
			);
			console.log(
				`Connection pool warmup attempted (${warmupCount} connections)`,
			);
			// The payment ledger is created by an idempotent, non-destructive
			// migration (the repo has no Drizzle migration journal, so
			// `pnpm db:migrate` applies nothing). Applying it at boot means a
			// fresh database can never answer a payment query with a missing
			// `payment_expires_at` / `PENDING_PAYMENT` error.
			await ensurePaymentSchema();
			console.log("Payment schema applied and verified (no drift)");
		})
		.catch((error) => {
			console.error(
				"Database is unavailable; API will remain online and retry on restart:",
				error,
			);
		});

	process.on("SIGTERM", () => {
		server.close(() => process.exit(0));
	});
	process.on("SIGINT", () => {
		server.close(() => process.exit(0));
	});
}

main().catch((error) => {
	logFatalError("Failed to start application:", error);
	process.exit(1);
});
