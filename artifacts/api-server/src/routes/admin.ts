import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, branchesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, getSession, COOKIE_NAME } from "../lib/auth.js";
import { z } from "zod";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }
  const session = getSession(token);
  if (!session || session.role !== "PLATFORM_ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}

const createUserSchema = z.object({
  username: z.string().min(2),
  password: z.string().min(4),
  display_name: z.string().min(1),
  role: z.string().min(1),
  branch_id: z.number().int().nullable().optional(),
});

const updateUserSchema = z.object({
  display_name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  branch_id: z.number().int().nullable().optional(),
  active: z.boolean().optional(),
  password: z.string().min(4).optional(),
});

const createBranchSchema = z.object({
  name: z.string().min(1),
  name_ar: z.string().default(""),
  manager_id: z.number().int().nullable().optional(),
});

// Users
router.get("/admin/users", requireAdmin, async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      display_name: usersTable.display_name,
      role: usersTable.role,
      branch_id: usersTable.branch_id,
      active: usersTable.active,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users.map(u => ({ ...u, created_at: u.createdAt.toISOString(), createdAt: undefined })));
});

router.post("/admin/users", requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const { username, password, display_name, role, branch_id } = parsed.data;
  const password_hash = hashPassword(password);

  const [user] = await db
    .insert(usersTable)
    .values({ username, password_hash, display_name, role, branch_id: branch_id ?? null, active: true })
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      display_name: usersTable.display_name,
      role: usersTable.role,
      branch_id: usersTable.branch_id,
      active: usersTable.active,
    });
  res.status(201).json(user);
});

router.patch("/admin/users/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { password, ...rest } = parsed.data;
  const updates: Record<string, any> = { ...rest };
  if (password) updates["password_hash"] = hashPassword(password);

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      username: usersTable.username,
      display_name: usersTable.display_name,
      role: usersTable.role,
      branch_id: usersTable.branch_id,
      active: usersTable.active,
    });

  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

// Branches
router.get("/admin/branches", requireAdmin, async (_req, res) => {
  const branches = await db.select().from(branchesTable).orderBy(branchesTable.createdAt);
  res.json(branches.map(b => ({ ...b, created_at: b.createdAt.toISOString(), createdAt: undefined })));
});

router.post("/admin/branches", requireAdmin, async (req, res) => {
  const parsed = createBranchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const [branch] = await db.insert(branchesTable).values(parsed.data).returning();
  res.status(201).json(branch);
});

router.patch("/admin/branches/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params["id"]);
  const parsed = createBranchSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const [branch] = await db.update(branchesTable).set(parsed.data).where(eq(branchesTable.id, id)).returning();
  if (!branch) { res.status(404).json({ error: "Branch not found" }); return; }
  res.json(branch);
});

export default router;
