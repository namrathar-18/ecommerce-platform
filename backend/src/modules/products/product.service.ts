import { prisma } from "../../config/prisma.js";
import { Forbidden, NotFound } from "../../shared/errors.js";

interface ListParams {
  q?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  limit: number;
  cursor?: number; // last seen product id (keyset pagination)
}

export const productService = {
  // Cursor-based (keyset) pagination — stable and O(limit) at any depth.
  async list(p: ListParams) {
    const where: any = { isActive: true };
    if (p.categoryId) where.categoryId = p.categoryId;
    if (p.minPrice != null || p.maxPrice != null) {
      where.price = {};
      if (p.minPrice != null) where.price.gte = p.minPrice;
      if (p.maxPrice != null) where.price.lte = p.maxPrice;
    }
    if (p.q) {
      // MySQL: falls back to LIKE via Prisma contains (fulltext demoed in raw hard-queries.sql)
      where.OR = [{ name: { contains: p.q } }, { description: { contains: p.q } }];
    }

    let orderBy: any = { id: "desc" };
    if (p.sort === "price_asc") orderBy = [{ price: "asc" }, { id: "asc" }];
    else if (p.sort === "price_desc") orderBy = [{ price: "desc" }, { id: "desc" }];

    const items = await prisma.product.findMany({
      where,
      orderBy,
      take: p.limit + 1, // fetch one extra to know if there's a next page
      ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
      include: { images: { where: { isPrimary: true }, take: 1 }, inventory: true },
    });

    const hasMore = items.length > p.limit;
    const page = hasMore ? items.slice(0, p.limit) : items;
    const nextCursor = hasMore ? Number(page[page.length - 1].id) : null;
    return { items: page, nextCursor };
  },

  async getById(id: number) {
    const product = await prisma.product.findFirst({
      where: { id, isActive: true },
      include: {
        images: true,
        inventory: true,
        vendor: { select: { id: true, storeName: true } },
        category: true,
      },
    });
    if (!product) throw NotFound("Product not found");
    const rating = await prisma.review.aggregate({
      where: { productId: id },
      _avg: { rating: true },
      _count: true,
    });
    return { ...product, ratingAvg: rating._avg.rating, ratingCount: rating._count };
  },

  async create(vendorId: number, data: any) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          vendorId,
          categoryId: data.categoryId ?? null,
          name: data.name,
          description: data.description ?? null,
          price: data.price,
          discountPrice: data.discountPrice ?? null,
          sku: data.sku,
        },
      });
      await tx.inventory.create({
        data: { productId: product.id, quantity: data.quantity ?? 0 },
      });
      if (data.imageUrl) {
        await tx.productImage.create({
          data: { productId: product.id, imageUrl: data.imageUrl, isPrimary: true },
        });
      }
      return product;
    });
  },

  async update(vendorId: number, productId: number, data: any) {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) throw NotFound("Product not found");
    if (Number(existing.vendorId) !== vendorId) throw Forbidden("Not your product");
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name ?? existing.name,
        description: data.description ?? existing.description,
        price: data.price ?? existing.price,
        discountPrice: data.discountPrice ?? existing.discountPrice,
        categoryId: data.categoryId ?? existing.categoryId,
      },
    });
    if (data.quantity != null) {
      await prisma.inventory.update({
        where: { productId },
        data: { quantity: data.quantity },
      });
    }
    return product;
  },

  async softDelete(vendorId: number, productId: number) {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) throw NotFound("Product not found");
    if (Number(existing.vendorId) !== vendorId) throw Forbidden("Not your product");
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
  },
};
