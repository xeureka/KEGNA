export type RoleName = "admin" | "storekeeper" | "sales" | "accountant" | "warehouse_manager" | "finance";

export function normalizeRole(role: RoleName): RoleName {
	return role === "warehouse_manager" ? "storekeeper" : role === "finance" ? "accountant" : role;
}

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: RoleName;
}

export interface SessionData {
	user: SessionUser;
	sessionToken: string;
	permissions: string[];
}

export type IssueStatus =
	| "open"
	| "reported"
	| "returns_confirmed"
	| "verified"
	| "flagged";

export type ReportStatus = "submitted" | "verified" | "flagged";
export type VerificationDecision = "approved" | "flagged";

export interface Product {
	id: string;
	name: string;
	sku: string;
	bottlesPerRack: number;
	pricePerRack: string;
	isActive: boolean;
}

export interface Issue {
	id: string;
	issueNo: string;
	salesUserId: string;
	issuedBy: string;
	status: IssueStatus;
	note: string | null;
	issuedAt: string;
	closedAt: string | null;
}

export interface Salesperson {
	id: string;
	name: string;
	email?: string;
}

export interface IssueItem {
	id: string;
	issueId: string;
	productId: string;
	quantity: number;
	unitPrice: string;
}

export interface IssueItemWithProduct {
	item: IssueItem;
	product: Product;
}

export interface ReportItem {
	id: string;
	reportId: string;
	productId: string;
	sold: number;
	returned: number;
	damaged: number;
}

export interface ReportItemWithProduct {
	item: ReportItem;
	product: Product;
}

export interface Deposit {
	id: string;
	reportId: string;
	amount: string;
	bankName: string;
	referenceNo: string;
	slipFileKey: string | null;
	depositedAt: string;
}

export interface SalesReport {
	id: string;
	issueId: string;
	salesUserId: string;
	status: ReportStatus;
	note: string | null;
	submittedAt: string;
}

export interface ReportWithItems extends SalesReport {
	items: ReportItemWithProduct[];
	deposits: Deposit[];
}

export interface ReturnConfirmation {
	id: string;
	issueId: string;
	confirmedBy: string;
	confirmedAt: string;
	note: string | null;
}

export interface ReturnConfirmationItem {
	id: string;
	confirmationId: string;
	productId: string;
	returned: number;
	damaged: number;
}

export interface ReturnConfirmationItemWithProduct {
	item: ReturnConfirmationItem;
	product: Product;
}

export interface ReturnConfirmationWithItems extends ReturnConfirmation {
	items: ReturnConfirmationItemWithProduct[];
}

export interface Verification {
	id: string;
	reportId: string;
	accountantId: string;
	decision: VerificationDecision;
	expectedCash: string;
	depositedCash: string;
	cashVariance: string;
	racksVariance: number;
	note: string | null;
	decidedAt: string;
}

export interface Reconciliation {
	expected_sold: number;
	declared_sold: number;
	racks_variance: number;
	expected_cash: string;
	deposited_cash: string;
	cash_variance: string;
	returns_confirmed: boolean;
}

export interface IssueDetail {
	issue: Issue;
	salesperson: Salesperson;
	items: IssueItemWithProduct[];
	report: ReportWithItems | null;
	return_confirmation: ReturnConfirmationWithItems | null;
	verification: Verification | null;
	reconciliation: Reconciliation;
}

export type ThreadEventType =
	| "issued"
	| "report_submitted"
	| "deposit_added"
	| "returns_confirmed"
	| "verified"
	| "flagged"
	| "comment";

export type EventPayload = Record<string, unknown>;

export interface ThreadEvent {
	id: string;
	issueId: string;
	actorId: string | null;
	actorName?: string | null;
	type: ThreadEventType;
	payload: EventPayload;
	createdAt: string;
}

export interface ThreadRow {
	issue: Issue;
	salesperson: Salesperson;
	lastEvent: {
		type: ThreadEventType;
		payload: EventPayload;
		createdAt: string;
	} | null;
	lastEventAt: string | null;
	unreadCount: number | string;
}

export interface UploadedFile {
	key: string;
	contentType: string;
	size: number;
}

export interface PersonalStock {
	items: { beverage: Product; assigned: number; sold: number; left: number; price: string; left_value: string }[];
	totals: { racks_left: number; est_value: string; sold_value: string };
}

export interface BeverageReport {
	report: { id: string; status: "pending" | "successful" | "declined"; amount: string; bankReference: string; receiptFileKey: string | null; declineReason: string | null; submittedAt: string };
	assignment: Issue;
	sales: Salesperson;
	lines: { beverage: Product; racksSold: number; unitPrice: string }[];
	receipt: { key: string; reference: string } | null;
}

export interface FinancePayment extends BeverageReport {}

export interface SalesSummary {
	pending: number;
	flagged: number;
	verifiedToday: number;
	soldRacks: number;
	openIssues: number;
	expectedCash: string;
	depositedCash: string;
	cashVariance: string;
	holdings: { productId: string; name: string; racks: number }[];
}

export interface AccountantSummary {
	pending: number;
	flagged: number;
	verifiedToday: number;
	soldRacks: number;
	expectedCash: string;
	depositedCash: string;
	cashVariance: string;
	salespersonTotals: { userId: string; name: string; sold: number; expected: string; deposited: string; variance: string }[];
}

export interface ReportListRow {
	report: SalesReport;
	issue: Issue;
	salesperson: Salesperson;
	reconciliation: Reconciliation;
}

export interface ReportItemInput {
	product_id: string;
	sold: number;
	returned: number;
	damaged: number;
}

export interface DepositInput {
	amount: string;
	bank_name: string;
	reference_no: string;
	slip_file_key?: string;
	deposited_at?: string;
}

export interface SubmitReportInput {
	items: ReportItemInput[];
	deposits: DepositInput[];
}
