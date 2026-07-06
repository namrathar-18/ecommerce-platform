import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { BadRequest, Conflict, Unauthorized } from "../../shared/errors.js";
import type { AuthUser } from "../../middleware/authenticate.js";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function signAccessToken(u: AuthUser) {
  return jwt.sign({ id: u.id, role: u.role, vendorId: u.vendorId }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl as jwt.SignOptions["expiresIn"],
  });
}

// Issue an opaque refresh token, store only its SHA-256 hash (revocable).
async function issueRefreshToken(userId: number) {
  const raw = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(raw), expiresAt },
  });
  return raw;
}

async function buildAuthUser(userId: number): Promise<AuthUser> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { vendor: true },
  });
  return {
    id: Number(user.id),
    role: user.role as AuthUser["role"],
    vendorId: user.vendor ? Number(user.vendor.id) : undefined,
  };
}

export const authService = {
  async register(input: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: "customer" | "vendor";
    storeName?: string;
  }) {
    if (input.role === "vendor" && !input.storeName)
      throw BadRequest("storeName is required to register as a vendor");

    const exists = await prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw Conflict("Email already registered");

    const passwordHash = await bcrypt.hash(input.password, env.bcryptCost);

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { name: input.name, email: input.email, passwordHash, phone: input.phone, role: input.role },
      });
      if (input.role === "vendor") {
        await tx.vendor.create({ data: { userId: u.id, storeName: input.storeName! } });
      }
      // every user gets a cart lazily; create it up front for customers
      await tx.cart.create({ data: { userId: u.id } });
      return u;
    });

    return this.issueSession(Number(user.id));
  },

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw Unauthorized("Invalid credentials");
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw Unauthorized("Invalid credentials");
    return this.issueSession(Number(user.id));
  },

  async issueSession(userId: number) {
    const authUser = await buildAuthUser(userId);
    const accessToken = signAccessToken(authUser);
    const refreshToken = await issueRefreshToken(userId);
    return { accessToken, refreshToken, user: authUser };
  },

  // Rotate: validate presented refresh token, revoke it, issue a fresh pair.
  async refresh(rawToken: string) {
    if (!rawToken) throw Unauthorized("Missing refresh token");
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!record || record.revokedAt || record.expiresAt < new Date())
      throw Unauthorized("Invalid or expired refresh token");
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(Number(record.userId));
  },

  async logout(rawToken: string) {
    if (!rawToken) return;
    await prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
