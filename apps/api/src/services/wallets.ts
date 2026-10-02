import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { AppConfig } from "../config";
import type { Logger } from "../lib/logger";
import { errorMessage } from "../lib/util";

export interface ProvisionedWallet {
  address: string;
  provider: "PRIVY" | "DEV";
  privyId?: string;
}

/** Creates a self-custodial wallet for a customer who checks out without one. */
export interface WalletProvisioner {
  provision(email: string): Promise<ProvisionedWallet | null>;
}

/**
 * Pregenerates a Privy embedded wallet linked to the customer's email. When the customer later
 * logs in with that email (social login / OTP), they gain full control over the same wallet.
 */
export class PrivyWalletProvisioner implements WalletProvisioner {
  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly logger: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async provision(email: string): Promise<ProvisionedWallet | null> {
    try {
      const res = await this.fetchImpl("https://auth.privy.io/api/v1/users", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "privy-app-id": this.appId,
          authorization: `Basic ${Buffer.from(`${this.appId}:${this.appSecret}`).toString("base64")}`,
        },
        body: JSON.stringify({
          create_ethereum_wallet: true,
          linked_accounts: [{ type: "email", address: email }],
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn("Privy wallet pregeneration failed", { status: res.status, body: await res.text() });
        return null;
      }
      const user = (await res.json()) as PrivyUser;
      const address = embeddedWalletAddress(user);
      return address ? { address, provider: "PRIVY", privyId: user.id } : null;
    } catch (err) {
      this.logger.warn("Privy wallet pregeneration error", { error: errorMessage(err) });
      return null;
    }
  }
}

/**
 * Development only: generates a random address. The private key is intentionally discarded, so
 * twins minted here are visible on-chain but not controllable. Use Privy in any real deployment.
 */
export class DevWalletProvisioner implements WalletProvisioner {
  async provision(): Promise<ProvisionedWallet> {
    return { address: privateKeyToAccount(generatePrivateKey()).address, provider: "DEV" };
  }
}

export interface PrivyLinkedAccount {
  type: string;
  address?: string;
  email?: string;
  wallet_client_type?: string;
  chain_type?: string;
}

export interface PrivyUser {
  id: string;
  linked_accounts: PrivyLinkedAccount[];
}

export function embeddedWalletAddress(user: PrivyUser): string | undefined {
  const wallets = user.linked_accounts.filter((a) => a.type === "wallet" && a.address);
  const embedded = wallets.find((a) => a.wallet_client_type === "privy" && a.chain_type !== "solana");
  return (embedded ?? wallets.find((a) => a.chain_type !== "solana"))?.address;
}

export function primaryEmail(user: PrivyUser): string | undefined {
  const email = user.linked_accounts.find((a) => a.type === "email")?.address;
  if (email) return email;
  return user.linked_accounts.find((a) => a.email)?.email;
}

export function createWalletProvisioner(config: AppConfig, logger: Logger): WalletProvisioner {
  if (config.PRIVY_APP_ID && config.PRIVY_APP_SECRET) {
    return new PrivyWalletProvisioner(config.PRIVY_APP_ID, config.PRIVY_APP_SECRET, logger);
  }
  return new DevWalletProvisioner();
}
