import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { Unauthorized } from "../shared/errors.js";

export interface AuthUser {
  id: number;
  role: "customer" | "vendor" | "admin";
  vendorId?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw Unauthorized("Missing bearer token");
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as AuthUser & { iat: number };
    req.user = { id: payload.id, role: payload.role, vendorId: payload.vendorId };
    next();
  } catch {
    throw Unauthorized("Invalid or expired token");
  }
}
