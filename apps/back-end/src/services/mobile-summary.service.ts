import { readMobileSummaryRows } from "@/repositories/mobile-summary.repository";

type Actor = { id: string; role?: string | null };
function cents(value: string | number | null | undefined) {
	const [whole, fraction = ""] = String(value ?? "0").split(".");
	return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}
function money(value: number) { return `${value < 0 ? "-" : ""}${Math.floor(Math.abs(value) / 100)}.${String(Math.abs(value) % 100).padStart(2, "0")}`; }

export async function mobileSummary(actor: Actor, from?: Date, to?: Date) {
	const rows = await readMobileSummaryRows(actor.id, actor.role ?? "", from, to);
	const issues = rows.issueRows.filter((row) => actor.role !== "sales" || row.issue.salesUserId === actor.id);
	const pending = issues.filter((row) => ["reported", "returns_confirmed"].includes(row.issue.status)).length;
	const flagged = issues.filter((row) => row.issue.status === "flagged").length;
	const verifiedToday = issues.filter((row) => row.issue.status === "verified" && row.issue.closedAt && new Date(row.issue.closedAt).toDateString() === new Date().toDateString()).length;
	const heldByProduct = new Map<string, { productId: string; name: string; racks: number }>();
	for (const row of rows.movementRows) {
		if (row.movement.holderUserId !== actor.id && actor.role === "sales") continue;
		const current = heldByProduct.get(row.movement.productId) ?? { productId: row.movement.productId, name: row.product.name, racks: 0 };
		current.racks += row.movement.holderDelta;
		heldByProduct.set(row.movement.productId, current);
	}
	let sold = 0; let expected = 0; let deposited = 0;
	const salespersonTotals = new Map<string, { userId: string; name: string; sold: number; expected: number; deposited: number }>();
	for (const row of rows.itemRows) {
		if (!row.reportItem) continue;
		const report = rows.issueRows.find((issue) => issue.issue.id === row.item.issueId)?.report;
		if (!report) continue;
		const lineExpected = row.reportItem.sold * cents(row.item.unitPrice);
		sold += row.reportItem.sold; expected += lineExpected;
		const issue = rows.issueRows.find((entry) => entry.issue.id === row.item.issueId);
		if (issue) {
			const total = salespersonTotals.get(issue.issue.salesUserId) ?? { userId: issue.issue.salesUserId, name: issue.salesperson.name, sold: 0, expected: 0, deposited: 0 };
			total.sold += row.reportItem.sold; total.expected += lineExpected; salespersonTotals.set(issue.issue.salesUserId, total);
		}
	}
	for (const row of rows.depositRows) {
		if (issues.some((issue) => issue.report?.id === row.report.id)) deposited += cents(row.deposit.amount);
		const issue = rows.issueRows.find((entry) => entry.report?.id === row.report.id);
		if (issue) { const total = salespersonTotals.get(issue.issue.salesUserId); if (total) total.deposited += cents(row.deposit.amount); }
	}
	const base = { pending, flagged, verifiedToday, soldRacks: sold, expectedCash: money(expected), depositedCash: money(deposited), cashVariance: money(deposited - expected) };
	if (actor.role === "sales") return { ...base, openIssues: issues.filter((row) => row.issue.status === "open").length, holdings: [...heldByProduct.values()] };
	return { ...base, salespersonTotals: [...salespersonTotals.values()].map((row) => ({ ...row, expected: money(row.expected), deposited: money(row.deposited), variance: money(row.deposited - row.expected) })) };
}
