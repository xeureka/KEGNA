import { and, desc, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { issues, threadEvents, threadReads, users } from "@/db/schema";
export class ThreadsRepository {
	createEvent(tx: any, input: typeof threadEvents.$inferInsert) { return tx.insert(threadEvents).values(input).returning(); }
	async list(userId: string, canSeeAll: boolean, status?: string) {
		const conditions = [canSeeAll ? undefined : eq(issues.salesUserId, userId), status ? eq(issues.status, status as never) : undefined].filter(Boolean) as any[];
		return db.select({ issue: issues, salesperson: { id: users.id, name: users.name }, lastEvent: sql<any>`(select json_build_object('type', te.type, 'payload', te.payload, 'createdAt', te.created_at) from thread_events te where te.issue_id = ${issues.id} order by te.created_at desc limit 1)`, lastEventAt: sql<Date>`(select max(te.created_at) from thread_events te where te.issue_id = ${issues.id})`, unreadCount: sql<number>`(select count(*) from thread_events te left join thread_reads tr on tr.issue_id = te.issue_id and tr.user_id = ${userId} where te.issue_id = ${issues.id} and te.actor_id is distinct from ${userId} and (tr.last_read_at is null or te.created_at > tr.last_read_at))` }).from(issues).innerJoin(users, eq(users.id, issues.salesUserId)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(sql`(select max(te.created_at) from thread_events te where te.issue_id = ${issues.id})`));
	}
	async events(issueId: string, before?: Date, limit = 50) {
		const rows = await db.select({ id: threadEvents.id, issueId: threadEvents.issueId, actorId: threadEvents.actorId, type: threadEvents.type, payload: threadEvents.payload, createdAt: threadEvents.createdAt, actorName: users.name }).from(threadEvents).leftJoin(users, eq(users.id, threadEvents.actorId)).where(and(eq(threadEvents.issueId, issueId), before ? lt(threadEvents.createdAt, before) : undefined)).orderBy(desc(threadEvents.createdAt)).limit(limit);
		return rows.reverse();
	}
	upsertRead(userId: string, issueId: string, lastReadAt: Date) { return db.insert(threadReads).values({ userId, issueId, lastReadAt }).onConflictDoUpdate({ target: [threadReads.userId, threadReads.issueId], set: { lastReadAt } }); }
}
export const threadsRepository = new ThreadsRepository();
