import { z } from "zod";

export const PAYMENT_METHODS = ["stripe", "mercadopago", "crypto", "mock"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PRODUCT_TYPES = ["PHYSICAL", "DIGITAL"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const MINT_STATUSES = ["PENDING", "SUBMITTED", "CONFIRMED", "FAILED", "SKIPPED"] as const;
export type MintStatus = (typeof MINT_STATUSES)[number];

export const ORDER_STATUSES = ["PENDING_PAYMENT", "PAID", "FULFILLED", "CANCELLED", "PAYMENT_FAILED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address");
const txHash = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");

export const checkoutRequestSchema = z.object({
  email: z.email(),
  name: z.string().trim().min(1).max(120).optional(),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(50),
  paymentMethod: z.enum(PAYMENT_METHODS),
  /** Optional wallet that should receive the Digital Twin NFTs (e.g. an external wallet). */
  walletAddress: evmAddress.optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const cryptoConfirmSchema = z.object({ txHash });

export const productInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  description: z.string().trim().max(4000).default(""),
  type: z.enum(PRODUCT_TYPES),
  priceCents: z.number().int().min(0).max(100_000_000),
  stock: z.number().int().min(0).max(1_000_000),
  imageUrl: z.url().optional().or(z.literal("")),
  category: z.string().trim().max(60).default("general"),
  twinEnabled: z.boolean().default(true),
  active: z.boolean().default(true),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const passportGenerateSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(200),
});

export const posSaleSchema = z.object({
  storeId: z.string().min(1),
  items: z
    .array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(100) }))
    .min(1),
  customerEmail: z.email().optional(),
  /** Generate claimable QR passports for each physical unit sold. */
  issuePassports: z.boolean().default(true),
});

export const conciergeRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(20)
    .default([]),
});
export type ConciergeRequest = z.infer<typeof conciergeRequestSchema>;

export const conciergeResponseSchema = z.object({
  reply: z.string(),
  recommendations: z.array(z.object({ productId: z.string(), reason: z.string() })).max(6),
});
export type ConciergeModelOutput = z.infer<typeof conciergeResponseSchema>;
