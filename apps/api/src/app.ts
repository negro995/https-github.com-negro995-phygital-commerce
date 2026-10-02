import { Prisma } from "@phygital/db";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { AppDeps } from "./deps";
import { AppError } from "./lib/errors";
import { authMiddleware, type AppEnv } from "./lib/hono";
import { adminRoutes } from "./routes/admin";
import { commerceRoutes } from "./routes/commerce";
import { publicRoutes } from "./routes/public";
import { webhookRoutes } from "./routes/webhooks";

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use("*", secureHeaders());
  app.use(
    "/api/*",
    cors({
      origin: deps.config.corsOrigins,
      allowHeaders: ["content-type", "authorization", "x-demo-email", "x-demo-name", "x-demo-wallet"],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
      maxAge: 600,
    }),
  );

  app.get("/health", async (c) => {
    let database = "ok";
    try {
      await deps.db.$queryRaw`SELECT 1`;
    } catch {
      database = "unreachable";
    }
    return c.json(
      {
        ok: database === "ok",
        database,
        web3: { chainId: deps.chain.chainId, minting: Boolean(deps.chain.minter), cryptoPayments: Boolean(deps.chain.usdc) },
        payments: deps.payments.enabledMethods(),
        ai: deps.ai?.provider ?? "fallback",
      },
      database === "ok" ? 200 : 503,
    );
  });

  // Webhooks are server-to-server and must read the raw body, so they skip auth.
  app.route("/api/webhooks", webhookRoutes(deps));

  const api = new Hono<AppEnv>();
  api.use("*", authMiddleware(deps));
  api.route("/", publicRoutes(deps));
  api.route("/", commerceRoutes(deps));
  api.route("/admin", adminRoutes(deps));
  app.route("/api", api);

  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return c.json({ error: { code: "CONFLICT", message: "Resource already exists" } }, 409);
      if (err.code === "P2025") return c.json({ error: { code: "NOT_FOUND", message: "Resource not found" } }, 404);
    }
    if (err instanceof Error && err.name === "ZodError") {
      return c.json({ error: { code: "BAD_REQUEST", message: "Invalid request" } }, 400);
    }
    deps.logger.error("Unhandled error", { path: c.req.path, error: err instanceof Error ? err.stack : String(err) });
    return c.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, 500);
  });

  return app;
}
