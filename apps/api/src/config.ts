import { z } from "zod";

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(4000),
  WEB_URL: z.url().default("http://localhost:3000"),
  API_PUBLIC_URL: z.url().default("http://localhost:4000"),
  CORS_ORIGINS: optionalString,

  AUTH_MODE: z.enum(["dev", "privy"]).default("dev"),
  PRIVY_APP_ID: optionalString,
  PRIVY_APP_SECRET: optionalString,
  ADMIN_EMAILS: z.string().default(""),

  CHAIN_ID: z.coerce.number().int().default(31337),
  RPC_URL: z.string().default("http://127.0.0.1:8545"),
  MINTER_PRIVATE_KEY: optionalString,
  TWIN_CONTRACT_ADDRESS: optionalString,
  MINT_CONFIRMATIONS: z.coerce.number().int().min(1).default(1),
  MINT_MAX_ATTEMPTS: z.coerce.number().int().min(1).default(8),
  MINT_WORKER_INTERVAL_MS: z.coerce.number().int().min(0).default(10_000),

  ENABLE_MOCK_PAYMENTS: z.stringbool().default(false),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  MERCADOPAGO_ACCESS_TOKEN: optionalString,
  MERCADOPAGO_WEBHOOK_SECRET: optionalString,
  MERCADOPAGO_CURRENCY: z.string().default("ARS"),
  MERCADOPAGO_FX_RATE: z.coerce.number().positive().default(1),
  MERCADOPAGO_PREFILL_PAYER: z.stringbool().default(true),
  USDC_TOKEN_ADDRESS: optionalString,
  MERCHANT_WALLET_ADDRESS: optionalString,
  CRYPTO_MIN_CONFIRMATIONS: z.coerce.number().int().min(1).default(1),

  AI_PROVIDER: z
    .enum(["openai", "anthropic", "none", ""])
    .optional()
    .transform((v) => (v ? v : undefined)),
  OPENAI_API_KEY: optionalString,
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-5"),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig extends Env {
  adminEmails: Set<string>;
  corsOrigins: string[];
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.AUTH_MODE === "privy" && (!env.PRIVY_APP_ID || !env.PRIVY_APP_SECRET)) {
    throw new Error("AUTH_MODE=privy requires PRIVY_APP_ID and PRIVY_APP_SECRET");
  }
  if (env.NODE_ENV === "production" && env.AUTH_MODE === "dev") {
    throw new Error("AUTH_MODE=dev is not allowed in production");
  }
  return {
    ...env,
    adminEmails: new Set(
      env.ADMIN_EMAILS.split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
    corsOrigins: (env.CORS_ORIGINS ?? env.WEB_URL)
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
