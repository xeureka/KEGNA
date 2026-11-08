import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { deposits, inventoryVerifications, issueItems, issues, products, reportItems, returnConfirmationItems, returnConfirmations, salesReports, stockMovements, threadEvents, users } from "@/db/schema";
import { issuesRepository } from "@/repositories/issues.repository";
import { productsRepository } from "@/repositories/products.repository";
import { stockRepository } from "@/repositories/stock.repository";
import { reportsRepository } from "@/repositories/reports.repository";
import { writeAudit } from "@/repositories/audit.repository";

type Actor = { id: string; role?: string | null };
type ItemInput = { product_id: string; quantity?: number; sold?: number; returned?: number; damaged?: number };

function bad(message: string, status: 400 | 403 | 404 | 409 = 400, code = status === 404 ? ErrorCode.NOT_FOUND : status === 409 ? ErrorCode.CONFLICT : status === 403 ? ErrorCode.FORBIDDEN : ErrorCode.VALIDATION_ERROR): never { throw new AppError(message, status, code); }
function positive(value: number, label: string) { if (!Number.isInteger(value) || value <= 0) bad(`${label} must be a positive integer`); }
function nonNegative(value: number, label: string) { if (!Number.isInteger(value) || value < 0) bad(`${label} must be a non-negative integer`); }
function cents(value: string | number) { const raw = String(value); if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) bad("Money must have at most two decimal places"); const [whole, fraction = ""] = raw.split("."); return Number(whole) * 100 + Number(fraction.padEnd(2, "0")); }
function money(value: number) { const sign = value < 0 ? "-" : ""; const absolute = Math.abs(value); return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`; }
function uniqueItems(items: ItemInput[]) { const ids = new Set(items.map((item) => item.product_id)); if (ids.size !== items.length) bad("Each product may appear only once"); }
function event(tx: any, issueId: string, actorId: string | null, type: typeof threadEvents.$inferInsert["type"], payload: unknown) { return tx.insert(threadEvents).values({ issueId, actorId, type, payload }); }

export async function listProducts() { return productsRepository.list(); }
export async function createProduct(input: { name: string; sku: string; bottles_per_rack: number; price_per_rack: string }) {
	positive(input.bottles_per_rack, "bottles_per_rack"); cents(input.price_per_rack);
	if ((await productsRepository.findBySku(input.sku))[0]) bad("SKU already exists", 409);
	return (await productsRepository.create({ name: input.name.trim(), sku: input.sku.trim(), bottlesPerRack: input.bottles_per_rack, pricePerRack: input.price_per_rack }))[0];
}
export async function updateProduct(id: string, input: { name?: string; sku?: string; bottles_per_rack?: number; price_per_rack?: string; is_active?: boolean }) {
	const existing = (await productsRepository.findById(id))[0]; if (!existing) bad("Product not found", 404);
	if (input.bottles_per_rack !== undefined) positive(input.bottles_per_rack, "bottles_per_rack");
	if (input.price_per_rack !== undefined) cents(input.price_per_rack);
	if (input.sku && input.sku !== existing.sku && (await productsRepository.findBySku(input.sku))[0]) bad("SKU already exists", 409);
	return (await productsRepository.update(id, { ...(input.name === undefined ? {} : { name: input.name.trim() }), ...(input.sku === undefined ? {} : { sku: input.sku.trim() }), ...(input.bottles_per_rack === undefined ? {} : { bottlesPerRack: input.bottles_per_rack }), ...(input.price_per_rack === undefined ? {} : { pricePerRack: input.price_per_rack }), ...(input.is_active === undefined ? {} : { isActive: input.is_active }) }))[0];
}

export async function stockBalances() { return stockRepository.balances(); }
export async function stockMovementsList(filters: { productId?: string; type?: string; from?: Date; to?: Date; limit: number; offset: number }) { return stockRepository.movements(filters); }
export async function receiveStock(actor: Actor, input: { product_id: string; racks: number; batch_no?: string; expiry_date?: string; reference?: string }) {
	positive(input.racks, "racks");
	return db.transaction(async (tx) => {
		const product = (await tx.select().from(products).where(eq(products.id, input.product_id)).limit(1))[0]; if (!product) bad("Product not found", 404);
		await stockRepository.lockProduct(tx, product.id);
		const movement = (await tx.insert(stockMovements).values({ productId: product.id, type: "receive", warehouseDelta: input.racks, holderDelta: 0, batchNo: input.batch_no, expiryDate: input.expiry_date, reference: input.reference, createdBy: actor.id }).returning())[0];
		await writeAudit(tx, { actorUserId: actor.id, action: "CREATE", entityType: "stock_movement", entityId: movement?.id, newValues: movement });
		return movement;
	});
}
export async function adjustStock(actor: Actor, input: { product_id: string; racks: number; note: string }) {
	if (!Number.isInteger(input.racks) || input.racks === 0) bad("racks must be a non-zero integer"); if (!input.note.trim()) bad("note is required");
	return db.transaction(async (tx) => {
		const product = (await tx.select().from(products).where(eq(products.id, input.product_id)).limit(1))[0]; if (!product) bad("Product not found", 404);
		await stockRepository.lockProduct(tx, product.id); const balance = await stockRepository.warehouseBalance(tx, product.id); if (balance + input.racks < 0) bad("Adjustment would make warehouse stock negative", 409);
		const movement = (await tx.insert(stockMovements).values({ productId: product.id, type: "adjustment", warehouseDelta: input.racks, holderDelta: 0, note: input.note.trim(), createdBy: actor.id }).returning())[0];
		await writeAudit(tx, { actorUserId: actor.id, action: "CREATE", entityType: "stock_movement", entityId: movement?.id, newValues: movement }); return movement;
	});
}

export async function createIssue(actor: Actor, input: { sales_user_id: string; items: ItemInput[]; note?: string }) {
	if (!input.items.length) bad("At least one issue item is required"); uniqueItems(input.items); input.items.forEach((item) => positive(item.quantity ?? 0, "quantity"));
	return db.transaction(async (tx) => {
		const salesUser = (await tx.select().from(users).where(and(eq(users.id, input.sales_user_id), eq(users.role, "sales"), eq(users.banned, false))).limit(1))[0]; if (!salesUser) bad("Sales user is not active or does not have the sales role", 400);
		const issueNo = await issuesRepository.nextIssueNo(tx); const issue = (await tx.insert(issues).values({ issueNo, salesUserId: salesUser.id, issuedBy: actor.id, status: "open", note: input.note?.trim() || null }).returning())[0]; if (!issue) throw new Error("Issue creation failed");
		const items: typeof issueItems.$inferInsert[] = [];
		for (const item of input.items) {
			const product = (await tx.select().from(products).where(eq(products.id, item.product_id)).limit(1))[0]; if (!product) bad("Product not found", 404); if (!product.isActive) bad(`Product ${product.sku} is inactive`);
			await stockRepository.lockProduct(tx, product.id); const balance = await stockRepository.warehouseBalance(tx, product.id); const quantity = item.quantity ?? 0; if (balance < quantity) bad(`Insufficient warehouse stock for ${product.sku}`, 409);
			items.push({ issueId: issue.id, productId: product.id, quantity, unitPrice: product.pricePerRack });
			await tx.insert(stockMovements).values({ productId: product.id, type: "issue", warehouseDelta: -quantity, holderDelta: quantity, holderUserId: salesUser.id, issueId: issue.id, createdBy: actor.id });
		}
		await tx.insert(issueItems).values(items); await event(tx, issue.id, actor.id, "issued", { issueNo: issue.issueNo, items }); await writeAudit(tx, { actorUserId: actor.id, action: "CREATE", entityType: "issue", entityId: issue.id, newValues: issue }); return issue;
	});
}
function canSeeIssue(actor: Actor, issue: { salesUserId: string }) { return actor.role !== "sales" || actor.id === issue.salesUserId; }
export async function listIssues(actor: Actor, filters: { status?: string; salesUserId?: string; from?: Date; to?: Date; limit: number; offset: number }) { return issuesRepository.list({ ...filters, userId: actor.role === "sales" ? actor.id : undefined }); }

async function aggregate(q: any, issueId: string) {
	const row = (await q.select({ issue: issues, salesperson: { id: users.id, name: users.name, email: users.email } }).from(issues).innerJoin(users, eq(users.id, issues.salesUserId)).where(eq(issues.id, issueId)).limit(1))[0]; if (!row) bad("Issue not found", 404);
	const items = await q.select({ item: issueItems, product: products }).from(issueItems).innerJoin(products, eq(products.id, issueItems.productId)).where(eq(issueItems.issueId, issueId));
	const report = (await q.select().from(salesReports).where(eq(salesReports.issueId, issueId)).limit(1))[0] ?? null;
	const declared = report ? await q.select({ item: reportItems, product: products }).from(reportItems).innerJoin(products, eq(products.id, reportItems.productId)).where(eq(reportItems.reportId, report.id)) : [];
	const depositRows = report ? await q.select().from(deposits).where(eq(deposits.reportId, report.id)).orderBy(asc(deposits.depositedAt)) : [];
	const confirmation = (await q.select().from(returnConfirmations).where(eq(returnConfirmations.issueId, issueId)).limit(1))[0] ?? null;
	const confirmed = confirmation ? await q.select({ item: returnConfirmationItems, product: products }).from(returnConfirmationItems).innerJoin(products, eq(products.id, returnConfirmationItems.productId)).where(eq(returnConfirmationItems.confirmationId, confirmation.id)) : [];
	const verification = report ? ((await q.select().from(inventoryVerifications).where(eq(inventoryVerifications.reportId, report.id)).limit(1))[0] ?? null) : null;
	let expectedSold = 0; let declaredSold = 0; let expectedCashCents = 0; let depositedCashCents = 0;
	for (const item of items) { const actual = confirmed.find((entry: any) => entry.item.productId === item.item.productId); const expected = item.item.quantity - (actual?.item.returned ?? 0) - (actual?.item.damaged ?? 0); expectedSold += expected; expectedCashCents += expected * cents(item.item.unitPrice); const declaredItem = declared.find((entry: any) => entry.item.productId === item.item.productId); declaredSold += declaredItem?.item.sold ?? 0; }
	for (const deposit of depositRows) depositedCashCents += cents(deposit.amount);
	return { row, items, report, declared, deposits: depositRows, confirmation, confirmed, verification, reconciliation: { expected_sold: expectedSold, declared_sold: declaredSold, racks_variance: declaredSold - expectedSold, expected_cash: money(expectedCashCents), deposited_cash: money(depositedCashCents), cash_variance: money(depositedCashCents - expectedCashCents), returns_confirmed: Boolean(confirmation) } };
}
export async function getIssue(actor: Actor, issueId: string) { const data = await aggregate(db, issueId); if (!canSeeIssue(actor, data.row.issue)) bad("Forbidden", 403, ErrorCode.FORBIDDEN); return { ...data.row, items: data.items, report: data.report ? { ...data.report, items: data.declared, deposits: data.deposits } : null, return_confirmation: data.confirmation ? { ...data.confirmation, items: data.confirmed } : null, verification: data.verification, reconciliation: data.reconciliation }; }

export async function submitReport(actor: Actor, issueId: string, input: { items: ItemInput[]; deposits: { amount: string; bank_name: string; reference_no: string; slip_file_key: string; deposited_at?: string }[] }, fileExists: (key: string) => Promise<boolean>) {
	const existingIssue = (await db.select().from(issues).where(eq(issues.id, issueId)).limit(1))[0];
	if (!existingIssue) bad("Issue not found", 404);
	if (!canSeeIssue(actor, existingIssue)) bad("Forbidden", 403, ErrorCode.FORBIDDEN);
	if (!input.items.length || !input.deposits.length) bad("Report items and at least one deposit are required"); uniqueItems(input.items); input.items.forEach((item) => { nonNegative(item.sold ?? -1, "sold"); nonNegative(item.returned ?? -1, "returned"); nonNegative(item.damaged ?? -1, "damaged"); });
	for (const deposit of input.deposits) { if (!await fileExists(deposit.slip_file_key)) bad("Bank slip file was not found", 400); cents(deposit.amount); }
	return db.transaction(async (tx) => {
		const data = await aggregate(tx, issueId); if (!canSeeIssue(actor, data.row.issue)) bad("Forbidden", 403, ErrorCode.FORBIDDEN); if (data.row.issue.status !== "open") bad("Issue is not open for reporting", 409); if (data.report) bad("Issue already has a report", 409);
		if (input.items.length !== data.items.length) bad("Every issued product must be included");
		const report = (await tx.insert(salesReports).values({ issueId, salesUserId: actor.id, status: "submitted" }).returning())[0]; if (!report) throw new Error("Report creation failed");
		const rows = input.items.map((item) => { const issued = data.items.find((entry: any) => entry.item.productId === item.product_id); if (!issued) bad("Report contains a product not issued"); if ((item.sold ?? 0) + (item.returned ?? 0) + (item.damaged ?? 0) !== issued.item.quantity) bad(`Declared quantities do not match issued quantity for ${issued.product.sku}`); return { reportId: report.id, productId: item.product_id, sold: item.sold ?? 0, returned: item.returned ?? 0, damaged: item.damaged ?? 0 }; });
		await tx.insert(reportItems).values(rows); for (const deposit of input.deposits) await tx.insert(deposits).values({ reportId: report.id, amount: deposit.amount, bankName: deposit.bank_name, referenceNo: deposit.reference_no, slipFileKey: deposit.slip_file_key, depositedAt: deposit.deposited_at ? new Date(deposit.deposited_at) : new Date() });
		await tx.update(issues).set({ status: "reported" }).where(eq(issues.id, issueId)); await event(tx, issueId, actor.id, "report_submitted", { reportId: report.id, items: rows }); for (const deposit of input.deposits) await event(tx, issueId, actor.id, "deposit_added", { amount: deposit.amount, bankName: deposit.bank_name, referenceNo: deposit.reference_no }); await writeAudit(tx, { actorUserId: actor.id, action: "UPDATE", entityType: "issue", entityId: issueId, newValues: { status: "reported", reportId: report.id } }); return report;
	});
}
export async function addDeposit(actor: Actor, reportId: string, input: { amount: string; bank_name: string; reference_no: string; slip_file_key: string; deposited_at?: string }, fileExists: (key: string) => Promise<boolean>) {
	const existingReport = (await reportsRepository.findById(reportId))[0]; if (!existingReport) bad("Report not found", 404);
	const existingIssue = (await db.select().from(issues).where(eq(issues.id, existingReport.issueId)).limit(1))[0]; if (!existingIssue || !canSeeIssue(actor, existingIssue)) bad("Forbidden", 403, ErrorCode.FORBIDDEN);
	cents(input.amount); if (!await fileExists(input.slip_file_key)) bad("Bank slip file was not found");
	return db.transaction(async (tx) => { const report = (await tx.select().from(salesReports).where(eq(salesReports.id, reportId)).limit(1))[0]; if (!report) bad("Report not found", 404); const issue = (await tx.select().from(issues).where(eq(issues.id, report.issueId)).limit(1))[0]; if (!issue || !canSeeIssue(actor, issue)) bad("Forbidden", 403, ErrorCode.FORBIDDEN); if (issue.status !== "reported") bad("Deposits can only be added while the issue is reported", 409); const deposit = (await tx.insert(deposits).values({ reportId, amount: input.amount, bankName: input.bank_name, referenceNo: input.reference_no, slipFileKey: input.slip_file_key, depositedAt: input.deposited_at ? new Date(input.deposited_at) : new Date() }).returning())[0]; await event(tx, issue.id, actor.id, "deposit_added", { amount: input.amount, bankName: input.bank_name, referenceNo: input.reference_no }); await writeAudit(tx, { actorUserId: actor.id, action: "CREATE", entityType: "deposit", entityId: deposit?.id, newValues: deposit }); return deposit; });
}
export async function listReports(actor: Actor) { const rows = await db.select({ report: salesReports, issue: issues }).from(salesReports).innerJoin(issues, eq(issues.id, salesReports.issueId)).orderBy(desc(salesReports.submittedAt)); return actor.role === "sales" ? rows.filter((row: any) => row.report.salesUserId === actor.id) : rows; }
export async function listReportDeposits(actor: Actor, reportId: string) { const report = (await reportsRepository.findById(reportId))[0]; if (!report) bad("Report not found", 404); const issue = (await db.select().from(issues).where(eq(issues.id, report.issueId)).limit(1))[0]; if (!issue || !canSeeIssue(actor, issue)) bad("Forbidden", 403, ErrorCode.FORBIDDEN); return reportsRepository.listDeposits(reportId); }

export async function confirmReturns(actor: Actor, issueId: string, input: { items: ItemInput[]; note?: string }) {
	if (!input.items.length) bad("Return confirmation items are required"); uniqueItems(input.items); input.items.forEach((item) => { nonNegative(item.returned ?? -1, "returned"); nonNegative(item.damaged ?? -1, "damaged"); });
	return db.transaction(async (tx) => { const data = await aggregate(tx, issueId); if (data.row.issue.status !== "reported") bad("Returns can only be confirmed for a reported issue", 409); if (data.confirmation) bad("Returns are already confirmed", 409); const byProduct = new Map(input.items.map((item) => [item.product_id, item])); const rows = data.items.map((entry: any) => { const item = byProduct.get(entry.item.productId); const returned = item?.returned ?? 0; const damaged = item?.damaged ?? 0; if (returned + damaged > entry.item.quantity) bad(`Returns exceed issued quantity for ${entry.product.sku}`); return { productId: entry.item.productId, returned, damaged }; }); const confirmation = (await tx.insert(returnConfirmations).values({ issueId, confirmedBy: actor.id, note: input.note?.trim() || null }).returning())[0]; if (!confirmation) throw new Error("Return confirmation failed"); await tx.insert(returnConfirmationItems).values(rows.map((row: any) => ({ confirmationId: confirmation.id, ...row }))); for (const row of rows) { await tx.insert(stockMovements).values({ productId: row.productId, type: "return", warehouseDelta: row.returned, holderDelta: -row.returned, holderUserId: data.row.issue.salesUserId, issueId, createdBy: actor.id }); if (row.damaged) await tx.insert(stockMovements).values({ productId: row.productId, type: "damage", warehouseDelta: 0, holderDelta: -row.damaged, holderUserId: data.row.issue.salesUserId, issueId, createdBy: actor.id }); } await tx.update(issues).set({ status: "returns_confirmed" }).where(eq(issues.id, issueId)); await event(tx, issueId, actor.id, "returns_confirmed", { confirmationId: confirmation.id, items: rows }); await writeAudit(tx, { actorUserId: actor.id, action: "UPDATE", entityType: "issue", entityId: issueId, newValues: { status: "returns_confirmed", confirmationId: confirmation.id } }); return confirmation; });
}

export async function verifyReport(actor: Actor, reportId: string, input: { decision: "approved" | "flagged"; note?: string }) {
	if (input.decision === "flagged" && !input.note?.trim()) bad("A note is required when flagging a report");
	return db.transaction(async (tx) => { const report = (await tx.select().from(salesReports).where(eq(salesReports.id, reportId)).limit(1))[0]; if (!report) bad("Report not found", 404); const data = await aggregate(tx, report.issueId); if (!data.confirmation && input.decision === "approved") bad("Approval requires confirmed returns", 409); if (["verified", "flagged"].includes(data.row.issue.status)) bad("Report has already been decided", 409); const rec = data.reconciliation; if (input.decision === "approved" && (rec.racks_variance !== 0 || rec.cash_variance !== "0.00")) bad(`Approval requires zero variances: racks=${rec.racks_variance}, cash=${rec.cash_variance}`, 409); const verification = (await tx.insert(inventoryVerifications).values({ reportId, accountantId: actor.id, decision: input.decision, expectedCash: rec.expected_cash, depositedCash: rec.deposited_cash, cashVariance: rec.cash_variance, racksVariance: rec.racks_variance, note: input.note?.trim() || null }).returning())[0]; if (input.decision === "approved") { for (const item of data.items) { const actual = data.confirmed.find((entry: any) => entry.item.productId === item.item.productId); const expected = item.item.quantity - (actual?.item.returned ?? 0) - (actual?.item.damaged ?? 0); if (expected) await tx.insert(stockMovements).values({ productId: item.item.productId, type: "adjustment", warehouseDelta: 0, holderDelta: -expected, holderUserId: data.row.issue.salesUserId, issueId: data.row.issue.id, note: "Closing sold racks after verification", createdBy: actor.id }); } await tx.update(issues).set({ status: "verified", closedAt: new Date() }).where(eq(issues.id, data.row.issue.id)); await tx.update(salesReports).set({ status: "verified" }).where(eq(salesReports.id, reportId)); } else { await tx.update(issues).set({ status: "flagged" }).where(eq(issues.id, data.row.issue.id)); await tx.update(salesReports).set({ status: "flagged" }).where(eq(salesReports.id, reportId)); } await event(tx, data.row.issue.id, actor.id, input.decision === "approved" ? "verified" : "flagged", { reportId, reconciliation: rec, note: input.note }); await writeAudit(tx, { actorUserId: actor.id, action: "UPDATE", entityType: "report", entityId: reportId, newValues: { decision: input.decision, reconciliation: rec } }); return verification; });
}
export async function reconciliationFor(reportId: string) { const report = (await reportsRepository.findById(reportId))[0]; if (!report) bad("Report not found", 404); return (await aggregate(db, report.issueId)).reconciliation; }
