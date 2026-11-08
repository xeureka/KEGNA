import { sql } from "drizzle-orm";
import { db } from "./index";

export async function checkDatabaseConnection(
	retries = 5,
	delayMs = 2000,
): Promise<boolean> {
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			await db.execute(sql`SELECT 1`);
			return true;
		} catch (err) {
			if (attempt === retries) {
				throw err;
			}
			console.log(
				`Database connection attempt ${attempt} failed, retrying in ${delayMs}ms...`,
			);
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}
	return false;
}
