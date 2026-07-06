import rateLimit from "express-rate-limit";

// Brute-force protection on auth endpoints: 10 attempts / 15 min / IP.
// Relaxed outside production so integration/stress tests can create accounts.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 10 : 1000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts, try later." } },
});
