import { Router } from "express";
import { authController } from "./auth.controller.js";
import { validate } from "../../middleware/validate.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authLimiter } from "../../middleware/rateLimit.js";
import { asyncHandler } from "../../shared/asyncHandler.js";
import { registerSchema, loginSchema } from "./auth.schema.js";

export const authRoutes = Router();

authRoutes.post("/register", authLimiter, validate(registerSchema), asyncHandler(authController.register));
authRoutes.post("/login", authLimiter, validate(loginSchema), asyncHandler(authController.login));
authRoutes.post("/refresh", asyncHandler(authController.refresh));
authRoutes.post("/logout", authenticate, asyncHandler(authController.logout));
