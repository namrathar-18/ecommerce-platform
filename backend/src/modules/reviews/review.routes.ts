import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { Forbidden, BadRequest } from "../../shared/errors.js";

// Reviews are nested under products in app.ts: /products/:id/reviews
export const reviewRoutes = Router({ mergeParams: true });

reviewRoutes.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const reviews = await prisma.review.findMany({
      where: { productId: BigInt(req.params.id) },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    res.json(reviews);
  })
);

const createSchema = z.object({
  body: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() }),
});
reviewRoutes.post(
  "/",
  authenticate,
  authorize("customer"),
  validate(createSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const productId = BigInt(req.params.id);
    // Verified purchase gate: must have a delivered/confirmed order_item for this product.
    const purchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId: BigInt(req.user!.id) },
        itemStatus: { in: ["confirmed", "shipped", "delivered"] },
      },
    });
    if (!purchased) throw Forbidden("You can only review products you have purchased");

    const review = await prisma.review.upsert({
      where: { productId_userId: { productId, userId: BigInt(req.user!.id) } },
      create: { productId, userId: BigInt(req.user!.id), rating: req.body.rating, comment: req.body.comment },
      update: { rating: req.body.rating, comment: req.body.comment },
    });
    res.status(201).json(review);
  })
);

reviewRoutes.delete(
  "/:reviewId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const review = await prisma.review.findUnique({ where: { id: BigInt(req.params.reviewId) } });
    if (!review) throw BadRequest("Review not found");
    if (Number(review.userId) !== req.user!.id && req.user!.role !== "admin")
      throw Forbidden("Not your review");
    await prisma.review.delete({ where: { id: review.id } });
    res.status(204).send();
  })
);
