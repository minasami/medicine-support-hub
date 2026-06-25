import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, branchesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, createSession, getSession, destroySession, COOKIE_NAME } from "../lib/auth.js";
import { z } from "zod";

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user || !user.active) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = createSession(user.id, user.role, user.username, user.display_name, user.branch_id ?? null);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000,
    secure: process.env["NODE_ENV"] === "production",
  });

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name,
    branchId: user.branch_id,
  });
});

router.post("/auth/logout", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) destroySession(token);
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
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
  res.json({
    id: session.userId,
    username: session.username,
    role: session.role,
    displayName: session.displayName,
    branchId: session.branchId,
  });
});

export default router;
