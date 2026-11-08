import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const allowed = new Map([["image/jpeg", ".jpg"], ["image/png", ".png"], ["image/webp", ".webp"]]);
function safeKey(key: string) { if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key) || basename(key) !== key) throw new AppError("Invalid file key", 400, ErrorCode.VALIDATION_ERROR); return key; }
export async function saveImage(file: File) { const extension = allowed.get(file.type); if (!extension) throw new AppError("Only JPEG, PNG, and WebP images are allowed", 400, ErrorCode.VALIDATION_ERROR); if (file.size > MAX_FILE_BYTES) throw new AppError("Image exceeds the 5 MB limit", 400, ErrorCode.VALIDATION_ERROR); const key = `${randomUUID()}${extension}`; await mkdir(env.STORAGE_DIR, { recursive: true }); await writeFile(join(env.STORAGE_DIR, key), Buffer.from(await file.arrayBuffer()), { flag: "wx" }); return { key, contentType: file.type, size: file.size }; }
export async function readImage(key: string) { const safe = safeKey(key); try { const data = await readFile(join(env.STORAGE_DIR, safe)); const contentType = safe.endsWith(".jpg") ? "image/jpeg" : safe.endsWith(".png") ? "image/png" : "image/webp"; return { data, contentType }; } catch { throw new AppError("File not found", 404, ErrorCode.NOT_FOUND); } }
export async function fileExists(key: string) { try { await stat(join(env.STORAGE_DIR, safeKey(key))); return true; } catch { return false; } }
