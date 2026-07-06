import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma.js";

/**
 * Seed with REAL product data from the DummyJSON products API
 * (https://dummyjson.com/products) — real names, descriptions and CDN photos.
 *
 * Logins (all password: Password123):
 *   admin@shop.dev | ravi@shop.dev (vendor) | meera@shop.dev (vendor)
 *   asha@shop.dev, vikram@shop.dev (customers)
 */

const USD_TO_INR = 83;

// Tech categories go to Ravi Electronics; everything else to Meera Home & Lifestyle.
const TECH = new Set(["smartphones", "laptops", "tablets", "mobile-accessories"]);

const pretty = (slug: string) =>
  slug.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");

async function fetchProducts() {
  const res = await fetch("https://dummyjson.com/products?limit=80");
  if (!res.ok) throw new Error(`DummyJSON fetch failed: ${res.status}`);
  const data = (await res.json()) as { products: any[] };
  return data.products;
}

async function main() {
  console.log("Fetching real product data from dummyjson.com ...");
  const apiProducts = await fetchProducts();
  console.log(`Fetched ${apiProducts.length} products. Seeding...`);

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

  await prisma.user.create({
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
    data: { userId: meeraUser.id, storeName: "Meera Home & Lifestyle", verificationStatus: "verified", commissionRate: 0.12 },
  });

  const asha = await prisma.user.create({
    data: { name: "Asha", email: "asha@shop.dev", passwordHash: hash, role: "customer" },
  });
  await prisma.cart.create({ data: { userId: asha.id } });
  await prisma.address.create({
    data: { userId: asha.id, addressLine: "12 MG Road", city: "Bengaluru", state: "KA", pincode: "560001", isDefault: true },
  });

  const vikram = await prisma.user.create({
    data: { name: "Vikram", email: "vikram@shop.dev", passwordHash: hash, role: "customer" },
  });
  await prisma.cart.create({ data: { userId: vikram.id } });

  // Categories from the API data
  const categoryIds = new Map<string, bigint>();
  for (const p of apiProducts) {
    if (!categoryIds.has(p.category)) {
      const cat = await prisma.category.create({ data: { name: pretty(p.category) } });
      categoryIds.set(p.category, cat.id);
    }
  }

  // Products with real images
  const seeded: { id: bigint; vendorId: bigint; price: number; title: string }[] = [];
  for (const p of apiProducts) {
    const vendor = TECH.has(p.category) ? ravi : meera;
    const priceInr = Math.round(p.price * USD_TO_INR);
    const hasDiscount = (p.discountPercentage ?? 0) >= 5;
    const discountInr = hasDiscount
      ? Math.round(priceInr * (1 - p.discountPercentage / 100))
      : null;

    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: categoryIds.get(p.category)!,
        name: p.title,
        description: p.description,
        price: priceInr,
        discountPrice: discountInr,
        sku: `DJ-${p.id}`,
      },
    });
    await prisma.inventory.create({
      data: { productId: product.id, quantity: p.stock ?? 25, lowStockThreshold: 5 },
    });

    // real CDN photos: primary + up to 2 gallery shots
    const urls: string[] = (p.images?.length ? p.images : [p.thumbnail]).slice(0, 3);
    for (let i = 0; i < urls.length; i++) {
      await prisma.productImage.create({
        data: { productId: product.id, imageUrl: urls[i], isPrimary: i === 0 },
      });
    }
    seeded.push({
      id: product.id,
      vendorId: vendor.id,
      price: discountInr ?? priceInr,
      title: p.title,
    });
  }

  // Historical delivered orders across 3 months -> non-null MoM growth in analytics
  let txn = 0;
  async function makeOrder(userId: bigint, when: Date, picks: number[]) {
    const lines = picks.map((i) => seeded[i % seeded.length]);
    const total = lines.reduce((s, l) => s + l.price, 0);
    const order = await prisma.order.create({
      data: { userId, status: "delivered", totalAmount: total, createdAt: when },
    });
    for (const l of lines) {
      await prisma.orderItem.create({
        data: { orderId: order.id, productId: l.id, vendorId: l.vendorId, quantity: 1, priceAtPurchase: l.price, itemStatus: "delivered" },
      });
    }
    await prisma.payment.create({
      data: { orderId: order.id, amount: total, paymentMethod: "mock", paymentStatus: "success", transactionRef: `seed_txn_${++txn}`, createdAt: when },
    });
  }

  const may = (d: number) => new Date(2026, 4, d, 11);
  const jun = (d: number) => new Date(2026, 5, d, 15);
  const jul = (d: number) => new Date(2026, 6, d, 10);

  await makeOrder(asha.id, may(6), [0, 21]);
  await makeOrder(vikram.id, may(18), [35]);
  await makeOrder(asha.id, jun(3), [2, 40, 55]);
  await makeOrder(vikram.id, jun(14), [0, 21]); // repeat pair -> co-purchase signal
  await makeOrder(vikram.id, jun(25), [8, 63]);
  await makeOrder(asha.id, jul(2), [0, 21, 70]);
  await makeOrder(vikram.id, jul(4), [12, 44]);

  // Reviews on purchased products (verified-purchase rule holds)
  await prisma.review.create({ data: { productId: seeded[0].id, userId: asha.id, rating: 5, comment: "Excellent quality, exactly as described." } });
  await prisma.review.create({ data: { productId: seeded[0].id, userId: vikram.id, rating: 4, comment: "Very good, fast delivery." } });
  await prisma.review.create({ data: { productId: seeded[21].id, userId: asha.id, rating: 5, comment: "Love it — great value for money." } });
  await prisma.review.create({ data: { productId: seeded[2].id, userId: asha.id, rating: 4, comment: "Works well, happy with the purchase." } });

  console.log(`Seed complete: ${seeded.length} real products across ${categoryIds.size} categories, 7 historical orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
