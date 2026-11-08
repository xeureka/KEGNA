import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { AppError } from "@/lib/errors/app-error";
import { ErrorCode } from "@/lib/errors/error-codes";
import { errorResponse } from "@/utils/api-response";
import { env } from "@/lib/env";

export const errorHandler = (error: Error, c: Context) => {
	if (error instanceof AppError) {
		c.var?.logger?.warn(
			{
				err: error,
				code: error.code,
				statusCode: error.statusCode,
			},
			"application error",
		);

		return errorResponse(c, {
			message: error.message,
			status: error.statusCode,
			code: error.code,
			details: error.details,
		});
	}

	if (error instanceof HTTPException) {
		c.var?.logger?.warn(
			{
				err: error,
				statusCode: error.status,
			},
			"HTTP exception",
		);

		return errorResponse(c, {
			message: error.message,
			status: error.status,
			code: ErrorCode.BAD_REQUEST,
		});
	}

	const requestId = c.var?.requestId;
	const databaseError = (error as any)?.cause;
	console.error(
		"Unhandled error in errorHandler:",
		error,
		databaseError?.detail ?? databaseError,
	);
	c.var?.logger?.error(
		{
			err: error,
			dbCode: databaseError?.code,
			dbDetail: databaseError?.detail,
			requestId,
		},
		"unhandled application error",
	);

	// Database failures carry SQL text, bound parameters and internal ids in
	// their message. They are logged above with the request id and never sent
	// to the client, in any environment.
	const isSqlError =
		error.name === "DrizzleQueryError" ||
		databaseError?.code !== undefined ||
		error.message?.includes("Failed query:") ||
		error.message?.includes("params:") ||
		/\bselect\b|\binsert into\b|\bupdate\b|\bdelete from\b/i.test(
			error.message ?? "",
		);

	if (isSqlError) {
		const message = friendlyDatabaseMessage(databaseError?.code);
		return errorResponse(c, {
			message,
			status: 500,
			code: ErrorCode.INTERNAL_SERVER_ERROR,
			details: requestId ? { requestId } : undefined,
		});
	}

	const safeMessage =
		env.NODE_ENV === "development"
			? `Request failed: ${error.message || "Unknown server error"}`
			: "An unexpected error occurred";

	return errorResponse(c, {
		message: safeMessage,
		status: 500,
		code: ErrorCode.INTERNAL_SERVER_ERROR,
		details: requestId ? { requestId } : undefined,
	});
};

/** User-facing copy for Postgres error classes we can recognise. */
function friendlyDatabaseMessage(code: string | undefined): string {
	switch (code) {
		case "23505":
			return "That record already exists. Please refresh and try again.";
		case "23503":
			return "That record is still in use, so it can't be changed yet.";
		case "23514":
		case "23P01":
			return "Those details do not match the warehouse rules. Please review and try again.";
		case "25P02":
		case "40001":
		case "40P01":
			return "The request was interrupted by another action. Please try again.";
		case "57014":
		case "53300":
			return "The warehouse database is busy right now. Please try again shortly.";
		default:
			return "We couldn't complete that request. Please try again.";
	}
}
