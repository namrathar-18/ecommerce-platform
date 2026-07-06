import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { BadRequest, Conflict, Forbidden, NotFound } from "../../shared/errors.js";

interface LockedRow {
  product_id: bigint;
  quantity: number;
  reserved_quantity: number;
  price: Prisma.Decimal;
  discount_price: Prisma.Decimal | null;
  vendor_id: bigint;
}

export const orderService = {
  /**
   * ATOMIC CHECKOUT.
   * - Interactive transaction (Serializable-adjacent guarantees via explicit row locks).
   * - Locks every touched inventory row with `SELECT ... FOR UPDATE` ordered by product_id
   *   (deterministic order => no deadlocks between concurrent carts).
   * - Verifies availability, reserves stock, splits order_items by vendor, creates a pending
   *   payment. Any failure rolls the whole thing back — no partial order is ever visible.
   */
  async checkout(userId: number, addressId?: number) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw BadRequest("Cart is empty");
    const cartItems = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    if (cartItems.length === 0) throw BadRequest("Cart is empty");

    const qtyByProduct = new Map<number, number>();
    for (const ci of cartItems) qtyByProduct.set(Number(ci.productId), ci.quantity);
    const productIds = [...qtyByProduct.keys()].sort((a, b) => a - b); // deterministic lock order

    return prisma.$transaction(
      async (tx) => {
        // Step A: lock inventory rows (FOR UPDATE). Raw SQL because Prisma has no lock clause.
        const idList = Prisma.join(productIds);
        const locked = await tx.$queryRaw<LockedRow[]>`
          SELECT i.product_id, i.quantity, i.reserved_quantity,
                 p.price, p.discount_price, p.vendor_id
          FROM inventory i
          JOIN products p ON p.id = i.product_id
          WHERE i.product_id IN (${idList})
          ORDER BY i.product_id
          FOR UPDATE`;

        if (locked.length !== productIds.length)
          throw NotFound("One or more products no longer exist");

        // Step B: availability guard.
        for (const row of locked) {
          const need = qtyByProduct.get(Number(row.product_id))!;
          const available = row.quantity - row.reserved_quantity;
          if (available < need)
            throw Conflict(`Insufficient stock for product ${row.product_id} (have ${available}, need ${need})`);
        }

        // Step C: order shell.
        const order = await tx.order.create({
          data: { userId: BigInt(userId), status: "pending", totalAmount: 0, shippingAddressId: addressId ? BigInt(addressId) : null },
        });

        // Step D + E: create vendor-split line items and reserve stock.
        let total = new Prisma.Decimal(0);
        for (const row of locked) {
          const need = qtyByProduct.get(Number(row.product_id))!;
          const unit = row.discount_price ?? row.price;
          total = total.add(unit.mul(need));
          await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: row.product_id,
              vendorId: row.vendor_id,
              quantity: need,
              priceAtPurchase: unit,
              itemStatus: "pending",
            },
          });
          await tx.inventory.update({
            where: { productId: row.product_id },
            data: { reservedQuantity: { increment: need } },
          });
        }

        // Step F: authoritative total.
        await tx.order.update({ where: { id: order.id }, data: { totalAmount: total } });

        // Step G: pending payment.
        await tx.payment.create({
          data: { orderId: order.id, amount: total, paymentMethod: "mock", paymentStatus: "pending" },
        });

        // Step H: clear cart.
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

        return { orderId: Number(order.id), total: Number(total), status: "pending" };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 15000 }
    );
  },

  async history(userId: number) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { items: true, payment: true },
    });
  },

  // Full order view reconstructed across vendors.
  async getById(userId: number, orderId: number, role: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: { select: { name: true } }, vendor: { select: { storeName: true } } } },
        payment: true,
        address: true,
      },
    });
    if (!order) throw NotFound("Order not found");
    if (role !== "admin" && Number(order.userId) !== userId) throw Forbidden("Not your order");
    return order;
  },

  // Cancel if not yet shipped: release reservation + mark cancelled + flag refund.
  async cancel(userId: number, orderId: number) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw NotFound("Order not found");
      if (Number(order.userId) !== userId) throw Forbidden("Not your order");
      if (["shipped", "delivered", "cancelled", "refunded"].includes(order.status))
        throw BadRequest(`Cannot cancel an order that is ${order.status}`);

      for (const item of order.items) {
        // release the reservation we held at checkout
        await tx.inventory.updateMany({
          where: { productId: item.productId },
          data: { reservedQuantity: { decrement: item.quantity } },
        });
        await tx.orderItem.update({ where: { id: item.id }, data: { itemStatus: "cancelled" } });
      }
      await tx.order.update({ where: { id: orderId }, data: { status: "cancelled" } });
      await tx.payment.updateMany({
        where: { orderId: BigInt(orderId), paymentStatus: { in: ["pending", "success"] } },
        data: { paymentStatus: "refunded" },
      });
      return { orderId, status: "cancelled" };
    });
  },
};
