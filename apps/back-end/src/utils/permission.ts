import type { Context } from "hono";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import type { RoleName } from "@/db/schema";

export const permissions = {
	manageUsers: "users.manage",
	manageProducts: "products.manage",
	viewProducts: "products.read",
	receiveStock: "stock.receive",
	adjustStock: "stock.adjust",
	viewStock: "stock.read",
	createIssue: "issues.create",
	viewOwnIssues: "issues.read.own",
	viewAllIssues: "issues.read.all",
	submitReport: "reports.submit",
	confirmReturns: "returns.confirm",
	verifyReport: "reports.verify",
	viewReports: "reports.read",
	postComments: "threads.comment",
	viewAudit: "audit.read",
	viewOwnStock: "stock.read.own",
	createOwnReport: "reports.create.own",
	manageAssignments: "assignments.manage",
	viewFinance: "finance.read",
	decidePayments: "payments.decide",
} as const;

export type Permission = (typeof permissions)[keyof typeof permissions];
export const permissionMap: Record<RoleName, readonly Permission[]> = {
	admin: Object.values(permissions),
	storekeeper: [permissions.viewProducts, permissions.receiveStock, permissions.adjustStock, permissions.viewStock, permissions.createIssue, permissions.viewAllIssues, permissions.confirmReturns, permissions.manageAssignments, permissions.viewReports, permissions.postComments],
	sales: [permissions.viewProducts, permissions.viewOwnIssues, permissions.viewOwnStock, permissions.createOwnReport, permissions.submitReport, permissions.viewReports, permissions.postComments],
	accountant: [permissions.viewProducts, permissions.viewStock, permissions.viewAllIssues, permissions.verifyReport, permissions.viewFinance, permissions.decidePayments, permissions.viewReports, permissions.postComments],
	warehouse_manager: [permissions.viewProducts, permissions.receiveStock, permissions.adjustStock, permissions.viewStock, permissions.createIssue, permissions.viewAllIssues, permissions.confirmReturns, permissions.manageAssignments, permissions.viewReports, permissions.postComments],
	finance: [permissions.viewProducts, permissions.viewStock, permissions.viewAllIssues, permissions.verifyReport, permissions.viewFinance, permissions.decidePayments, permissions.viewReports, permissions.postComments],
};

export function rolePermissions(role: string | null | undefined): readonly Permission[] {
	return permissionMap[(role ?? "") as RoleName] ?? [];
}

export function assertPermission(c: Context, permission: Permission): void {
	const role = c.get("user")?.role;
	if (!rolePermissions(role).includes(permission)) {
		throw new AppError(`Forbidden: missing required permission '${permission}'`, 403, ErrorCode.FORBIDDEN);
	}
}
