import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export const recommendationRoutes = Router();

// "Customers who bought X also bought Y" — item-based collaborative filtering via
// co-occurrence self-join on order_items (see db/hard-queries.sql #4).
recommendationRoutes.get(
  "/products/:id/recommendations",
  asyncHandler(async (req: Request, res: Response) => {
    const seed = BigInt(req.params.id);
    const rows = await prisma.$queryRaw<
      { recommended_product_id: bigint; recommended_name: string; co_purchase_count: bigint }[]
    >`
      SELECT b.product_id  AS recommended_product_id,
             p.name        AS recommended_name,
             COUNT(DISTINCT a.order_id) AS co_purchase_count
      FROM order_items a
      JOIN order_items b ON a.order_id = b.order_id AND b.product_id <> a.product_id
      JOIN products p ON p.id = b.product_id
      WHERE a.product_id = ${seed} AND p.is_active = TRUE
      GROUP BY b.product_id, p.name
      ORDER BY co_purchase_count DESC, b.product_id
      LIMIT 10`;

    res.json(
      rows.map((r) => ({
        productId: Number(r.recommended_product_id),
        name: r.recommended_name,
        coPurchaseCount: Number(r.co_purchase_count),
      }))
    );
  })
);
