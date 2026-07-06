import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// BigInt cannot be JSON-serialized by default. Teach JSON to emit BigInt as a
// number/string so `res.json(...)` on Prisma rows (BigInt ids) does not throw.
// (Global, one-time patch — safe for ids within Number range.)
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};
