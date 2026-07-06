import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "node:crypto";
import { paymentService } from "./payment.service.js";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export const paymentRoutes = Router();

// Customer-initiated mock "pay now". Generates a transaction ref and confirms.
const paySchema = z.object({
  body: z.object({
    orderId: z.number().int().positive(),
    outcome: z.enum(["success", "failed"]).default("success"),
  }),
});
paymentRoutes.post(
  "/pay",
  authenticate,
  validate(paySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const ref = "txn_" + crypto.randomBytes(8).toString("hex");
    res.json(await paymentService.confirm(req.body.orderId, ref, req.body.outcome));
  })
);

// Gateway webhook (public; would verify HMAC signature in production).
const webhookSchema = z.object({
  body: z.object({
    orderId: z.number().int().positive(),
    transactionRef: z.string().min(1),
    status: z.enum(["success", "failed"]),
  }),
});
paymentRoutes.post(
  "/webhook",
  validate(webhookSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // TODO(prod): verify req.headers['x-signature'] against HMAC(secret, rawBody)
    res.json(await paymentService.confirm(req.body.orderId, req.body.transactionRef, req.body.status));
  })
);
