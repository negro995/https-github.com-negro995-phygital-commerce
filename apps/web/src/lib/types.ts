import type { LoyaltyTier, MintStatus, OrderStatus, PaymentMethod, ProductType } from "@phygital/shared";

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: ProductType;
  category: string;
  priceCents: number;
  currency: string;
  stock: number;
  imageUrl: string | null;
  tokenId: number;
  twinEnabled: boolean;
  active: boolean;
}

export interface PublicConfig {
  authMode: "dev" | "privy";
  paymentMethods: PaymentMethod[];
  chainId: number;
  web3: { minting: boolean; loyaltyReads: boolean; usdc: { token: string; recipient: string } | null };
  ai: { provider: string; model?: string };
  tiers: LoyaltyTier[];
}

export interface LoyaltyStatus {
  walletAddress: string | null;
  twinCount: number;
  source: "onchain" | "database";
  tier: LoyaltyTier;
  next: { tier: LoyaltyTier; twinsNeeded: number } | null;
  perks: Array<{ tierId: LoyaltyTier["id"]; tierName: string; perk: string; unlocked: boolean }>;
}

export interface Me {
  user: { id: string; email: string; name: string | null; role: "CUSTOMER" | "STAFF" | "ADMIN"; walletAddress: string | null; walletProvider: string | null };
  loyalty: LoyaltyStatus;
}

export type ClientPayment =
  | { type: "redirect"; url: string }
  | { type: "crypto"; chainId: number; token: string; recipient: string; amount: string; decimals: number; symbol: string }
  | { type: "mock" };

export interface CheckoutResult {
  orderId: string;
  subtotalCents: number;
  discountCents: number;
  discountBps: number;
  totalCents: number;
  loyaltyTier: string;
  walletAddress: string | null;
  payment: ClientPayment;
}

export interface MintView {
  id: string;
  productId: string;
  status: MintStatus;
  txHash: string | null;
  explorerUrl: string | null;
  attempts: number;
  lastError: string | null;
}

export interface OrderView {
  id: string;
  status: OrderStatus;
  channel: "WEB" | "IN_STORE";
  paymentMethod: PaymentMethod | "pos" | null;
  subtotalCents: number;
  discountBps: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  loyaltyTier: string | null;
  walletAddress: string | null;
  createdAt: string;
  paidAt: string | null;
  items: Array<{ id: string; quantity: number; unitPriceCents: number; product: Pick<Product, "id" | "name" | "slug" | "imageUrl" | "type"> }>;
  mints: MintView[];
}

export interface Twin {
  id: string;
  status: MintStatus;
  source: "ORDER" | "PASSPORT_CLAIM";
  tokenId: number;
  txHash: string | null;
  explorerUrl: string | null;
  lastError: string | null;
  createdAt: string;
  product: Pick<Product, "name" | "slug" | "imageUrl" | "type" | "tokenId">;
}

export interface Passport {
  code: string;
  serial: string;
  authentic: boolean;
  product: Pick<Product, "id" | "slug" | "name" | "description" | "imageUrl" | "tokenId">;
  store: { name: string; city: string | null } | null;
  claimed: boolean;
  claimedByViewer: boolean;
  claimedAt: string | null;
  mint: { status: MintStatus; txHash: string | null; explorerUrl: string | null } | null;
}

export interface ConciergeRecommendation {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  memberPriceCents: number;
  imageUrl: string | null;
  type: ProductType;
  reason: string;
}

export interface ConciergeResult {
  reply: string;
  recommendations: ConciergeRecommendation[];
  loyalty: { tier: string; tierName: string; discountBps: number; autoApplied: boolean; twinCount: number } | null;
  source: "openai" | "anthropic" | "fallback";
  degraded: boolean;
}

export interface AdminStats {
  windowDays: number;
  sales: { web: { revenueCents: number; orders: number }; inStore: { revenueCents: number; orders: number } };
  mints: Record<MintStatus, number>;
  customers: number;
  passports: { issued: number; claimed: number };
  lowStock: Product[];
  recentOrders: Array<{ id: string; channel: "WEB" | "IN_STORE"; status: OrderStatus; totalCents: number; paymentMethod: PaymentMethod | "pos" | null; email: string | null; createdAt: string }>;
}

export interface Store {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
}

export interface AdminPassport {
  id: string;
  code: string;
  serial: string;
  url: string;
  createdAt: string;
  claimedAt: string | null;
  product: { name: string };
  claimedBy: { email: string } | null;
  mint: { status: MintStatus } | null;
}

export interface AdminMint {
  id: string;
  status: MintStatus;
  source: "ORDER" | "PASSPORT_CLAIM";
  tokenId: number;
  txHash: string | null;
  explorerUrl: string | null;
  attempts: number;
  lastError: string | null;
  walletAddress: string | null;
  createdAt: string;
  product: { name: string };
  user: { email: string };
}

export interface PosSaleResult {
  orderId: string;
  totalCents: number;
  customerWallet: string | null;
  passports: Array<{ code: string; serial: string; url: string; qrSvg: string }>;
}
