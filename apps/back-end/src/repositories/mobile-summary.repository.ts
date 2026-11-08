import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { deposits, issueItems, issues, products, reportItems, salesReports, stockMovements, users } from "@/db/schema";

export async function readMobileSummaryRows(actorId: string, role: string, from?: Date, to?: Date) {
	const issueConditions = [];
	if (role === "sales") issueConditions.push(eq(issues.salesUserId, actorId));
	if (from) issueConditions.push(gte(issues.issuedAt, from));
	if (to) issueConditions.push(lte(issues.issuedAt, to));
	const issueRows = await db.select({ issue: issues, report: salesReports, salesperson: { id: users.id, name: users.name, email: users.email } })
		.from(issues)
		.leftJoin(salesReports, eq(salesReports.issueId, issues.id))
		.innerJoin(users, eq(users.id, issues.salesUserId))
		.where(issueConditions.length ? and(...issueConditions) : undefined)
		.orderBy(desc(issues.issuedAt));
	const itemRows = await db.select({ item: issueItems, reportItem: reportItems, product: products })
		.from(issueItems)
		.innerJoin(products, eq(products.id, issueItems.productId))
		.leftJoin(salesReports, eq(salesReports.issueId, issueItems.issueId))
		.leftJoin(reportItems, and(eq(reportItems.reportId, salesReports.id), eq(reportItems.productId, issueItems.productId)));
	const movementRows = await db.select({ movement: stockMovements, product: products })
		.from(stockMovements)
		.innerJoin(products, eq(products.id, stockMovements.productId));
	const depositRows = await db.select({ deposit: deposits, report: salesReports }).from(deposits).innerJoin(salesReports, eq(salesReports.id, deposits.reportId));
	return { issueRows, itemRows, movementRows, depositRows };
}
