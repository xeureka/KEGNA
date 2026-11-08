import {
	pgTable,
	text,
	timestamp,
	uuid,
	pgEnum,
	index,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const membershipRoleEnum = pgEnum("membership_role", [
	"PATIENT",
	"DOCTOR",
	"OWNER",
	"RECEPTIONIST",
	"ACCOUNTANT",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
	"active",
	"inactive",
	"revoked",
]);

export const tenants = pgTable("tenants", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	deletedAt: timestamp("deleted_at"),
});

export const tenatMemberships = pgTable(
	"tenant_memberships",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		tenantId: uuid("tenant_id")
			.notNull()
			.references(() => tenants.id),
		userId: text("user_id")
			.notNull()
			.references(() => user.id),
		role: membershipRoleEnum("role").notNull(),
		status: membershipStatusEnum("status").notNull().default("active"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => ({
		//tenat_id leading, per ADR -- keps tenat-tscope  at fast at scale
		tenantUserIdx: index("tenant_memberships_tenant_user_idx").on(
			table.tenantId,
			table.userId,
		),
	}),
);

// NOTE: SUPER_ADMIN is deliberately not in membershipRoleEnum - per the ADR , super admin is not tenant-scope so its the isSuperAdmin flag on the user instead,
//check it ints own middleware, not folded into the meerhsip/role check
