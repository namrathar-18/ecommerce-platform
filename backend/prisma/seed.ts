import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";

/**
 * Idempotent-ish seed: wipes and repopulates demo data.
 * Logins (all password: Password123):
 *   admin@shop.dev  | ravi@shop.dev (vendor) | meera@shop.dev (vendor) | asha@shop.dev (customer)
 */
async function main() {
  console.log("Seeding...");
  // Clear in FK-safe order
  await prisma.vendorPayout.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.review.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.address.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash("Password123", 12);

  const admin = await prisma.user.create({
    data: { name: "Site Admin", email: "admin@shop.dev", passwordHash: hash, role: "admin" },
  });

  const raviUser = await prisma.user.create({
    data: { name: "Ravi", email: "ravi@shop.dev", passwordHash: hash, role: "vendor" },
  });
  const ravi = await prisma.vendor.create({
    data: { userId: raviUser.id, storeName: "Ravi Electronics", verificationStatus: "verified", commissionRate: 0.1 },
  });

  const meeraUser = await prisma.user.create({
    data: { name: "Meera", email: "meera@shop.dev", passwordHash: hash, role: "vendor" },
  });
  const meera = await prisma.vendor.create({
    data: { userId: meeraUser.id, storeName: "Meera Home & Kitchen", verificationStatus: "verified", commissionRate: 0.12 },
  });

  const asha = await prisma.user.create({
    data: { name: "Asha", email: "asha@shop.dev", passwordHash: hash, role: "customer" },
  });
  await prisma.cart.create({ data: { userId: asha.id } });
  await prisma.address.create({
    data: { userId: asha.id, addressLine: "12 MG Road", city: "Bengaluru", state: "KA", pincode: "560001", isDefault: true },
  });

  const electronics = await prisma.category.create({ data: { name: "Electronics" } });
  const home = await prisma.category.create({ data: { name: "Home & Kitchen" } });

  async function makeProduct(vendorId: bigint, categoryId: bigint, name: string, sku: string, price: number, qty: number, img: string, discount?: number) {
    const p = await prisma.product.create({
      data: { vendorId, categoryId, name, sku, price, discountPrice: discount ?? null },
    });
    await prisma.inventory.create({ data: { productId: p.id, quantity: qty } });
    await prisma.productImage.create({ data: { productId: p.id, imageUrl: img, isPrimary: true } });
    return p;
  }

  // Local SVG assets served by the frontend (frontend/public/images/*)
  const p1 = await makeProduct(ravi.id, electronics.id, "Wireless Earbuds", "RAV-EAR-001", 2499, 50, "/images/earbuds.svg", 1999);
  const p2 = await makeProduct(ravi.id, electronics.id, "USB-C Charger 65W", "RAV-CHG-002", 1899, 3, "/images/charger.svg");
  const p3 = await makeProduct(ravi.id, electronics.id, "Bluetooth Speaker", "RAV-SPK-003", 3499, 20, "/images/speaker.svg");
  const p4 = await makeProduct(meera.id, home.id, "Ceramic Mug Set", "MEE-MUG-001", 899, 100, "/images/mugs.svg");
  const p5 = await makeProduct(meera.id, home.id, "Stainless Steel Bottle", "MEE-BTL-002", 649, 80, "/images/bottle.svg");
  const p6 = await makeProduct(meera.id, home.id, "Non-stick Frying Pan", "MEE-PAN-003", 1299, 40, "/images/pan.svg", 999);

  // A second customer so co-purchase recommendations have signal.
  const vikram = await prisma.user.create({
    data: { name: "Vikram", email: "vikram@shop.dev", passwordHash: hash, role: "customer" },
  });
  await prisma.cart.create({ data: { userId: vikram.id } });

  // Historical delivered orders across 3 months -> non-null MoM growth % in analytics.
  let txn = 0;
  async function makeOrder(userId: bigint, when: Date, lines: Array<{ p: any; vendor: any; qty: number; price: number }>) {
    const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const order = await prisma.order.create({
      data: { userId, status: "delivered", totalAmount: total, createdAt: when },
    });
    for (const l of lines) {
      await prisma.orderItem.create({
        data: { orderId: order.id, productId: l.p.id, vendorId: l.vendor.id, quantity: l.qty, priceAtPurchase: l.price, itemStatus: "delivered" },
      });
    }
    await prisma.payment.create({
      data: { orderId: order.id, amount: total, paymentMethod: "mock", paymentStatus: "success", transactionRef: `seed_txn_${++txn}`, createdAt: when },
    });
    return order;
  }

  const may = (d: number) => new Date(2026, 4, d, 11);
  const jun = (d: number) => new Date(2026, 5, d, 15);
  const jul = (d: number) => new Date(2026, 6, d, 10);

  await makeOrder(asha.id, may(6), [{ p: p1, vendor: ravi, qty: 1, price: 1999 }, { p: p4, vendor: meera, qty: 2, price: 899 }]);
  await makeOrder(vikram.id, may(18), [{ p: p5, vendor: meera, qty: 1, price: 649 }]);
  await makeOrder(asha.id, jun(3), [{ p: p3, vendor: ravi, qty: 1, price: 3499 }, { p: p6, vendor: meera, qty: 1, price: 999 }]);
  await makeOrder(vikram.id, jun(14), [{ p: p1, vendor: ravi, qty: 1, price: 1999 }, { p: p4, vendor: meera, qty: 1, price: 899 }]);
  await makeOrder(vikram.id, jun(25), [{ p: p2, vendor: ravi, qty: 1, price: 1899 }]);
  await makeOrder(asha.id, jul(2), [{ p: p1, vendor: ravi, qty: 1, price: 1999 }, { p: p4, vendor: meera, qty: 1, price: 899 }]);
  await makeOrder(vikram.id, jul(4), [{ p: p6, vendor: meera, qty: 2, price: 999 }, { p: p5, vendor: meera, qty: 1, price: 649 }]);

  await prisma.review.create({ data: { productId: p1.id, userId: asha.id, rating: 5, comment: "Great sound, deep bass!" } });
  await prisma.review.create({ data: { productId: p1.id, userId: vikram.id, rating: 4, comment: "Solid for the price." } });
  await prisma.review.create({ data: { productId: p4.id, userId: asha.id, rating: 5, comment: "Beautiful mugs, sturdy." } });
  await prisma.review.create({ data: { productId: p3.id, userId: asha.id, rating: 4, comment: "Loud and clear." } });

  console.log("Seed complete. Products:", [p1, p2, p3, p4, p5, p6].map((p) => Number(p.id)));
  console.log("Admin:", Number(admin.id), "Ravi vendor:", Number(ravi.id), "Meera vendor:", Number(meera.id));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
