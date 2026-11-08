import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { users } from "@/db/schema";
import { writeAudit } from "@/repositories/audit.repository";
import type { RoleName } from "@/db/schema";

const roles = new Set<RoleName>(["admin", "storekeeper", "sales", "accountant", "warehouse_manager", "finance"]);
function validateRole(role: string): asserts role is RoleName { if (!roles.has(role as RoleName)) throw new AppError("Invalid role", 400, ErrorCode.VALIDATION_ERROR); }
export async function listUsers() { return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, banned: users.banned, createdAt: users.createdAt }).from(users).orderBy(asc(users.name)); }
export async function listSalesUsers() { return db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(and(eq(users.role, "sales"), eq(users.banned, false))).orderBy(asc(users.name)); }
export async function createUser(actorId: string, input: { name: string; email: string; password: string; role: string }) { validateRole(input.role); const result = await auth.api.signUpEmail({ body: { name: input.name, email: input.email, password: input.password } }); if (!result.user) throw new AppError("Unable to create user", 500, ErrorCode.INTERNAL_SERVER_ERROR); const [user] = await db.update(users).set({ role: input.role }).where(eq(users.id, result.user.id)).returning(); await db.transaction(async (tx) => { await writeAudit(tx, { actorUserId: actorId, action: "CREATE", entityType: "user", entityId: user?.id, newValues: { email: input.email, role: input.role } }); }); return user;
}
export async function setRole(actorId: string, id: string, role: string) { validateRole(role); const [user] = await db.update(users).set({ role }).where(eq(users.id, id)).returning(); if (!user) throw new AppError("User not found", 404, ErrorCode.NOT_FOUND); await db.transaction(async (tx) => { await writeAudit(tx, { actorUserId: actorId, action: "UPDATE", entityType: "user", entityId: id, newValues: { role } }); }); return user; }
export async function setActive(actorId: string, id: string, active: boolean) { const [user] = await db.update(users).set({ banned: !active }).where(eq(users.id, id)).returning(); if (!user) throw new AppError("User not found", 404, ErrorCode.NOT_FOUND); await db.transaction(async (tx) => { await writeAudit(tx, { actorUserId: actorId, action: "UPDATE", entityType: "user", entityId: id, newValues: { active } }); }); return user; }
export async function resetPassword(actorId: string, id: string, password: string, headers: Headers) { const result = await (auth.api as any).setUserPassword({ headers, body: { userId: id, newPassword: password } }); if (!result) throw new AppError("Unable to reset password", 500, ErrorCode.INTERNAL_SERVER_ERROR); await db.transaction(async (tx) => { await writeAudit(tx, { actorUserId: actorId, action: "UPDATE", entityType: "user", entityId: id, newValues: { passwordReset: true } }); }); return { ok: true }; }
