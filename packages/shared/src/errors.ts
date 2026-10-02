export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "PAYMENT_FAILED"
  | "PAYMENT_PROVIDER_UNAVAILABLE"
  | "WEB3_UNAVAILABLE"
  | "AI_UNAVAILABLE"
  | "INTERNAL";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; details?: unknown };
}
