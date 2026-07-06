import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

/**
 * Integration test for the order → payment flow.
 * Requires a running MySQL with the schema + seed applied (docker compose up + npm run seed).
 * Run with: npm test
 */
const app = createApp();
let accessToken = "";
let orderId = 0;
let productId = 0;

describe("order + payment flow", () => {
  beforeAll(async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "asha@shop.dev", password: "Password123" });
    accessToken = login.body.accessToken;
    expect(accessToken).toBeTruthy();

    // resolve an in-stock product dynamically (ids drift across reseeds)
    const products = await request(app).get("/api/v1/products?limit=50");
    const inStock = products.body.items.find(
      (p: any) => p.inventory && p.inventory.quantity - p.inventory.reservedQuantity > 0
    );
    expect(inStock).toBeTruthy();
    productId = Number(inStock.id);
  });

  it("adds an item to cart", async () => {
    const res = await request(app)
      .post("/api/v1/cart/items")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productId, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it("checks out atomically", async () => {
    const res = await request(app)
      .post("/api/v1/orders/checkout")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    orderId = res.body.orderId;
  });

  it("pays and confirms the order", async () => {
    const res = await request(app)
      .post("/api/v1/payments/pay")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ orderId, outcome: "success" });
    expect(res.status).toBe(200);
    expect(res.body.paymentStatus).toBe("success");
  });
});
