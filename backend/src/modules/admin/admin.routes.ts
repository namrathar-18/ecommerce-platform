import { Router, Request, Response } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export const adminRoutes = Router();
adminRoutes.use(authenticate, authorize("admin"));

const num = (rows: any[]) => rows.map((r) => {
  const o: any = {};
  for (const k of Object.keys(r)) o[k] = typeof r[k] === "bigint" ? Number(r[k]) : r[k];
  return o;
});

// User management
adminRoutes.get(
  "/users",
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(
      await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
        orderBy: { id: "desc" },
      })
    );
  })
);

adminRoutes.patch(
  "/users/:id/active",
  asyncHandler(async (req: Request, res: Response) => {
    const user = await prisma.user.update({
      where: { id: BigInt(req.params.id) },
      data: { isActive: req.body.isActive },
    });
    res.json({ id: Number(user.id), isActive: user.isActive });
  })
);

adminRoutes.patch(
  "/vendors/:id/verify",
  asyncHandler(async (req: Request, res: Response) => {
    const status = req.body.status === "rejected" ? "rejected" : "verified";
    const vendor = await prisma.vendor.update({
      where: { id: BigInt(req.params.id) },
      data: { verificationStatus: status },
    });
    res.json({ id: Number(vendor.id), verificationStatus: vendor.verificationStatus });
  })
);

// --- Analytics (raw SQL; mirrors db/hard-queries.sql) --------------------------

// Top 10 selling products this month
adminRoutes.get(
  "/analytics/top-products",
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT p.id AS product_id, p.name,
             SUM(oi.quantity) AS units_sold,
             SUM(oi.price_at_purchase * oi.quantity) AS revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id AND o.status IN ('confirmed','shipped','delivered')
      JOIN products p ON p.id = oi.product_id
      WHERE o.created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
      GROUP BY p.id, p.name
      ORDER BY units_sold DESC
      LIMIT 10`;
    res.json(num(rows));
  })
);

// Revenue by category with month-over-month growth % (LAG window function)
adminRoutes.get(
  "/analytics/revenue-by-category",
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.$queryRaw<any[]>`
      WITH monthly AS (
        SELECT c.id AS category_id, c.name AS category_name,
               DATE_FORMAT(o.created_at, '%Y-%m-01') AS month,
               SUM(oi.price_at_purchase * oi.quantity) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.status IN ('confirmed','shipped','delivered')
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        GROUP BY c.id, c.name, DATE_FORMAT(o.created_at, '%Y-%m-01')
      )
      SELECT category_name, month, revenue,
             LAG(revenue) OVER (PARTITION BY category_id ORDER BY month) AS prev_month_revenue,
             ROUND((revenue - LAG(revenue) OVER (PARTITION BY category_id ORDER BY month))
                   / NULLIF(LAG(revenue) OVER (PARTITION BY category_id ORDER BY month),0) * 100, 2)
               AS mom_growth_pct
      FROM monthly
      ORDER BY category_name, month`;
    res.json(num(rows));
  })
);

// Vendor performance leaderboard
adminRoutes.get(
  "/analytics/vendor-leaderboard",
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT v.id AS vendor_id, v.store_name,
             COALESCE(s.total_revenue,0) AS total_revenue,
             COALESCE(s.items_sold,0)    AS items_sold,
             ROUND(r.avg_rating,2)       AS avg_rating,
             RANK() OVER (ORDER BY COALESCE(s.total_revenue,0) DESC) AS revenue_rank
      FROM vendors v
      LEFT JOIN (
        SELECT oi.vendor_id,
               SUM(oi.price_at_purchase*oi.quantity) AS total_revenue,
               SUM(oi.quantity) AS items_sold
        FROM order_items oi
        WHERE oi.item_status IN ('confirmed','shipped','delivered')
        GROUP BY oi.vendor_id
      ) s ON s.vendor_id = v.id
      LEFT JOIN (
        SELECT p.vendor_id, AVG(rv.rating) AS avg_rating
        FROM reviews rv JOIN products p ON p.id = rv.product_id
        GROUP BY p.vendor_id
      ) r ON r.vendor_id = v.id
      ORDER BY revenue_rank`;
    res.json(num(rows));
  })
);

// Customer lifetime value segmentation
adminRoutes.get(
  "/analytics/clv",
  asyncHandler(async (_req: Request, res: Response) => {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT u.id AS user_id, u.name,
             COUNT(DISTINCT o.id) AS orders_count,
             COALESCE(SUM(o.total_amount),0) AS lifetime_value,
             CASE
               WHEN COALESCE(SUM(o.total_amount),0) >= 50000 THEN 'VIP'
               WHEN COALESCE(SUM(o.total_amount),0) >= 10000 THEN 'High'
               WHEN COALESCE(SUM(o.total_amount),0) > 0      THEN 'Regular'
               ELSE 'New'
             END AS segment
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status IN ('confirmed','shipped','delivered')
      WHERE u.role = 'customer'
      GROUP BY u.id, u.name
      ORDER BY lifetime_value DESC`;
    res.json(num(rows));
  })
);
