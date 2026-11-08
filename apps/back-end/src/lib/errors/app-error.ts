import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { ErrorCode } from "./error-codes";

export class AppError extends Error {
	constructor(
		message: string,
		public readonly statusCode: ContentfulStatusCode,
		public readonly code: ErrorCode | string,
		public readonly details?: unknown,
	) {
		super(message);

		this.name = "AppError";
	}
}

/* ANYWHERE IN THE BACKEND

throw new AppError(
  "Patient not found",
  404,
  "PATIENT_NOT_FOUND",
);

    or 

throw new AppError(
  "You do not have permission to perform this action",
  403,
  ErrorCode.FORBIDDEN,
);
*/
