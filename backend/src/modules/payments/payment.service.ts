import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { BadRequest, NotFound } from "../../shared/errors.js";

/**
 * Mock payment gateway. In production this logic lives behind a signed webhook
 * from Razorpay/Stripe. `transaction_ref` is UNIQUE => replaying the same event
 * cannot capture twice (idempotency).
 */
export const paymentService = {
  // Simulate the customer completing payment for an order.
  async confirm(orderId: number, transactionRef: string, outcome: "success" | "failed") {
    if (!transactionRef) throw BadRequest("transactionRef required");

    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { orderId: BigInt(orderId) } });
      if (!payment) throw NotFound("Payment not found");

      // Idempotency: if we already processed this ref, no-op.
      if (payment.transactionRef === transactionRef && payment.paymentStatus !== "pending") {
        return { orderId, paymentStatus: payment.paymentStatus, idempotent: true };
      }
      if (payment.paymentStatus !== "pending")
        throw BadRequest(`Payment already ${payment.paymentStatus}`);

      const order = await tx.order.findUniqueOrThrow({
        where: { id: BigInt(orderId) },
        include: { items: true },
      });

      if (outcome === "failed") {
        // release reservations, cancel order
        for (const item of order.items) {
          await tx.inventory.updateMany({
            where: { productId: item.productId },
            data: { reservedQuantity: { decrement: item.quantity } },
          });
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: { paymentStatus: "failed", transactionRef },
        });
        await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
        return { orderId, paymentStatus: "failed" };
      }

      // SUCCESS: convert reservation into a real stock decrement + create payouts.
      for (const item of order.items) {
        await tx.inventory.updateMany({
          where: { productId: item.productId },
          data: {
            quantity: { decrement: item.quantity },
            reservedQuantity: { decrement: item.quantity },
          },
        });
        await tx.orderItem.update({ where: { id: item.id }, data: { itemStatus: "confirmed" } });

        // commission-aware payout row (pending until weekly settlement job runs)
        const vendor = await tx.vendor.findUniqueOrThrow({ where: { id: item.vendorId } });
        const gross = new Prisma.Decimal(item.priceAtPurchase).mul(item.quantity);
        const payout = gross.mul(new Prisma.Decimal(1).sub(vendor.commissionRate));
        await tx.vendorPayout.create({
          data: { vendorId: item.vendorId, orderItemId: item.id, amount: payout, payoutStatus: "pending" },
        });
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: { paymentStatus: "success", transactionRef },
      });
      await tx.order.update({ where: { id: order.id }, data: { status: "confirmed" } });
      return { orderId, paymentStatus: "success" };
    });
  },
};
