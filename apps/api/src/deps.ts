import type { PrismaClient } from "@phygital/db";
import type { AppConfig } from "./config";
import type { Logger } from "./lib/logger";
import type { ConciergeModel } from "./services/ai/models";
import type { AuthVerifier } from "./services/auth";
import type { ChainService } from "./services/chain";
import type { PaymentRegistry } from "./services/payments";
import type { WalletProvisioner } from "./services/wallets";

export interface AppDeps {
  db: PrismaClient;
  config: AppConfig;
  logger: Logger;
  auth: AuthVerifier;
  wallets: WalletProvisioner;
  chain: ChainService;
  payments: PaymentRegistry;
  ai: ConciergeModel | null;
  /** Wakes the mint worker (fire-and-forget). */
  kickMintWorker: () => void;
}
