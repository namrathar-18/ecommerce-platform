import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.flatten() },
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // Prisma unique-constraint violation -> 409
  const anyErr = err as any;
  if (anyErr?.code === "P2002") {
    return res.status(409).json({
      error: { code: "CONFLICT", message: `Duplicate value for ${anyErr.meta?.target ?? "field"}` },
    });
  }
  console.error("[unhandled]", err);
  return res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
}
