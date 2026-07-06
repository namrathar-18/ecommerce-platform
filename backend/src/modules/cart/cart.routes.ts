import { Router, Request, Response } from "express";
import { z } from "zod";
import { cartService } from "./cart.service.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export const cartRoutes = Router();
cartRoutes.use(authenticate, authorize("customer"));

cartRoutes.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => res.json(await cartService.view(req.user!.id)))
);

const addSchema = z.object({
  body: z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).default(1) }),
});
cartRoutes.post(
  "/items",
  validate(addSchema),
  asyncHandler(async (req: Request, res: Response) =>
    res.status(201).json(await cartService.addItem(req.user!.id, req.body.productId, req.body.quantity))
  )
);

const qtySchema = z.object({ body: z.object({ quantity: z.number().int() }) });
cartRoutes.patch(
  "/items/:productId",
  validate(qtySchema),
  asyncHandler(async (req: Request, res: Response) =>
    res.json(await cartService.setQuantity(req.user!.id, Number(req.params.productId), req.body.quantity))
  )
);

cartRoutes.delete(
  "/items/:productId",
  asyncHandler(async (req: Request, res: Response) =>
    res.json(await cartService.removeItem(req.user!.id, Number(req.params.productId)))
  )
);
