import { serve } from "@hono/node-server";
import { getPrisma } from "@phygital/db";
import { createApp } from "./app";
import { loadConfig } from "./config";
import type { AppDeps } from "./deps";
import { consoleLogger } from "./lib/logger";
import { createConciergeModel } from "./services/ai/models";
import { createAuthVerifier } from "./services/auth";
import { createChainService } from "./services/chain";
import { startMintWorker } from "./services/mints";
import { createPaymentRegistry } from "./services/payments";
import { createWalletProvisioner } from "./services/wallets";

const config = loadConfig();
const logger = consoleLogger;
const db = getPrisma();
const chain = createChainService(config, logger);

let kick: () => void = () => {};
const deps: AppDeps = {
  db,
  config,
  logger,
  chain,
  auth: createAuthVerifier(config, logger),
  wallets: createWalletProvisioner(config, logger),
  payments: createPaymentRegistry(config, chain),
  ai: createConciergeModel(config),
  kickMintWorker: () => kick(),
};

const worker = startMintWorker(deps, config.MINT_WORKER_INTERVAL_MS);
kick = worker.kick;

const server = serve({ fetch: createApp(deps).fetch, port: config.PORT }, (info) => {
  logger.info(`API listening on http://localhost:${info.port}`, {
    payments: deps.payments.enabledMethods(),
    ai: deps.ai?.provider ?? "fallback",
    auth: config.AUTH_MODE,
  });
  worker.kick();
});

const shutdown = async () => {
  worker.stop();
  server.close();
  await db.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
