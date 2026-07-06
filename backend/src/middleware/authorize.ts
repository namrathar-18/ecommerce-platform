import { Request, Response, NextFunction } from "express";
import { Forbidden, Unauthorized } from "../shared/errors.js";

type Role = "customer" | "vendor" | "admin";

// Role-based guard. Use after `authenticate`. e.g. authorize("vendor","admin")
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw Unauthorized();
    if (!roles.includes(req.user.role)) throw Forbidden("Insufficient role");
    next();
  };
