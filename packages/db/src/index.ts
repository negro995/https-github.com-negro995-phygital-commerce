import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { __phygitalPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.__phygitalPrisma) {
    globalForPrisma.__phygitalPrisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }
  return globalForPrisma.__phygitalPrisma;
}
