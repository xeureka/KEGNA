import { sql } from "drizzle-orm";
import { db } from "./index";

const requiredColumns = [
	["products", "id"], ["products", "price_per_rack"],
	["issues", "sales_user_id"], ["issue_items", "issue_id"],
	["stock_movements", "warehouse_delta"], ["stock_movements", "holder_delta"],
	["sales_reports", "issue_id"], ["sales_reports", "idempotency_key"],
	["report_items", "report_id"], ["deposits", "reference_no"], ["deposits", "slip_file_key"],
	["inventory_verifications", "report_id"], ["thread_events", "issue_id"],
] as const;

export async function checkInventorySchema(): Promise<void> {
	const missingColumns: string[] = [];
	for (const [table, column] of requiredColumns) {
		const result = await db.execute(sql`select 1 from information_schema.columns where table_schema = 'public' and table_name = ${table} and column_name = ${column} limit 1`);
		if (result.rows.length === 0) missingColumns.push(`${table}.${column}`);
	}
	const requiredEnums = [
		["report_status", "submitted"], ["report_status", "verified"], ["report_status", "flagged"],
		["thread_event_type", "report_submitted"], ["thread_event_type", "deposit_added"],
	] as const;
	const missingEnums: string[] = [];
	for (const [enumName, enumValue] of requiredEnums) {
		const result = await db.execute(sql`select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid where t.typname = ${enumName} and e.enumlabel = ${enumValue} limit 1`);
		if (result.rows.length === 0) missingEnums.push(`${enumName}.${enumValue}`);
	}
	if (missingColumns.length || missingEnums.length) {
		throw new Error(`Inventory schema is incomplete. Missing columns: ${missingColumns.join(", ") || "none"}. Missing enum values: ${missingEnums.join(", ") || "none"}. Run the pending Drizzle migrations.`);
	}
}

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
