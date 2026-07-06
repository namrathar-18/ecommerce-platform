import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(72), // bcrypt max input 72 bytes
    phone: z.string().max(20).optional(),
    role: z.enum(["customer", "vendor"]).default("customer"),
    storeName: z.string().min(2).max(160).optional(), // required when role=vendor
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});
