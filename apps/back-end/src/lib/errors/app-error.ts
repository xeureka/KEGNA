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

