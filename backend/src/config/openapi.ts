// Minimal OpenAPI 3 spec served at /docs. Expand per-endpoint schemas as needed.
export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "ShopMesh — Multi-Vendor E-Commerce API",
    version: "1.0.0",
    description:
      "REST API for a multi-vendor marketplace with atomic order management. " +
      "Auth: Bearer access token (15 min) + httpOnly refresh cookie (7 days, rotated).",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/auth/register": { post: { summary: "Register (customer or vendor)", tags: ["auth"] } },
    "/auth/login": { post: { summary: "Login → access token + refresh cookie", tags: ["auth"] } },
    "/auth/refresh": { post: { summary: "Rotate refresh token, new access token", tags: ["auth"] } },
    "/auth/logout": { post: { summary: "Revoke refresh token", tags: ["auth"], security: [{ bearerAuth: [] }] } },
    "/products": {
      get: { summary: "List/search products (cursor pagination: ?limit=&cursor=&q=&sort=)", tags: ["products"] },
      post: { summary: "Create product (vendor)", tags: ["products"], security: [{ bearerAuth: [] }] },
    },
    "/products/{id}": {
      get: { summary: "Product detail with rating summary", tags: ["products"] },
      patch: { summary: "Update own product (vendor)", tags: ["products"], security: [{ bearerAuth: [] }] },
      delete: { summary: "Soft-delete own product (vendor)", tags: ["products"], security: [{ bearerAuth: [] }] },
    },
    "/products/{id}/reviews": {
      get: { summary: "List reviews", tags: ["reviews"] },
      post: { summary: "Create review (verified purchase only)", tags: ["reviews"], security: [{ bearerAuth: [] }] },
    },
    "/products/{id}/recommendations": {
      get: { summary: "Co-occurrence 'bought together' recommendations", tags: ["recommendations"] },
    },
    "/cart": { get: { summary: "View cart with live prices/stock", tags: ["cart"], security: [{ bearerAuth: [] }] } },
    "/cart/items": { post: { summary: "Add item (upsert)", tags: ["cart"], security: [{ bearerAuth: [] }] } },
    "/cart/items/{productId}": {
      patch: { summary: "Set quantity", tags: ["cart"], security: [{ bearerAuth: [] }] },
      delete: { summary: "Remove item", tags: ["cart"], security: [{ bearerAuth: [] }] },
    },
    "/orders/checkout": {
      post: {
        summary: "ATOMIC checkout: lock stock (FOR UPDATE), split by vendor, reserve, pending payment",
        tags: ["orders"],
        security: [{ bearerAuth: [] }],
      },
    },
    "/orders": { get: { summary: "Order history", tags: ["orders"], security: [{ bearerAuth: [] }] } },
    "/orders/{id}": { get: { summary: "Full order view across vendors", tags: ["orders"], security: [{ bearerAuth: [] }] } },
    "/orders/{id}/cancel": { post: { summary: "Cancel (releases reservation, refunds)", tags: ["orders"], security: [{ bearerAuth: [] }] } },
    "/payments/pay": { post: { summary: "Mock payment capture (idempotent on transaction_ref)", tags: ["payments"], security: [{ bearerAuth: [] }] } },
    "/payments/webhook": { post: { summary: "Gateway webhook (HMAC-verified in production)", tags: ["payments"] } },
    "/vendor/orders": { get: { summary: "Vendor's own sub-orders only", tags: ["vendor"], security: [{ bearerAuth: [] }] } },
    "/vendor/orders/{itemId}/status": { patch: { summary: "Advance line-item fulfillment status", tags: ["vendor"], security: [{ bearerAuth: [] }] } },
    "/vendor/payouts": { get: { summary: "Commission settlement history", tags: ["vendor"], security: [{ bearerAuth: [] }] } },
    "/admin/users": { get: { summary: "User management", tags: ["admin"], security: [{ bearerAuth: [] }] } },
    "/admin/vendors/{id}/verify": { patch: { summary: "Approve/reject vendor", tags: ["admin"], security: [{ bearerAuth: [] }] } },
    "/admin/analytics/top-products": { get: { summary: "Top 10 sellers this month", tags: ["admin"], security: [{ bearerAuth: [] }] } },
    "/admin/analytics/revenue-by-category": { get: { summary: "Revenue + MoM growth % (LAG)", tags: ["admin"], security: [{ bearerAuth: [] }] } },
    "/admin/analytics/vendor-leaderboard": { get: { summary: "Vendor ranking (RANK window fn)", tags: ["admin"], security: [{ bearerAuth: [] }] } },
    "/admin/analytics/clv": { get: { summary: "Customer lifetime value segments", tags: ["admin"], security: [{ bearerAuth: [] }] } },
  },
};
