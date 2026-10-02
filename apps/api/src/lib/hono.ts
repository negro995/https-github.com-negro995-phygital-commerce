import type { User } from "@phygital/db";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { z } from "zod";
import type { AppDeps } from "../deps";
import { syncUser } from "../services/users";
import { AppError } from "./errors";

export type AppEnv = { Variables: { user: User | null } };

export async function parseJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError("BAD_REQUEST", "El cuerpo de la solicitud debe ser JSON válido");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError("BAD_REQUEST", "Revisá los datos ingresados", result.error.issues);
  }
  return result.data;
}

/** Resolves the current user (if any credentials are present). */
export const authMiddleware = (deps: AppDeps) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const identity = await deps.auth.verify(c.req.raw.headers);
    c.set("user", identity ? await syncUser(deps.db, deps.config, identity) : null);
    await next();
  });

export function requireUser(c: Context<AppEnv>): User {
  const user = c.get("user");
  if (!user) throw new AppError("UNAUTHORIZED", "Tenés que ingresar para continuar");
  return user;
}

export function requireAdmin(c: Context<AppEnv>): User {
  const user = requireUser(c);
  if (user.role !== "ADMIN" && user.role !== "STAFF") throw new AppError("FORBIDDEN", "Necesitás acceso de administrador del comercio");
  return user;
}
