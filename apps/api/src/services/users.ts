import type { PrismaClient, User, WalletProvider } from "@phygital/db";
import type { AppConfig } from "../config";
import type { AuthIdentity } from "./auth";
import type { WalletProvisioner } from "./wallets";

/** Upserts the local user for an authenticated identity and links its wallet if newly known. */
export async function syncUser(db: PrismaClient, config: AppConfig, identity: AuthIdentity): Promise<User> {
  const isAdmin = config.adminEmails.has(identity.email);
  let user = await db.user.upsert({
    where: { email: identity.email },
    create: {
      email: identity.email,
      name: identity.name,
      privyId: identity.privyId,
      role: isAdmin ? "ADMIN" : "CUSTOMER",
    },
    update: {
      ...(identity.privyId ? { privyId: identity.privyId } : {}),
      ...(isAdmin ? { role: "ADMIN" as const } : {}),
    },
  });

  const shouldLinkWallet =
    identity.walletAddress &&
    (!user.walletAddress || (user.walletProvider === "DEV" && identity.walletAddress !== user.walletAddress));
  if (shouldLinkWallet) {
    user = await attachWallet(db, user, identity.walletAddress!, identity.privyId ? "PRIVY" : "EXTERNAL");
  }
  return user;
}

/** Sets the user's wallet and hands it to any mint jobs that were waiting for one. */
export async function attachWallet(
  db: PrismaClient,
  user: User,
  address: string,
  provider: WalletProvider,
): Promise<User> {
  const updated = await db.user.update({
    where: { id: user.id },
    data: { walletAddress: address, walletProvider: provider },
  });
  await db.nftMint.updateMany({
    where: { userId: user.id, status: { in: ["PENDING", "FAILED"] }, walletAddress: null },
    data: { walletAddress: address, status: "PENDING", nextAttemptAt: new Date() },
  });
  return updated;
}

/** Ensures a customer has a wallet to receive Digital Twins, creating one if needed. */
export async function ensureWallet(
  db: PrismaClient,
  wallets: WalletProvisioner,
  user: User,
  preferredAddress?: string,
): Promise<User> {
  if (user.walletAddress) return user;
  if (preferredAddress) return attachWallet(db, user, preferredAddress, "EXTERNAL");
  const wallet = await wallets.provision(user.email);
  if (!wallet) return user;
  const withWallet = await attachWallet(db, user, wallet.address, wallet.provider);
  if (wallet.privyId && !withWallet.privyId) {
    return db.user.update({ where: { id: user.id }, data: { privyId: wallet.privyId } });
  }
  return withWallet;
}
