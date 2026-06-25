import { type Request, type Response, type NextFunction } from "express";
import { getSession, COOKIE_NAME } from "../lib/auth.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: "Session expired" });
    return;
  }
  (req as any).session = session;
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
    const session = getSession(token);
    if (!session) { res.status(401).json({ error: "Session expired" }); return; }
    if (!roles.includes(session.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    (req as any).session = session;
    next();
  };
}
