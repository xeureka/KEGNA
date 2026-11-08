export type RoleName = "admin" | "storekeeper" | "sales" | "accountant" | "warehouse_manager" | "finance";

export interface SessionUser {
	id: string;
	name: string;
	email: string;
	role: RoleName;
}

export interface SessionContext {
	user: SessionUser;
	role: RoleName;
	permissions: string[];
	token: string;
}

export interface Product {
	id: string;
	name: string;
	sku: string;
	bottlesPerRack: number;
	pricePerRack: string;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface User {
	id: string;
	name: string;
	email: string;
	role: RoleName;
	banned: boolean;
	createdAt: string;
}

export interface SalesUser {
	id: string;
	name: string;
	email: string;
}

export type IssueStatus =
	| "open"
	| "reported"
	| "returns_confirmed"
	| "verified"
	| "flagged";

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

export interface IssueItem {
	id: string;
	issueId: string;
	productId: string;
	quantity: number;
	unitPrice: string;
}

export interface IssueListRow {
	issue: Issue;
	salesperson: { id: string; name: string; email: string };
}

export interface IssueItemWithProduct {
	item: IssueItem;
	product: Product;
}

export type ReportStatus = "submitted" | "verified" | "flagged";

export interface SalesReport {
	id: string;
	issueId: string;
	salesUserId: string;
	status: ReportStatus;
	note: string | null;
	submittedAt: string;
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
	slipFileKey: string;
	depositedAt: string;
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

export type VerificationDecision = "approved" | "flagged";

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

export interface IssueReport extends SalesReport {
	items: ReportItemWithProduct[];
	deposits: Deposit[];
}

export interface IssueReturnConfirmation extends ReturnConfirmation {
	items: ReturnConfirmationItemWithProduct[];
}

export interface IssueDetail extends Issue {
	salesperson: { id: string; name: string; email: string };
	items: IssueItemWithProduct[];
	report: IssueReport | null;
	return_confirmation: IssueReturnConfirmation | null;
	verification: Verification | null;
	reconciliation: Reconciliation;
}

export type MovementType =
	| "receive"
	| "issue"
	| "return"
	| "damage"
	| "adjustment";

export interface StockMovement {
	id: string;
	productId: string;
	type: MovementType;
	warehouseDelta: number;
	holderDelta: number;
	holderUserId: string | null;
	issueId: string | null;
	batchNo: string | null;
	expiryDate: string | null;
	reference: string | null;
	note: string | null;
	createdBy: string;
	createdAt: string;
}

export interface StockBalance {
	product: Product;
	warehouseBalance: number;
	heldBySalespeople: number;
}

export interface DashboardBalanceRow {
	productId: string;
	warehouse: number;
	held: number;
}

export interface DashboardSummary {
	balances: DashboardBalanceRow[];
	issuesByStatus: Array<{ status: IssueStatus; count: number | string }>;
	flagged: number | string;
	racksWithSalespeople: number | string;
}
