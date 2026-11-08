import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { deposits, inventoryVerifications, issueItems, issues, products, reportItems, salesReports, stockMovements, threadEvents, users } from "@/db/schema";
import { issuesRepository } from "@/repositories/issues.repository";
import { stockRepository } from "@/repositories/stock.repository";
import { writeAudit } from "@/repositories/audit.repository";
import { createIssue } from "@/services/inventory.service";
import { readImage } from "@/services/storage.service";

type Actor = { id: string; role?: string | null };
type ReportLineInput = { product_id: string; racks_sold: number };
type ReportInput = { assignment_id?: string; issue_id?: string; lines: ReportLineInput[]; bank_reference: string; receipt_file_key?: string; bank_name?: string };
const moneyCents = (value: string | number) => { const [whole, fraction = ""] = String(value).split("."); return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2)); };
const money = (value: number) => `${value < 0 ? "-" : ""}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, "0")}`;
const fail = (message: string, status: 400 | 403 | 404 | 409 = 400, code = status === 403 ? ErrorCode.FORBIDDEN : status === 404 ? ErrorCode.NOT_FOUND : status === 409 ? ErrorCode.CONFLICT : ErrorCode.VALIDATION_ERROR): never => { throw new AppError(message, status, code); };
const isSales = (actor: Actor) => actor.role === "sales";
const canFinance = (actor: Actor) => actor.role === "admin" || actor.role === "accountant" || actor.role === "finance";
const canWarehouse = (actor: Actor) => actor.role === "admin" || actor.role === "storekeeper" || actor.role === "warehouse_manager";
const apiStatus = (status: string) => status === "submitted" ? "pending" : status === "verified" ? "successful" : "declined";

export async function createAssignment(actor: Actor, input: { sales_id: string; beverage_id: string; racks: number }) {
	if (!canWarehouse(actor)) fail("Only warehouse managers can assign racks", 403);
	if (!Number.isInteger(input.racks) || input.racks <= 0) fail("racks must be a positive integer");
	return createIssue(actor, { sales_user_id: input.sales_id, items: [{ product_id: input.beverage_id, quantity: input.racks }] });
}

export async function warehouseStock() { return stockRepository.balances(); }
export async function patchWarehouseStock(actor: Actor, productId: string, racks: number, note: string) {
	if (!canWarehouse(actor)) fail("Only warehouse managers can change warehouse stock", 403);
	const { adjustStock } = await import("@/services/inventory.service");
	return adjustStock(actor, { product_id: productId, racks, note });
}

async function reportRows(actor: Actor, reportId?: string) {
	const report = (await db.select({ report: salesReports, issue: issues, seller: { id: users.id, name: users.name, email: users.email } }).from(salesReports).innerJoin(issues, eq(issues.id, salesReports.issueId)).innerJoin(users, eq(users.id, salesReports.salesUserId)).where(reportId ? eq(salesReports.id, reportId) : undefined).orderBy(desc(salesReports.submittedAt)));
	return report.filter((row) => !isSales(actor) || row.report.salesUserId === actor.id);
}

async function reportDetail(actor: Actor, reportId: string) {
	const row = (await reportRows(actor, reportId))[0];
	if (!row) fail("Report not found", 404);
	if (isSales(actor) && row.report.salesUserId !== actor.id) fail("Forbidden", 403);
	const lines = await db.select({ line: reportItems, product: products, assignment: issueItems }).from(reportItems).innerJoin(products, eq(products.id, reportItems.productId)).innerJoin(issueItems, and(eq(issueItems.issueId, row.issue.id), eq(issueItems.productId, reportItems.productId))).where(eq(reportItems.reportId, reportId));
	const deposit = (await db.select().from(deposits).where(eq(deposits.reportId, reportId)).limit(1))[0];
	const amountCents = lines.reduce((sum, line) => sum + line.line.sold * moneyCents(line.assignment.unitPrice), 0);
	return { report: { ...row.report, status: apiStatus(row.report.status), amount: money(amountCents), bankReference: deposit?.referenceNo ?? "", receiptFileKey: deposit?.slipFileKey ?? null, declineReason: row.report.note, decidedAt: null }, assignment: row.issue, sales: row.seller, lines: lines.map((line) => ({ beverage: line.product, racksSold: line.line.sold, unitPrice: line.assignment.unitPrice })), receipt: deposit?.slipFileKey ? { key: deposit.slipFileKey, reference: deposit.referenceNo } : null };
}

