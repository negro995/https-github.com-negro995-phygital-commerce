import type { ApiErrorCode } from "@phygital/shared";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const STATUS: Record<ApiErrorCode, ContentfulStatusCode> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  PAYMENT_FAILED: 402,
  PAYMENT_PROVIDER_UNAVAILABLE: 503,
  WEB3_UNAVAILABLE: 503,
  AI_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found`);
