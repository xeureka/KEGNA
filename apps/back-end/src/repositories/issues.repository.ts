import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues, issueItems, products, users, salesReports, reportItems, deposits, returnConfirmations, returnConfirmationItems, inventoryVerifications } from "@/db/schema";

export class IssuesRepository {
	async nextIssueNo(tx: any) { await tx.execute(sql`select pg_advisory_xact_lock(hashtext('zola:issue_no'))`); const [row] = await tx.select({ last: sql<number>`coalesce(max(cast(substring(${issues.issueNo} from 4) as integer)), 0)` }).from(issues); return `LO-${String(Number(row?.last ?? 0) + 1).padStart(6, "0")}`; }
	findSalesUser(id: string) { return db.select().from(users).where(and(eq(users.id, id), eq(users.role, "sales"), eq(users.banned, false))).limit(1); }
	create(tx: any, input: typeof issues.$inferInsert) { return tx.insert(issues).values(input).returning(); }
	insertItems(tx: any, input: (typeof issueItems.$inferInsert)[]) { return tx.insert(issueItems).values(input).returning(); }
	async list(filters: { userId?: string; status?: string; salesUserId?: string; from?: Date; to?: Date; limit: number; offset: number }) {
		const conditions = [];
		if (filters.userId) conditions.push(eq(issues.salesUserId, filters.userId));
		if (filters.status) conditions.push(eq(issues.status, filters.status as never));
		if (filters.salesUserId) conditions.push(eq(issues.salesUserId, filters.salesUserId));
		if (filters.from) conditions.push(gte(issues.issuedAt, filters.from));
		if (filters.to) conditions.push(lte(issues.issuedAt, filters.to));
		return db.select({ issue: issues, salesperson: { id: users.id, name: users.name, email: users.email } }).from(issues).innerJoin(users, eq(users.id, issues.salesUserId)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(issues.issuedAt)).limit(filters.limit).offset(filters.offset);
	}
	findById(id: string) { return db.select({ issue: issues, salesperson: { id: users.id, name: users.name, email: users.email } }).from(issues).innerJoin(users, eq(users.id, issues.salesUserId)).where(eq(issues.id, id)).limit(1); }
	items(id: string) { return db.select({ item: issueItems, product: products }).from(issueItems).innerJoin(products, eq(products.id, issueItems.productId)).where(eq(issueItems.issueId, id)).orderBy(asc(products.name)); }
	report(id: string) { return db.select().from(salesReports).where(eq(salesReports.issueId, id)).limit(1); }
	reportItems(id: string) { return db.select({ item: reportItems, product: products }).from(reportItems).innerJoin(products, eq(products.id, reportItems.productId)).where(eq(reportItems.reportId, id)); }
	deposits(id: string) { return db.select().from(deposits).where(eq(deposits.reportId, id)).orderBy(asc(deposits.depositedAt)); }
	confirmation(id: string) { return db.select().from(returnConfirmations).where(eq(returnConfirmations.issueId, id)).limit(1); }
	confirmationItems(id: string) { return db.select({ item: returnConfirmationItems, product: products }).from(returnConfirmationItems).innerJoin(products, eq(products.id, returnConfirmationItems.productId)).where(eq(returnConfirmationItems.confirmationId, id)); }
	verification(id: string) { return db.select().from(inventoryVerifications).where(eq(inventoryVerifications.reportId, id)).limit(1); }
}
export const issuesRepository = new IssuesRepository();
