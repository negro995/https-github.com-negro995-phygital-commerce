import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppConfig } from "../config";
import { AppError } from "../lib/errors";
import type { Logger } from "../lib/logger";
import { embeddedWalletAddress, primaryEmail, type PrivyUser } from "./wallets";

export interface AuthIdentity {
  email: string;
  name?: string;
  privyId?: string;
  walletAddress?: string;
}

export interface AuthVerifier {
  mode: "dev" | "privy";
  /** Returns null when the request carries no credentials; throws UNAUTHORIZED when they are invalid. */
  verify(headers: Headers): Promise<AuthIdentity | null>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trusts `x-demo-email` (+ optional `x-demo-wallet`). Local development only. */
export class DevAuthVerifier implements AuthVerifier {
  readonly mode = "dev" as const;
  async verify(headers: Headers): Promise<AuthIdentity | null> {
    const email = headers.get("x-demo-email")?.trim().toLowerCase();
    if (!email) return null;
    if (!EMAIL_RE.test(email)) throw new AppError("UNAUTHORIZED", "Email de demo inválido");
    const wallet = headers.get("x-demo-wallet")?.trim();
    return {
      email,
      name: headers.get("x-demo-name")?.trim() || undefined,
      walletAddress: wallet && /^0x[a-fA-F0-9]{40}$/.test(wallet) ? wallet : undefined,
    };
  }
}

/** Verifies Privy access tokens (ES256 JWT) and resolves the user's email and embedded wallet. */
export class PrivyAuthVerifier implements AuthVerifier {
  readonly mode = "privy" as const;
  private readonly jwks;
  private readonly cache = new Map<string, { identity: AuthIdentity; expires: number }>();

  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.jwks = createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${appId}/jwks.json`));
  }

  async verify(headers: Headers): Promise<AuthIdentity | null> {
    const header = headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length).trim();
    let did: string;
    try {
      const { payload } = await jwtVerify(token, this.jwks, { issuer: "privy.io", audience: this.appId });
      if (!payload.sub) throw new Error("missing sub");
      did = payload.sub;
    } catch (err) {
      this.logger.debug("Privy token rejected", { error: err instanceof Error ? err.message : String(err) });
      throw new AppError("UNAUTHORIZED", "Tu sesión no es válida o expiró");
    }

    const cached = this.cache.get(did);
    if (cached && cached.expires > Date.now()) return cached.identity;

    const res = await this.fetchImpl(`https://auth.privy.io/api/v1/users/${encodeURIComponent(did)}`, {
      headers: {
        "privy-app-id": this.appId,
        authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString("base64")}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new AppError("UNAUTHORIZED", "No pudimos cargar tu usuario de Privy");
    const user = (await res.json()) as PrivyUser;
    const email = primaryEmail(user)?.toLowerCase();
    if (!email) throw new AppError("FORBIDDEN", "Necesitás una cuenta con email asociado");
    const identity: AuthIdentity = { email, privyId: did, walletAddress: embeddedWalletAddress(user) };
    this.cache.set(did, { identity, expires: Date.now() + 5 * 60_000 });
    return identity;
  }
}

export function createAuthVerifier(config: AppConfig, logger: Logger): AuthVerifier {
  if (config.AUTH_MODE === "privy") {
    return new PrivyAuthVerifier(config.PRIVY_APP_ID!, config.PRIVY_APP_SECRET!, logger);
  }
  logger.warn("AUTH_MODE=dev: trusting x-demo-email header. Do not use in production.");
  return new DevAuthVerifier();
}
