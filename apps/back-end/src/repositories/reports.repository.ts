import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { deposits, reportItems, salesReports } from "@/db/schema";
export class ReportsRepository {
	create(tx: any, input: typeof salesReports.$inferInsert) { return tx.insert(salesReports).values(input).returning(); }
	createItems(tx: any, input: (typeof reportItems.$inferInsert)[]) { return tx.insert(reportItems).values(input).returning(); }
	createDeposit(tx: any, input: typeof deposits.$inferInsert) { return tx.insert(deposits).values(input).returning(); }
	findById(id: string) { return db.select().from(salesReports).where(eq(salesReports.id, id)).limit(1); }
	listDeposits(id: string) { return db.select().from(deposits).where(eq(deposits.reportId, id)).orderBy(asc(deposits.depositedAt)); }
}
export const reportsRepository = new ReportsRepository();
