import { Request, Response } from "express";
import { authService } from "./auth.service.js";
import { env } from "../../config/env.js";

const REFRESH_COOKIE = "refreshToken";
function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.nodeEnv === "production",
    maxAge: env.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });
}

export const authController = {
  async register(req: Request, res: Response) {
    const { accessToken, refreshToken, user } = await authService.register(req.body);
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ accessToken, user });
  },

  async login(req: Request, res: Response) {
    const { accessToken, refreshToken, user } = await authService.login(
      req.body.email,
      req.body.password
    );
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  },

  async refresh(req: Request, res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    const { accessToken, refreshToken, user } = await authService.refresh(raw);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken, user });
  },

  async logout(req: Request, res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    await authService.logout(raw);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    res.status(204).send();
  },
};
