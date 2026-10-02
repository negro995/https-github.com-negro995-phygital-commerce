import type { NftMint, PrismaClient, Product, User } from "@phygital/db";
import { vi } from "vitest";
import { loadConfig } from "../src/config";
import type { AppDeps } from "../src/deps";
import { silentLogger } from "../src/lib/logger";
import { DevAuthVerifier } from "../src/services/auth";
import type { ChainService } from "../src/services/chain";
import { MockPaymentProvider, PaymentRegistry } from "../src/services/payments";
import { DevWalletProvisioner } from "../src/services/wallets";

export const testConfig = (env: Record<string, string> = {}) =>
  loadConfig({ NODE_ENV: "test", ADMIN_EMAILS: "admin@test.dev", ENABLE_MOCK_PAYMENTS: "true", ...env });

export const offlineChain = (overrides: Partial<ChainService> = {}): ChainService => ({
  chainId: 31337,
  minter: null,
  readTwinCount: null,
  verifyPayment: null,
  usdc: null,
  explorerTxUrl: () => null,
  ...overrides,
});

export function product(overrides: Partial<Product> = {}): Product {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "p1",
    slug: "p1",
    name: "Product",
    description: "",
    type: "PHYSICAL",
    category: "general",
    priceCents: 1000,
    currency: "USD",
    stock: 10,
    imageUrl: null,
    tokenId: 1,
    twinEnabled: true,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function mintJob(overrides: Partial<NftMint> = {}): NftMint {
  const now = new Date();
  return {
    id: "m1",
    mintRef: "order:o1:item:i1:0",
    source: "ORDER",
    status: "PENDING",
    userId: "u1",
    productId: "p1",
    orderId: "o1",
    passportId: null,
    walletAddress: "0x00000000000000000000000000000000000000aa",
    tokenId: 1,
    txHash: null,
    attempts: 0,
    lastError: null,
    nextAttemptAt: now,
    confirmedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function user(overrides: Partial<User> = {}): User {
  const now = new Date();
  return {
    id: "u1",
    email: "ana@test.dev",
    name: null,
    role: "CUSTOMER",
    privyId: null,
    walletAddress: "0x00000000000000000000000000000000000000aa",
    walletProvider: "DEV",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Minimal in-memory stand-in for the Prisma client: tests provide only the delegates they touch. */
export const fakeDb = (impl: Record<string, unknown>) => impl as unknown as PrismaClient;

export function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    db: fakeDb({}),
    config: testConfig(),
    logger: silentLogger,
    auth: new DevAuthVerifier(),
    wallets: new DevWalletProvisioner(),
    chain: offlineChain(),
    payments: new PaymentRegistry({ mock: new MockPaymentProvider() }),
    ai: null,
    kickMintWorker: vi.fn(),
    ...overrides,
  };
}