export async function salesReport(actor: Actor, reportId: string) {
	if (!isSales(actor)) fail("Only sales representatives can view this report", 403);
	return reportDetail(actor, reportId);
}

export async function salesStock(actor: Actor) {
	if (!isSales(actor)) fail("Only sales representatives can view personal stock", 403);
	const assigned = await db.select({ item: issueItems, product: products }).from(issueItems).innerJoin(issues, eq(issues.id, issueItems.issueId)).innerJoin(products, eq(products.id, issueItems.productId)).where(eq(issues.salesUserId, actor.id));
	const soldRows = await db.select({ line: reportItems, report: salesReports }).from(reportItems).innerJoin(salesReports, eq(salesReports.id, reportItems.reportId)).where(and(eq(salesReports.salesUserId, actor.id), inArray(salesReports.status, ["submitted", "verified"])));
	const byProduct = new Map<string, { beverage: typeof products.$inferSelect; assigned: number; sold: number }>();
	for (const row of assigned) { const current = byProduct.get(row.item.productId) ?? { beverage: row.product, assigned: 0, sold: 0 }; current.assigned += row.item.quantity; byProduct.set(row.item.productId, current); }
	for (const row of soldRows) { const current = byProduct.get(row.line.productId); if (current) current.sold += row.line.sold; }
	let racksLeft = 0; let estimatedValue = 0; let soldValue = 0;
	const items = [...byProduct.values()].map((row) => { const left = row.assigned - row.sold; const priceCents = moneyCents(row.beverage.pricePerRack); racksLeft += left; estimatedValue += left * priceCents; soldValue += row.sold * priceCents; return { beverage: row.beverage, assigned: row.assigned, sold: row.sold, left, price: row.beverage.pricePerRack, left_value: money(left * priceCents) }; });
	return { items, totals: { racks_left: racksLeft, est_value: money(estimatedValue), sold_value: money(soldValue) } };
}

