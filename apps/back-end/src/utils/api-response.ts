import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { TypedResponse } from "hono";

/**
 * Standard success envelope.
 *
 * Example JSON response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "apt_123",
 *     "patientId": "pat_456",
 *     "startTime": "2026-09-01T10:00:00.000Z"
 *   }
 * }
 */
export type SuccessResponse<T> = {
	success: true;
	data: T;
};

/**
 * Standard error envelope.
 *
 * Example JSON response:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_ERROR",
 *     "message": "startTime must be a valid ISO datetime",
 *     "details": { "field": "startTime", "received": "tomorrow" }
 *   }
 * }
 *
 * "details" is optional and omitted entirely from the JSON when not provided:
 * {
 *   "success": false,
 *   "error": { "code": "NOT_FOUND", "message": "Appointment not found" }
 * }
 */
export type ErrorResponse = {
	success: false;
	error: {
		code: string;
		message: string;
		details?: unknown;
	};
};

/**
 * Sends a success response.
 *
 * The status generic `S` defaults to the literal `200`, so when you call
 * successResponse(c, data) with no explicit status, TypeScript narrows the
 * return type to status 200 exactly — required for RouteHandler<typeof route>
 * to match a createRoute() definition whose `responses` declares `200`.
 *
 * Usage:
 *   return successResponse(c, { id: "apt_123", status: "confirmed" });
 *   // -> HTTP 200, { success: true, data: {...} }
 *
 *   return successResponse(c, createdAppointment, 201);
 *   // -> HTTP 201, { success: true, data: {...} }
 */
export function successResponse<T>(
	c: Context,
	data: T,
): Response & TypedResponse<SuccessResponse<T>, 200, "json">;
export function successResponse<T, S extends ContentfulStatusCode>(
	c: Context,
	data: T,
	status: S,
): Response & TypedResponse<SuccessResponse<T>, S, "json">;
export function successResponse<T, S extends ContentfulStatusCode = 200>(
	c: Context,
	data: T,
	status: S = 200 as S,
): Response {
	return c.json(
		{
			success: true,
			data,
		} satisfies SuccessResponse<T>,
		status,
	);
}

/**
 * Sends an error response.
 *
 * The status generic `S` defaults to the literal `500`, narrowing the same
 * way successResponse does — pass an explicit `status` to match whatever
 * error status your route declares (401, 404, 422, etc.).
 *
 * Usage:
 *   return errorResponse(c, {
 *     code: "UNAUTHORIZED",
 *     message: "You must be logged in",
 *     status: 401,
 *   });
 *   // -> HTTP 401, { success: false, error: { code, message } }
 */
export const errorResponse = <S extends ContentfulStatusCode = 500>(
	c: Context,
	{
		message,
		status = 500 as S,
		code,
		details,
	}: {
		message: string;
		status?: S;
		code: string;
		details?: unknown;
	},
) => {
	return c.json(
		{
			success: false,
			error: {
				code,
				message,
				...(details !== undefined && { details }),
			},
		} satisfies ErrorResponse,
		status,
	);
};
