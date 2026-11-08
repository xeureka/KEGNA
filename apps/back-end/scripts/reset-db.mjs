import "dotenv/config";
import { Client } from "pg";

if (process.env.NODE_ENV === "production") {
	console.error("Refusing to reset the database while NODE_ENV=production.");
	process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error("DATABASE_URL is required.");
	process.exit(1);
}

const client = new Client({
	connectionString,
	connectionTimeoutMillis: 10_000,
	statement_timeout: 30_000,
});

try {
	await client.connect();
	await client.query("DROP SCHEMA IF EXISTS public CASCADE");
	await client.query("CREATE SCHEMA public");
	await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
	await client.query("GRANT ALL ON SCHEMA public TO public");
	console.log("Database schemas reset (public, drizzle).");
} catch (error) {
	console.error(`Database reset failed: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
} finally {
	await client.end();
}
