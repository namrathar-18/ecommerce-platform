import { Router, Request, Response } from "express";
import { z } from "zod";
import { orderService } from "./order.service.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export const orderRoutes = Router();
orderRoutes.use(authenticate);

const checkoutSchema = z.object({ body: z.object({ addressId: z.number().int().positive().optional() }) });

orderRoutes.post(
  "/checkout",
  authorize("customer"),
  validate(checkoutSchema),
  asyncHandler(async (req: Request, res: Response) =>
    res.status(201).json(await orderService.checkout(req.user!.id, req.body.addressId))
  )
);

orderRoutes.get(
  "/",
  authorize("customer"),
  asyncHandler(async (req: Request, res: Response) => res.json(await orderService.history(req.user!.id)))
);

orderRoutes.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) =>
    res.json(await orderService.getById(req.user!.id, Number(req.params.id), req.user!.role))
  )
);

orderRoutes.post(
  "/:id/cancel",
  authorize("customer"),
  asyncHandler(async (req: Request, res: Response) =>
    res.json(await orderService.cancel(req.user!.id, Number(req.params.id)))
  )
);
