import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import dns from "node:dns";
import { env } from "../lib/env";
import { currentDatabase } from "./request-context";

// Prefer IPv4 for Neon direct endpoints in local environments where the
// advertised IPv6 route may be unreachable. This avoids wasting the whole
// connection timeout before pg reaches the working address.
dns.setDefaultResultOrder("ipv4first");

const pool = new Pool({
	connectionString: env.DATABASE_URL,
	// Keep the remote Neon pool small and predictable. Auth checks should not
	// open a burst of independent TCP connections during frontend navigation.
	max: 5,
	idleTimeoutMillis: 20_000,
	// Auth/session requests must fail promptly when the remote database is
	// unreachable or a query is blocked; otherwise the frontend route guard
	// cannot settle and TanStack Router remains pending.
	connectionTimeoutMillis: 10_000,
	statement_timeout: 15_000,
	keepAlive: true,
	keepAliveInitialDelayMillis: 10_000,
	idle_in_transaction_session_timeout: 60_000,
	// validate connections on checkout to avoid stale prepared statements
	// after long-lived connections or schema changes
});

const baseDb = drizzle({
	client: pool,
});

// Repositories keep importing `db`, while request middleware transparently
// redirects those calls to the current transaction. This makes RLS context
// apply to every query without duplicating transaction plumbing in services.
export const db = new Proxy(baseDb, {
	get(target, property, _receiver) {
		const scoped = currentDatabase(target);
		const value = Reflect.get(scoped, property, scoped);
		return typeof value === "function" ? value.bind(scoped) : value;
	},
});

export { pool };