export async function createSalesReport(actor: Actor, input: ReportInput, idempotencyKey: string | undefined, fileExists: (key: string) => Promise<boolean>) {
	if (!isSales(actor)) fail("Only sales representatives can submit reports", 403);
	if (!idempotencyKey?.trim()) fail("Idempotency-Key header is required");
	if (!input.lines.length || !input.bank_reference.trim()) fail("At least one line and a transaction reference are required");
	if (input.receipt_file_key && !await fileExists(input.receipt_file_key)) fail("Receipt file was not found");
	const issueId = input.assignment_id ?? input.issue_id;
	if (!issueId) fail("assignment_id is required");
	for (const line of input.lines) if (!Number.isInteger(line.racks_sold) || line.racks_sold <= 0) fail("racks_sold must be a positive integer");
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${idempotencyKey}))`);
		const previous = (await tx.select().from(salesReports).where(eq(salesReports.idempotencyKey, idempotencyKey)).limit(1))[0];
		if (previous) return { reportId: previous.id };
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${issueId}))`);
		const issue = (await tx.select().from(issues).where(eq(issues.id, issueId)).limit(1))[0];
		if (!issue || issue.salesUserId !== actor.id) fail("Assignment not found", 404);
		if (issue.status !== "open") fail("This assignment already has a report or is closed", 409);
		const assigned = await tx.select().from(issueItems).where(eq(issueItems.issueId, issueId));
		const prior = await tx.select({ line: reportItems, report: salesReports }).from(reportItems).innerJoin(salesReports, eq(salesReports.id, reportItems.reportId)).where(and(eq(salesReports.issueId, issueId), inArray(salesReports.status, ["submitted", "verified"])));
		let amountCents = 0;
		const rows = input.lines.map((line) => {
			const assignment = assigned.find((item) => item.productId === line.product_id); if (!assignment) fail("Report contains a beverage not in the assignment");
			const sold = prior.filter((item) => item.line.productId === line.product_id).reduce((sum, item) => sum + item.line.sold, 0);
			if (line.racks_sold > assignment.quantity - sold) fail(`Only ${assignment.quantity - sold} racks remain for this beverage`, 409);
			amountCents += line.racks_sold * moneyCents(assignment.unitPrice);
			return { productId: line.product_id, sold: line.racks_sold, returned: 0, damaged: 0 };
		});
		const duplicateReference = (await tx.select({ id: deposits.id }).from(deposits).where(eq(deposits.referenceNo, input.bank_reference.trim())).limit(1))[0];
		if (duplicateReference) fail("This bank reference has already been submitted", 409);
		const report = (await tx.insert(salesReports).values({ issueId, salesUserId: actor.id, status: "submitted", idempotencyKey }).returning())[0];
		if (!report) throw new Error("Report creation failed");
		await tx.insert(reportItems).values(rows.map((row) => ({ reportId: report.id, ...row })));
		await tx.insert(deposits).values({ reportId: report.id, amount: money(amountCents), bankName: input.bank_name?.trim() || "Bank transfer", referenceNo: input.bank_reference.trim(), slipFileKey: input.receipt_file_key || null });
		await tx.update(issues).set({ status: "reported" }).where(eq(issues.id, issueId));
		await tx.insert(threadEvents).values([
			{ issueId, actorId: actor.id, type: "report_submitted", payload: { reportId: report.id, amount: money(amountCents) } },
			{ issueId, actorId: actor.id, type: "deposit_added", payload: { reportId: report.id, reference: input.bank_reference.trim(), amount: money(amountCents) } },
		]);
		await writeAudit(tx, { actorUserId: actor.id, action: "CREATE", entityType: "sales_report", entityId: report.id, newValues: { issueId, status: "pending", amount: money(amountCents) } });
		return { reportId: report.id };
	}).then(({ reportId }) => reportDetail(actor, reportId));
}

export async function listMyReports(actor: Actor, status?: string, cursor?: string) {
	if (!isSales(actor)) fail("Only sales representatives can view this history", 403);
	const rows = await reportRows(actor);
	const filtered = rows.filter((row) => !status || apiStatus(row.report.status) === status).filter((row) => !cursor || row.report.submittedAt.toISOString() < cursor);
	const page = filtered.slice(0, 25);
	return { items: await Promise.all(page.map((row) => reportDetail(actor, row.report.id))), nextCursor: page.length === 25 ? page.at(-1)?.report.submittedAt : null };
}

export async function listFinancePayments(actor: Actor, status?: string, cursor?: string) {
	if (!canFinance(actor)) fail("Finance access required", 403);
	const rows = await reportRows(actor);
	const filtered = rows.filter((row) => !status || apiStatus(row.report.status) === status).filter((row) => !cursor || row.report.submittedAt.toISOString() < cursor);
	const page = filtered.slice(0, 25);
	const items = await Promise.all(page.map((row) => reportDetail(actor, row.report.id)));
	return { items, nextCursor: page.length === 25 ? page[page.length - 1]?.report.submittedAt.toISOString() ?? null : null, counts: { pending: rows.filter((row) => row.report.status === "submitted").length, successful: rows.filter((row) => row.report.status === "verified").length, declined: rows.filter((row) => row.report.status === "flagged").length } };
}

