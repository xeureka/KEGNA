import { eq } from "drizzle-orm";
import { db } from "@/db";
import { deposits, issues, salesReports } from "@/db/schema";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { readImage, saveImage } from "@/services/storage.service";
export async function uploadImage(file: File) { return saveImage(file); }
export async function readIssueFile(actor: { id: string; role?: string | null }, key: string) { const row = (await db.select({ salesUserId: issues.salesUserId }).from(deposits).innerJoin(salesReports, eq(salesReports.id, deposits.reportId)).innerJoin(issues, eq(issues.id, salesReports.issueId)).where(eq(deposits.slipFileKey, key)).limit(1))[0]; if (!row || (actor.role === "sales" && actor.id !== row.salesUserId)) throw new AppError("Forbidden", 403, ErrorCode.FORBIDDEN); return readImage(key); }
