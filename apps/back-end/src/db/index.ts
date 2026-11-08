import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dns from "node:dns";
import { env } from "@/lib/env";

dns.setDefaultResultOrder("ipv4first");

export const pool = new Pool({
	connectionString: env.DATABASE_URL,
	max: 5,
	idleTimeoutMillis: 20_000,
	connectionTimeoutMillis: 10_000,
	statement_timeout: 15_000,
	keepAlive: true,
	keepAliveInitialDelayMillis: 10_000,
});

export const db = drizzle({ client: pool });