export async function decidePayment(actor: Actor, reportId: string, decision: "successful" | "declined", reason?: string) {
	if (!canFinance(actor)) fail("Finance access required", 403);
	if (decision === "declined" && !reason?.trim()) fail("A decline reason is required");
	return db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${reportId}))`);
		const row = (await tx.select({ report: salesReports, issue: issues }).from(salesReports).innerJoin(issues, eq(issues.id, salesReports.issueId)).where(eq(salesReports.id, reportId)).limit(1))[0];
		if (!row) fail("Payment not found", 404);
		if (row.report.status !== "submitted") fail("Payment has already been decided", 409);
		const lines = await tx.select({ line: reportItems, assignment: issueItems }).from(reportItems).innerJoin(issueItems, and(eq(issueItems.issueId, row.issue.id), eq(issueItems.productId, reportItems.productId))).where(eq(reportItems.reportId, reportId));
		const amountCents = lines.reduce((sum, line) => sum + line.line.sold * moneyCents(line.assignment.unitPrice), 0);
		await tx.insert(inventoryVerifications).values({ reportId, accountantId: actor.id, decision: decision === "successful" ? "approved" : "flagged", expectedCash: money(amountCents), depositedCash: money(amountCents), cashVariance: "0.00", racksVariance: 0, note: reason?.trim() || null });
		if (decision === "successful") {
			for (const line of lines) if (line.line.sold > 0) await tx.insert(stockMovements).values({ productId: line.line.productId, type: "adjustment", warehouseDelta: 0, holderDelta: -line.line.sold, holderUserId: row.issue.salesUserId, issueId: row.issue.id, note: "Successful beverage payment", createdBy: actor.id });
			await tx.update(salesReports).set({ status: "verified" }).where(eq(salesReports.id, reportId));
			await tx.update(issues).set({ status: "verified", closedAt: new Date() }).where(eq(issues.id, row.issue.id));
			await tx.insert(threadEvents).values({ issueId: row.issue.id, actorId: actor.id, type: "verified", payload: { reportId } });
		} else {
			await tx.update(salesReports).set({ status: "flagged", note: reason?.trim() }).where(eq(salesReports.id, reportId));
			await tx.update(issues).set({ status: "open", closedAt: null }).where(eq(issues.id, row.issue.id));
			await tx.insert(threadEvents).values({ issueId: row.issue.id, actorId: actor.id, type: "flagged", payload: { reportId, note: reason?.trim() } });
		}
		await writeAudit(tx, { actorUserId: actor.id, action: "UPDATE", entityType: "sales_report", entityId: reportId, newValues: { decision, reason: reason?.trim() || null } });
		return { reportId, status: decision };
	});
}

export async function financeOverview(actor: Actor, date?: string) {
	if (!canFinance(actor)) fail("Finance access required", 403);
	const rows = await reportRows(actor);
	const details = await Promise.all(rows.map((row) => reportDetail(actor, row.report.id)));
	const inDate = date ? details.filter((row) => row.report.submittedAt.slice(0, 10) === date) : details;
	const confirmed = inDate.filter((row) => row.report.status === "successful").reduce((sum, row) => sum + moneyCents(row.report.amount), 0);
	const pending = inDate.filter((row) => row.report.status === "pending").reduce((sum, row) => sum + moneyCents(row.report.amount), 0);
	const declined = inDate.filter((row) => row.report.status === "declined").reduce((sum, row) => sum + moneyCents(row.report.amount), 0);
	const balances = await stockRepository.balances();
	return { confirmed_revenue: money(confirmed), pending_amount: money(pending), declined_amount: money(declined), stock_per_beverage: balances.map((row) => ({ beverage: row.product, warehouse_racks: Number(row.warehouseBalance), racks_out_with_reps: Number(row.heldBySalespeople) })), revenue_per_rep: inDate.filter((row) => row.report.status === "successful").reduce((all, row) => { const current = all.find((item) => item.salesId === row.sales.id); if (current) current.amount = money(moneyCents(current.amount) + moneyCents(row.report.amount)); else all.push({ salesId: row.sales.id, name: row.sales.name, amount: row.report.amount }); return all; }, [] as { salesId: string; name: string; amount: string }[]) };
}

export async function readBeverageReceipt(actor: Actor, key: string) {
	const rows = await db.select({ salesUserId: salesReports.salesUserId }).from(deposits).innerJoin(salesReports, eq(salesReports.id, deposits.reportId)).where(eq(deposits.slipFileKey, key)).limit(1);
	if (!rows[0] || (isSales(actor) && rows[0].salesUserId !== actor.id) || (!isSales(actor) && !canFinance(actor))) fail("Forbidden", 403, ErrorCode.FORBIDDEN);
	return readImage(key);
}
