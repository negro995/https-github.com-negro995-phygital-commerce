import type { ApiErrorBody, ApiErrorCode } from "@phygital/shared";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | "NETWORK",
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type AuthHeaders = () => Promise<Record<string, string>>;

let authHeaderSource: AuthHeaders = async () => ({});

/** Registered by the AuthProvider so every request carries the current credentials. */
export function setAuthHeaderSource(source: AuthHeaders) {
  authHeaderSource = source;
}

export interface ApiResponse<T> {
  status: number;
  data: T;
}

export async function apiRequest<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiResponse<T>> {
  const { json, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...(json !== undefined ? { "content-type": "application/json" } : {}),
        ...(await authHeaderSource()),
        ...(headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("NETWORK", "Can't reach the store right now. Check your connection and try again.", 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as Partial<ApiErrorBody> | null)?.error;
    throw new ApiError(err?.code ?? "INTERNAL", err?.message ?? `Request failed (${res.status})`, res.status, err?.details);
  }
  return { status: res.status, data: body as T };
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  return (await apiRequest<T>(path, init)).data;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

/** Fetches a non-JSON resource (e.g. an authenticated QR SVG). */
export async function apiText(path: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: await authHeaderSource() });
  } catch {
    throw new ApiError("NETWORK", "Can't reach the store right now.", 0);
  }
  if (!res.ok) throw new ApiError("INTERNAL", `Request failed (${res.status})`, res.status);
  return res.text();
}
