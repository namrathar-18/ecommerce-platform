import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { Forbidden, NotFound } from "../../shared/errors.js";

export const vendorRoutes = Router();
vendorRoutes.use(authenticate, authorize("vendor"));

// A vendor sees ONLY their own order_items (their sub-orders).
vendorRoutes.get(
  "/orders",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await prisma.orderItem.findMany({
      where: { vendorId: req.user!.vendorId! },
      orderBy: { id: "desc" },
      include: { product: { select: { name: true } }, order: { select: { createdAt: true, status: true } } },
    });
    res.json(items);
  })
);

// Independent per-line fulfillment status update.
const statusSchema = z.object({
  body: z.object({ status: z.enum(["confirmed", "shipped", "delivered"]) }),
});
vendorRoutes.patch(
  "/orders/:itemId/status",
  validate(statusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const item = await prisma.orderItem.findUnique({ where: { id: BigInt(req.params.itemId) } });
    if (!item) throw NotFound("Order item not found");
    if (Number(item.vendorId) !== req.user!.vendorId) throw Forbidden("Not your order item");
    const updated = await prisma.orderItem.update({
      where: { id: item.id },
      data: { itemStatus: req.body.status },
    });
    // If ALL items of the parent order reach 'delivered', promote the order.
    const siblings = await prisma.orderItem.findMany({ where: { orderId: item.orderId } });
    if (siblings.every((s) => s.itemStatus === "delivered")) {
      await prisma.order.update({ where: { id: item.orderId }, data: { status: "delivered" } });
    } else if (req.body.status === "shipped") {
      await prisma.order.update({ where: { id: item.orderId }, data: { status: "shipped" } });
    }
    res.json(updated);
  })
);

vendorRoutes.get(
  "/payouts",
  asyncHandler(async (req: Request, res: Response) => {
    const payouts = await prisma.vendorPayout.findMany({
      where: { vendorId: req.user!.vendorId! },
      orderBy: { id: "desc" },
    });
    res.json(payouts);
  })
);
