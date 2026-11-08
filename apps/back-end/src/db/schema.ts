import { boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const issueStatus = pgEnum("issue_status", ["open", "reported", "returns_confirmed", "verified", "flagged"]);
export const stockMovementType = pgEnum("stock_movement_type", ["receive", "issue", "return", "damage", "adjustment"]);
export const reportStatus = pgEnum("report_status", ["submitted", "verified", "flagged"]);
export const verificationDecision = pgEnum("verification_decision", ["approved", "flagged"]);
export const threadEventType = pgEnum("thread_event_type", ["issued", "report_submitted", "deposit_added", "returns_confirmed", "verified", "flagged", "comment"]);
export const auditAction = pgEnum("audit_action", ["CREATE", "UPDATE", "DELETE", "RESTORE", "LOGIN", "LOGOUT", "VIEW"]);

// Better Auth tables. These names and fields match the active adapter config.
export const users = pgTable("users", {
	id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(), image: text("image"),
	role: text("role").default("sales").notNull(), banned: boolean("banned").default(false).notNull(),
	banReason: text("ban_reason"), banExpires: timestamp("ban_expires"),
	createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const accounts = pgTable("accounts", {
	id: text("id").primaryKey(), accountId: text("account_id").notNull(), providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), accessToken: text("access_token"),
	refreshToken: text("refresh_token"), idToken: text("id_token"), accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"), scope: text("scope"), password: text("password"), issuer: text("issuer"),
	createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("accounts_user_id_idx").on(table.userId)]);
export const sessions = pgTable("sessions", {
	id: text("id").primaryKey(), expiresAt: timestamp("expires_at").notNull(), token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
	ipAddress: text("ip_address"), userAgent: text("user_agent"), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [index("sessions_user_id_idx").on(table.userId)]);
export const verifications = pgTable("verifications", {
	id: text("id").primaryKey(), identifier: text("identifier").notNull(), value: text("value").notNull(), expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(), updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("verifications_identifier_idx").on(table.identifier)]);

export const products = pgTable("products", {
	id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), sku: text("sku").notNull().unique(), bottlesPerRack: integer("bottles_per_rack").notNull(),
	pricePerRack: numeric("price_per_rack", { precision: 12, scale: 2 }).notNull(), isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const issues = pgTable("issues", {
	id: uuid("id").defaultRandom().primaryKey(), issueNo: text("issue_no").notNull().unique(), salesUserId: text("sales_user_id").notNull().references(() => users.id), issuedBy: text("issued_by").notNull().references(() => users.id),
	status: issueStatus("status").default("open").notNull(), note: text("note"), issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(), closedAt: timestamp("closed_at", { withTimezone: true }),
}, (table) => [index("issues_sales_user_status_idx").on(table.salesUserId, table.status)]);
export const issueItems = pgTable("issue_items", {
	id: uuid("id").defaultRandom().primaryKey(), issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }), productId: uuid("product_id").notNull().references(() => products.id), quantity: integer("quantity").notNull(), unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
}, (table) => [unique("issue_items_issue_product_unique").on(table.issueId, table.productId)]);
export const stockMovements = pgTable("stock_movements", {
	id: uuid("id").defaultRandom().primaryKey(), productId: uuid("product_id").notNull().references(() => products.id), type: stockMovementType("type").notNull(), warehouseDelta: integer("warehouse_delta").notNull(), holderDelta: integer("holder_delta").default(0).notNull(), holderUserId: text("holder_user_id").references(() => users.id), issueId: uuid("issue_id").references(() => issues.id), batchNo: text("batch_no"), expiryDate: date("expiry_date"), reference: text("reference"), note: text("note"), createdBy: text("created_by").notNull().references(() => users.id), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("stock_movements_product_id_idx").on(table.productId), index("stock_movements_holder_user_id_idx").on(table.holderUserId)]);
export const salesReports = pgTable("sales_reports", {
	id: uuid("id").defaultRandom().primaryKey(), issueId: uuid("issue_id").notNull().unique().references(() => issues.id), salesUserId: text("sales_user_id").notNull().references(() => users.id), status: reportStatus("status").default("submitted").notNull(), note: text("note"), submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
});
export const reportItems = pgTable("report_items", {
	id: uuid("id").defaultRandom().primaryKey(), reportId: uuid("report_id").notNull().references(() => salesReports.id, { onDelete: "cascade" }), productId: uuid("product_id").notNull().references(() => products.id), sold: integer("sold").notNull(), returned: integer("returned").notNull(), damaged: integer("damaged").notNull(),
});
export const deposits = pgTable("deposits", {
	id: uuid("id").defaultRandom().primaryKey(), reportId: uuid("report_id").notNull().references(() => salesReports.id, { onDelete: "cascade" }), amount: numeric("amount", { precision: 12, scale: 2 }).notNull(), bankName: text("bank_name").notNull(), referenceNo: text("reference_no").notNull(), slipFileKey: text("slip_file_key").notNull(), depositedAt: timestamp("deposited_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("deposits_report_id_idx").on(table.reportId)]);
export const returnConfirmations = pgTable("return_confirmations", {
	id: uuid("id").defaultRandom().primaryKey(), issueId: uuid("issue_id").notNull().unique().references(() => issues.id), confirmedBy: text("confirmed_by").notNull().references(() => users.id), confirmedAt: timestamp("confirmed_at", { withTimezone: true }).defaultNow().notNull(), note: text("note"),
});
export const returnConfirmationItems = pgTable("return_confirmation_items", {
	id: uuid("id").defaultRandom().primaryKey(), confirmationId: uuid("confirmation_id").notNull().references(() => returnConfirmations.id, { onDelete: "cascade" }), productId: uuid("product_id").notNull().references(() => products.id), returned: integer("returned").notNull(), damaged: integer("damaged").notNull(),
});
// Inventory verification is prefixed to avoid colliding with Better Auth's `verifications` table.
export const inventoryVerifications = pgTable("inventory_verifications", {
	id: uuid("id").defaultRandom().primaryKey(), reportId: uuid("report_id").notNull().unique().references(() => salesReports.id), accountantId: text("accountant_id").notNull().references(() => users.id), decision: verificationDecision("decision").notNull(), expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }).notNull(), depositedCash: numeric("deposited_cash", { precision: 12, scale: 2 }).notNull(), cashVariance: numeric("cash_variance", { precision: 12, scale: 2 }).notNull(), racksVariance: integer("racks_variance").notNull(), note: text("note"), decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
});
export const threadEvents = pgTable("thread_events", {
	id: uuid("id").defaultRandom().primaryKey(), issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }), actorId: text("actor_id").references(() => users.id), type: threadEventType("type").notNull(), payload: jsonb("payload").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("thread_events_issue_created_at_idx").on(table.issueId, table.createdAt)]);
export const threadReads = pgTable("thread_reads", {
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "cascade" }), lastReadAt: timestamp("last_read_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.userId, table.issueId] })]);
export const auditLogs = pgTable("audit_logs", {
	id: uuid("id").defaultRandom().primaryKey(), actorUserId: text("actor_user_id").references(() => users.id), action: auditAction("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), oldValues: jsonb("old_values"), newValues: jsonb("new_values"), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type RoleName = "admin" | "storekeeper" | "sales" | "accountant";
