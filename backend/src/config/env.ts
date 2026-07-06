import dotenv from "dotenv";
dotenv.config();

function required(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL", "mysql://ecom:ecom_pw@localhost:3306/ecommerce"),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET", "dev_access_secret_change_me"),
    refreshSecret: required("JWT_REFRESH_SECRET", "dev_refresh_secret_change_me"),
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  },
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
};
