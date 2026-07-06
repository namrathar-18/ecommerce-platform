import { Router, Request, Response } from "express";
import { z } from "zod";
import { productService } from "./product.service.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { Forbidden } from "../../shared/errors.js";

export const productRoutes = Router();

const listSchema = z.object({
  query: z.object({
    q: z.string().optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    sort: z.enum(["newest", "price_asc", "price_desc"]).default("newest"),
    limit: z.coerce.number().int().min(1).max(50).default(12),
    cursor: z.coerce.number().int().positive().optional(),
  }),
});

const createSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200),
    description: z.string().max(5000).optional(),
    price: z.number().nonnegative(),
    discountPrice: z.number().nonnegative().optional(),
    sku: z.string().min(1).max(64),
    categoryId: z.number().int().positive().optional(),
    quantity: z.number().int().nonnegative().default(0),
    imageUrl: z.string().url().optional(),
  }),
});

productRoutes.get(
  "/",
  validate(listSchema),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await productService.list(req.query as any));
  })
);

productRoutes.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await productService.getById(Number(req.params.id)));
  })
);

productRoutes.post(
  "/",
  authenticate,
  authorize("vendor"),
  validate(createSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user!.vendorId) throw Forbidden("No vendor profile");
    res.status(201).json(await productService.create(req.user!.vendorId, req.body));
  })
);

productRoutes.patch(
  "/:id",
  authenticate,
  authorize("vendor"),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await productService.update(req.user!.vendorId!, Number(req.params.id), req.body));
  })
);

productRoutes.delete(
  "/:id",
  authenticate,
  authorize("vendor"),
  asyncHandler(async (req: Request, res: Response) => {
    await productService.softDelete(req.user!.vendorId!, Number(req.params.id));
    res.status(204).send();
  })
);
