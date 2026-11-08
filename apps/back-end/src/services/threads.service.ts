import { eq } from "drizzle-orm";
import { db } from "@/db";
import { issues } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { threadsRepository } from "@/repositories/threads.repository";
import { writeAudit } from "@/repositories/audit.repository";
import { event } from "@/utils/thread-event";

export async function listThreads(actor: { id: string; role?: string | null }, filter?: string) { const rows = await threadsRepository.list(actor.id, actor.role !== "sales", filter === "pending" ? undefined : filter); return filter === "pending" ? rows.filter((row: any) => ["reported", "returns_confirmed"].includes(row.issue.status)) : rows; }
export async function listEvents(actor: { id: string; role?: string | null }, issueId: string, before?: Date, limit = 50) { const issue = (await db.select().from(issues).where(eq(issues.id, issueId)).limit(1))[0]; if (!issue || (actor.role === "sales" && issue.salesUserId !== actor.id)) throw new AppError("Forbidden", 403, ErrorCode.FORBIDDEN); return threadsRepository.events(issueId, before, limit); }
export async function addComment(actor: { id: string; role?: string | null }, issueId: string, text: string) { if (!text.trim() || text.length > 2000) throw new AppError("Comment must be between 1 and 2000 characters", 400, ErrorCode.VALIDATION_ERROR); const issue = (await db.select().from(issues).where(eq(issues.id, issueId)).limit(1))[0]; if (!issue || (actor.role === "sales" && issue.salesUserId !== actor.id)) throw new AppError("Forbidden", 403, ErrorCode.FORBIDDEN); return db.transaction(async (tx) => { const result = await event(tx, issueId, actor.id, "comment", { text: text.trim() }); await writeAudit(tx, { actorUserId: actor.id, action: "CREATE", entityType: "thread_event", entityId: result?.id, newValues: { type: "comment" } }); return result; }); }
export async function markRead(actor: { id: string }, issueId: string) { const issue = (await db.select().from(issues).where(eq(issues.id, issueId)).limit(1))[0]; if (!issue || (actor as any).role === "sales" && issue.salesUserId !== actor.id) throw new AppError("Forbidden", 403, ErrorCode.FORBIDDEN); return threadsRepository.upsertRead(actor.id, issueId, new Date()); }
