import { prisma } from "../../config/prisma.js";
import { BadRequest, NotFound } from "../../shared/errors.js";

async function getOrCreateCart(userId: number) {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.cart.create({ data: { userId } });
}

export const cartService = {
  async view(userId: number) {
    const cart = await getOrCreateCart(userId);
    const items = await prisma.cartItem.findMany({
      where: { cartId: cart.id },
      include: {
        product: {
          include: { inventory: true, images: { where: { isPrimary: true }, take: 1 } },
        },
      },
    });
    const lines = items.map((it) => {
      const unit = Number(it.product.discountPrice ?? it.product.price);
      const available = it.product.inventory
        ? it.product.inventory.quantity - it.product.inventory.reservedQuantity
        : 0;
      return {
        productId: Number(it.productId),
        name: it.product.name,
        image: it.product.images[0]?.imageUrl ?? null,
        unitPrice: unit,
        quantity: it.quantity,
        lineTotal: unit * it.quantity,
        inStock: available >= it.quantity,
        available,
      };
    });
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    return { cartId: Number(cart.id), lines, total };
  },

  async addItem(userId: number, productId: number, quantity: number) {
    if (quantity < 1) throw BadRequest("quantity must be >= 1");
    const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } });
    if (!product) throw NotFound("Product not found");
    const cart = await getOrCreateCart(userId);
    // upsert on the (cart_id, product_id) unique key -> increment instead of duplicate row
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: BigInt(productId) } },
      create: { cartId: cart.id, productId: BigInt(productId), quantity },
      update: { quantity: { increment: quantity } },
    });
    return this.view(userId);
  },

  async setQuantity(userId: number, productId: number, quantity: number) {
    const cart = await getOrCreateCart(userId);
    if (quantity <= 0) {
      await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: BigInt(productId) } });
    } else {
      await prisma.cartItem.updateMany({
        where: { cartId: cart.id, productId: BigInt(productId) },
        data: { quantity },
      });
    }
    return this.view(userId);
  },

  async removeItem(userId: number, productId: number) {
    const cart = await getOrCreateCart(userId);
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: BigInt(productId) } });
    return this.view(userId);
  },
};
