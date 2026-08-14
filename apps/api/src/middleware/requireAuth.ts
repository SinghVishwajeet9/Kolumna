import type { Request, Response, NextFunction } from "express";
import { validateSessionToken, SESSION_COOKIE_NAME } from "../lib/session.js";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const user = await validateSessionToken(token);
    if (!user) {
      return res.status(401).json({ error: "Not logged in" });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
