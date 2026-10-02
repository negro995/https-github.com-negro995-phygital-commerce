import { formatCents, type MintStatus, type OrderStatus, type PaymentMethod, type ProductType } from "@phygital/shared";

export const money = (cents: number, currency = "USD") => formatCents(cents, currency, "es-AR");

export const shortAddress = (address: string | null | undefined) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";

export const memberPrice = (cents: number, discountBps: number) => cents - Math.floor((cents * discountBps) / 10_000);

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "pago pendiente",
  PAID: "pagado",
  FULFILLED: "entregado",
  CANCELLED: "cancelado",
  PAYMENT_FAILED: "pago rechazado",
};

export const orderStatusLabel = (status: OrderStatus) => ORDER_STATUS_LABELS[status] ?? status;

export const MINT_STATUS_LABELS: Record<MintStatus, string> = {
  PENDING: "en cola",
  SUBMITTED: "emitiendo",
  CONFIRMED: "emitidos",
  FAILED: "fallidos",
  SKIPPED: "omitidos",
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  PHYSICAL: "físico",
  DIGITAL: "digital",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  stripe: "tarjeta (Stripe)",
  mercadopago: "Mercado Pago",
  crypto: "USDC",
  mock: "pago de prueba",
};

export const paymentMethodLabel = (method: PaymentMethod | "pos" | null) => {
  if (!method) return "—";
  return method === "pos" ? "pago en el local" : PAYMENT_METHOD_LABELS[method];
};
