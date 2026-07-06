import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import "./config/prisma.js"; // apply BigInt JSON patch early
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./config/openapi.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { productRoutes } from "./modules/products/product.routes.js";
import { cartRoutes } from "./modules/cart/cart.routes.js";
import { orderRoutes } from "./modules/orders/order.routes.js";
import { paymentRoutes } from "./modules/payments/payment.routes.js";
import { vendorRoutes } from "./modules/vendors/vendor.routes.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { reviewRoutes } from "./modules/reviews/review.routes.js";
import { recommendationRoutes } from "./modules/recommendations/recommendation.routes.js";

export function createApp() {
  const app = express();

  // CSP disabled: the API serves JSON only, except Swagger UI at /docs whose
  // inline bootstrap script the default CSP would block.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  if (env.nodeEnv !== "test") app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ status: "ok", ts: Date.now() }));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

  const v1 = express.Router();
  v1.use("/auth", authRoutes);
  v1.use("/products", productRoutes);
  v1.use("/products/:id/reviews", reviewRoutes); // nested, verified-purchase gated
  v1.use("/cart", cartRoutes);
  v1.use("/orders", orderRoutes);
  v1.use("/payments", paymentRoutes);
  v1.use("/vendor", vendorRoutes);
  v1.use("/admin", adminRoutes);
  v1.use("/", recommendationRoutes); // GET /products/:id/recommendations
  app.use("/api/v1", v1);

  app.use(errorHandler);
  return app;
}
