import { formatCents } from "@phygital/shared";

export const money = (cents: number, currency = "USD") => formatCents(cents, currency);

export const shortAddress = (address: string | null | undefined) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";

export const memberPrice = (cents: number, discountBps: number) => cents - Math.floor((cents * discountBps) / 10_000);

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
